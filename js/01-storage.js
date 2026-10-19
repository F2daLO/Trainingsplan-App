// @ts-check
/* Lokaler Speicher: IndexedDB ist der Hauptspeicher (kein 5-MB-Limit wie bei localStorage).
 * localStorage dient nur als Fallback (z. B. privater Modus) und als Notnetz beim Schließen der Seite.
 * Das Startskript wartet auf mtStore.ready, bevor die App rendert. */
(function (root) {
  "use strict";
  const DB_NAME = "mein-training", STORE = "kv", OPEN_TIMEOUT_MS = 4000, FLUSH_DELAY_MS = 250;
  const LS = { db: "meintraining-v51", backups: "mt_local_backups_v60", savedAt: "mt_saved_at" };

  /** Entscheidet, welche Kopie (IndexedDB oder localStorage) die neuere ist. Rein, damit testbar.
   * @param {any} idbVal @param {number} idbSavedAt @param {any} lsVal @param {number} lsSavedAt
   * @returns {{value:any, source:"idb"|"ls"|"none"}} */
  function pickNewer(idbVal, idbSavedAt, lsVal, lsSavedAt) {
    if (idbVal == null && lsVal == null) return { value: null, source: "none" };
    if (idbVal == null) return { value: lsVal, source: "ls" };
    if (lsVal == null) return { value: idbVal, source: "idb" };
    return (lsSavedAt || 0) > (idbSavedAt || 0) ? { value: lsVal, source: "ls" } : { value: idbVal, source: "idb" };
  }

  /** @type {Map<string, any>} */ const cache = new Map();
  /** @type {Map<string, any>} */ const pending = new Map();
  /** @type {IDBDatabase|null} */ let idb = null;
  let idbOk = false, timer = null, errorHandler = /** @type {null|((e:any)=>void)} */ (null);

  function lsRead(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
  function lsWrite(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }
  function lsRemove(key) { try { localStorage.removeItem(key); } catch { /* egal */ } }

  /** @returns {Promise<IDBDatabase|null>} */
  function openDb() {
    return new Promise(resolve => {
      let done = false; const finish = (/** @type {IDBDatabase|null} */ v) => { if (!done) { done = true; resolve(v); } };
      try {
        if (!root.indexedDB) return finish(null);
        const req = root.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
        req.onsuccess = () => finish(req.result);
        req.onerror = () => finish(null);
        req.onblocked = () => finish(null);
        setTimeout(() => finish(null), OPEN_TIMEOUT_MS); // Safari im privaten Modus kann hängen
      } catch { finish(null); }
    });
  }
  /** @param {IDBDatabase} d @param {string} key @returns {Promise<any>} */
  function idbGet(d, key) {
    return new Promise(res => { try { const r = d.transaction(STORE, "readonly").objectStore(STORE).get(key); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch { res(undefined); } });
  }
  /** @param {IDBDatabase} d @param {Map<string, any>} entries @returns {Promise<boolean>} */
  function idbPutAll(d, entries) {
    return new Promise(res => {
      try {
        const tx = d.transaction(STORE, "readwrite"), os = tx.objectStore(STORE);
        entries.forEach((v, k) => os.put(v, k));
        tx.oncomplete = () => res(true); tx.onerror = () => res(false); tx.onabort = () => res(false);
      } catch { res(false); }
    });
  }

  function fail(e) { idbOk = false; if (errorHandler) try { errorHandler(e); } catch { /* egal */ } }

  async function flush() {
    timer = null;
    if (!pending.size) return true;
    const batch = new Map(pending); pending.clear();
    if (batch.has("db")) batch.set("db_meta", { savedAt: Date.now() });
    if (idbOk && idb) {
      const ok = await idbPutAll(idb, batch);
      if (ok) { lsRemove(LS.db); lsRemove(LS.backups); lsRemove(LS.savedAt); return true; }
      fail(new Error("IndexedDB-Schreiben fehlgeschlagen"));
    }
    // Fallback: localStorage
    let ok = true;
    if (batch.has("db")) { ok = lsWrite(LS.db, batch.get("db")) && ok; lsWrite(LS.savedAt, Date.now()); }
    if (batch.has("backups")) ok = lsWrite(LS.backups, batch.get("backups")) && ok;
    if (!ok) fail(new Error("Lokaler Speicher voll oder gesperrt"));
    return ok;
  }
  function schedule() { if (timer == null) timer = setTimeout(flush, FLUSH_DELAY_MS); }

  const ready = (async () => {
    try {
      idb = await openDb(); idbOk = !!idb;
      let idbDb, idbMeta, idbBackups;
      if (idb) { idbDb = await idbGet(idb, "db"); idbMeta = await idbGet(idb, "db_meta"); idbBackups = await idbGet(idb, "backups"); }
      const picked = pickNewer(idbDb, idbMeta && idbMeta.savedAt, lsRead(LS.db), Number(localStorage.getItem(LS.savedAt) || 0));
      if (picked.value != null) { cache.set("db", picked.value); if (picked.source === "ls") pending.set("db", picked.value); }
      const bk = idbBackups != null ? idbBackups : lsRead(LS.backups);
      if (bk != null) { cache.set("backups", bk); if (idbBackups == null) pending.set("backups", bk); }
      if (pending.size) await flush(); // Migration localStorage -> IndexedDB, danach wird die große localStorage-Kopie entfernt
      else if (idbOk) { lsRemove(LS.db); lsRemove(LS.backups); }
    } catch (e) { fail(e); }
  })();

  /** Synchrones Lesen aus dem Speicher-Cache (nach ready). @param {string} key */
  function get(key) { return cache.get(key); }
  /** Merkt den Wert vor und schreibt verzögert. Gibt false zurück, wenn gar nichts mehr speichern kann.
   * @param {string} key @param {any} val */
  function set(key, val) {
    cache.set(key, val); pending.set(key, val);
    if (!idbOk) { // kein IndexedDB: sofort in localStorage sichern
      const ok = (key === "db" ? lsWrite(LS.db, val) && lsWrite(LS.savedAt, Date.now()) : lsWrite(LS.backups, val));
      if (ok) pending.delete(key);
      return ok;
    }
    schedule(); return true;
  }
  // Notnetz: beim Verlassen der Seite offene Änderungen zusätzlich synchron in localStorage ablegen (wenn es noch passt)
  function lastChance() {
    if (!pending.size) return;
    if (pending.has("db")) { lsWrite(LS.db, pending.get("db")); lsWrite(LS.savedAt, Date.now()); }
    flush();
  }
  if (root.addEventListener) {
    root.addEventListener("pagehide", lastChance);
    root.document && root.document.addEventListener("visibilitychange", () => { if (root.document.visibilityState === "hidden") lastChance(); });
  }

  const api = { ready, get, set, flush, pickNewer, isIdb: () => idbOk, onError: (/** @type {(e:any)=>void} */ fn) => { errorHandler = fn; } };
  root.mtStore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : /** @type {any} */ (globalThis));
