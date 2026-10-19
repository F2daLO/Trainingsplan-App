// @ts-check
/* Sync-Kern: reine Funktionen ohne DOM/Netzwerk (daher in Node testbar, siehe tests/).
 * Idee: Jede lokale Einheit merkt sich den Fingerabdruck (syncFp) und den Server-Zeitstempel (syncServerAt)
 * ihres letzten Abgleichs. So wird "lokal geändert" und "am Server geändert" unabhängig von der Geräteuhr erkannt.
 * Gelöschtes wird als Löschmarkierung (Tombstone) geführt und nicht mehr vom Server zurückgeholt. */
(function (root) {
  "use strict";
  const SESSION_COLS = ["id", "plan_id", "training_date", "training_type", "title", "description", "note", "status", "topup", "origin", "source_activity_id", "actual_summary"];
  const PLAN_COLS = ["id", "name", "description"];

  /** @param {any} v @returns {string} */
  function stableStringify(v) {
    if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
    if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
    return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
  }
  /** 53-Bit-Hash (cyrb53). @param {string} str @returns {number} */
  function hash53(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  /** Fingerabdruck über feste Spalten. @param {Record<string, any>} row @param {string[]} cols @returns {string} */
  function fingerprint(row, cols) {
    /** @type {Record<string, any>} */ const o = {};
    for (const c of cols) o[c] = row[c] === undefined ? null : row[c];
    return hash53(stableStringify(o)).toString(36);
  }
  /** @param {any} v @returns {number} */
  function ms(v) { const t = Date.parse(String(v || "")); return Number.isFinite(t) ? t : 0; }

  /**
   * Entscheidet pro Datensatz, was beim Abgleich passiert.
   * @param {{exists:boolean, fp?:string, syncFp?:string, syncServerAt?:string, updatedAt?:string, tombstone?:boolean}} local
   * @param {{exists:boolean, fp?:string, serverAt?:string, updatedAt?:string, deleted?:boolean}} remote
   * @returns {"none"|"pull"|"pull-new"|"push"|"push-new"|"push-resurrect"|"push-delete"|"adopt"|"drop-local"|"forget"|"conflict-push"|"conflict-pull"}
   */
  function decide(local, remote) {
    if (!local.exists && !remote.exists) return local.tombstone ? "forget" : "none";
    if (!local.exists) {
      if (local.tombstone) return remote.deleted ? "forget" : "push-delete";
      return remote.deleted ? "none" : "pull-new";
    }
    const dirty = local.syncFp === undefined ? true : local.fp !== local.syncFp;
    if (!remote.exists) return local.syncFp === undefined || dirty ? "push-new" : "drop-local"; // am Server (hart) gelöscht
    if (remote.deleted) return dirty ? "push-resurrect" : "drop-local";            // lokale Änderung schlägt Löschung
    if (local.syncFp === undefined) {                                               // Altbestand ohne Abgleichsstand
      if (local.fp === remote.fp) return "adopt";
      const l = ms(local.updatedAt), r = ms(remote.updatedAt);
      return l > r ? "push" : "pull";
    }
    const remoteChanged = ms(remote.serverAt) !== ms(local.syncServerAt);
    if (!dirty && !remoteChanged) return "none";
    if (local.fp === remote.fp) return "adopt";
    if (!dirty) return "pull";
    if (!remoteChanged) return "push";
    return ms(local.updatedAt) > ms(remote.updatedAt) ? "conflict-push" : "conflict-pull";
  }

  /** Entfernt Löschmarkierungen, die älter als `days` Tage sind. @param {Record<string,string>} map @param {number} days @param {number} [now] */
  function purgeTombstones(map, days, now = Date.now()) {
    let n = 0; for (const k of Object.keys(map)) if (now - ms(map[k]) > days * 864e5) { delete map[k]; n++; }
    return n;
  }
  /** Verhindert Massenlöschung bei leerer/fehlerhafter Serverantwort.
   * @param {number} dropCount @param {number} localCount @returns {boolean} true = Löschen erlaubt */
  function dropAllowed(dropCount, localCount) { return !(dropCount > 5 && dropCount > localCount * 0.5); }

  const api = { SESSION_COLS, PLAN_COLS, stableStringify, hash53, fingerprint, decide, purgeTombstones, dropAllowed };
  root.MTSync = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : /** @type {any} */ (globalThis));
