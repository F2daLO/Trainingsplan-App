/* Barrierefreiheit (v6.54): ergänzt nachträglich Rollen, Tastaturbedienung und Beschriftungen.
 * Die App baut ihre Oberfläche per innerHTML; deshalb wird per MutationObserver nachgezogen. */
(function () {
  "use strict";
  const NATIVE = "button,a[href],input,select,textarea,summary,label,option,[role=button],[role=tab],[role=link],[role=menuitem],[role=checkbox],[role=switch]";
  const labelFromContent = el => (el.getAttribute("title") || el.getAttribute("data-label") || "").trim();

  function enhance(root) {
    try {
      // 1) Klickbare Nicht-Buttons (div/span mit onclick) -> Rolle + Fokus
      root.querySelectorAll("[onclick]:not(" + NATIVE.split(",").map(s => s.trim()).join("):not(") + ")").forEach(el => {
        el.setAttribute("role", "button");
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      });
      // 2) Reine Symbol-Buttons ohne Text -> aria-label aus title
      root.querySelectorAll("button:not([aria-label]),[role=button]:not([aria-label])").forEach(el => {
        const text = (el.textContent || "").replace(/[\s ]+/g, "");
        if (text.length <= 1) { const l = labelFromContent(el); if (l) el.setAttribute("aria-label", l); }
      });
      // 3) Dialog-/Overlay-Elemente
      root.querySelectorAll("dialog:not([aria-labelledby]):not([aria-label])").forEach(d => {
        const h = d.querySelector("h1,h2,h3"); if (h) { if (!h.id) h.id = "dlg-" + Math.random().toString(36).slice(2, 8); d.setAttribute("aria-labelledby", h.id); }
      });
      // 4) Statusmeldungen vorlesen lassen
      root.querySelectorAll("#loginStatus,#cloudStatus,.activity-source,.tutorial-check,.gpt-error").forEach(el => {
        if (!el.hasAttribute("aria-live")) el.setAttribute("aria-live", "polite");
      });
      // 5) Navigation benennen
      const nav = document.querySelector("nav.nav"); if (nav && !nav.hasAttribute("aria-label")) nav.setAttribute("aria-label", "Hauptnavigation");
      const main = document.getElementById("main"); if (main && !main.hasAttribute("aria-live")) { main.setAttribute("tabindex", "-1"); }
      // 6) aktive Navigation markieren
      document.querySelectorAll("nav.nav button").forEach(b => { if (b.classList.contains("active")) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    } catch (e) { console.warn("a11y", e); }
  }

  // Enter/Leertaste lösen Klick auf role=button-Elemente aus
  document.addEventListener("keydown", e => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t || !t.getAttribute || t.getAttribute("role") !== "button" || t.tagName === "BUTTON") return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); t.click(); }
  });
  // Escape schließt offene Menüs/Sheets der App (falls vorhanden)
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const closers = ["closeQuickMenu", "closeInfoSheet", "closeCreateMenu", "closeEquipmentInfo", "closeEquipmentActions", "closeGPTExplanation"];
    for (const fn of closers) { try { if (typeof window[fn] === "function") window[fn](); } catch { /* egal */ } }
  });

  let queued = false;
  const run = () => { queued = false; enhance(document); };
  const schedule = () => { if (!queued) { queued = true; (window.requestAnimationFrame || setTimeout)(run); } };
  const start = () => { enhance(document); new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
