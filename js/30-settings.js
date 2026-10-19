function renderSettings(){
 const schedule=localStorage.getItem(BACKUP_SCHEDULE_KEY)||"daily";
 const backups=getLocalBackups();
 const last=backups[0]?.createdAt;

 main.innerHTML=head("Einstellungen")+`
 <div class="settings-accordion">

  <section class="settings-section glass" data-settings-section="cloud">
   <button class="settings-section-head" type="button" onclick="toggleSettingsSection('cloud')">
    <div class="settings-section-title">
      <span class="emoji">☁️</span>
      <div><strong>Cloud</strong><div class="settings-section-sub">Anmeldung & Synchronisierung</div></div>
    </div>
    <div class="settings-section-right"><span class="settings-chevron">›</span></div>
   </button>
   <div class="settings-section-body">
    <p id="settingsCloud">Status wird geprüft …</p>
    ${cloudUser?'<button class="pill" onclick="syncCloud(true)">Jetzt synchronisieren</button> <button class="pill" onclick="logout()">Abmelden</button>':'<button class="pill primary" onclick="loginDialog.showModal()">Mit E-Mail + Passwort anmelden</button>'}
   </div>
  </section>

  <section class="settings-section glass" data-settings-section="appearance">
   <button class="settings-section-head" type="button" onclick="toggleSettingsSection('appearance')">
    <div class="settings-section-title">
      <span class="emoji">◐</span>
      <div><strong>Darstellung</strong><div class="settings-section-sub" id="appearanceSettingsSub">${appearanceLabel()}</div></div>
    </div>
    <div class="settings-section-right"><span class="settings-chevron">›</span></div>
   </button>
   <div class="settings-section-body">
    <p class="muted">Farbdarstellung der gesamten App. „Systemseitig“ folgt automatisch der Einstellung von iPhone, iPad oder Computer.</p>
    <div class="appearance-choice">
      <button type="button" data-appearance="light" onclick="setAppearance('light')"><span>☀︎</span>Hell</button>
      <button type="button" data-appearance="dark" onclick="setAppearance('dark')"><span>☾</span>Dunkel</button>
      <button type="button" data-appearance="system" onclick="setAppearance('system')"><span>◐</span>Systemseitig</button>
    </div>
   </div>
  </section>

  <section class="settings-section glass" data-settings-section="structure">
   <button class="settings-section-head" type="button" onclick="toggleSettingsSection('structure')">
    <div class="settings-section-title">
      <span class="emoji">🗂</span>
      <div><strong>Trainingsstruktur</strong><div class="settings-section-sub">Events, Blöcke & Import</div></div>
    </div>
    <div class="settings-section-right"><span class="settings-chevron">›</span></div>
   </button>
   <div class="settings-section-body">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="pill primary" onclick="openNewEvent()">＋ Event</button>
      <button class="pill" onclick="openNewBlock()">＋ Block</button>
      <button class="pill" onclick="openImport()">⇧ Import</button>
    </div>
   </div>
  </section>

  <section class="settings-section glass" data-settings-section="coach">
   <button class="settings-section-head" type="button" onclick="toggleSettingsSection('coach'); setTimeout(renderCoachSettingsPanel,0)">
    <div class="settings-section-title">
      <span class="emoji">✦</span>
      <div><strong>My Trainings Coach</strong><div class="settings-section-sub">FTP, Planfortsetzung & Intervals.icu-Trainingsdaten</div></div>
    </div>
    <div class="settings-section-right"><span class="settings-chevron">›</span></div>
   </button>
   <div class="settings-section-body">
    <div id="coachSettingsContent"><div class="eq-small">Coach-Daten werden geladen …</div></div>
   </div>
  </section>

  <section class="settings-section glass" data-settings-section="equipment">
   <div class="settings-section-head" role="button" tabindex="0" onclick="toggleSettingsSection('equipment')">
    <div class="settings-section-title">
      <span class="emoji">🧰</span>
      <div><strong>Gerätesetup & Equipment</strong><div class="settings-section-sub">Ausrüstung, Kilometer & Wartung</div></div>
    </div>
    <div class="settings-section-right">
      <button type="button" class="settings-inline-plus" onclick="event.stopPropagation();openEquipmentEditor()" aria-label="Equipment hinzufügen">＋</button>
      <span class="settings-chevron">›</span>
    </div>
   </div>
   <div class="settings-section-body">
    <div style="margin-top:12px;display:flex;justify-content:flex-end">
      <button class="pill" type="button" onclick="syncAllNow(true)">Alles synchronisieren</button>
    </div>
    <div id="equipmentList" style="margin-top:12px"></div>
   </div>
  </section>

  <section class="settings-section glass" data-settings-section="reminders">
   <button class="settings-section-head" type="button" onclick="toggleSettingsSection('reminders')">
    <div class="settings-section-title">
      <span class="emoji">🔔</span>
      <div><strong>Erinnerungen</strong><div class="settings-section-sub">iPhone/iPad Push · 18:00</div></div>
    </div>
    <div class="settings-section-right"><span class="settings-chevron">›</span></div>
   </button>
   <div class="settings-section-body">
    <p>Heute Training hat Vorrang; an trainingsfreien Tagen wird an morgen erinnert.</p>
    <div id="pushDeviceStatus" class="push-status"><span class="push-dot"></span><span>Status wird geprüft …</span></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="pill primary" onclick="enablePushOnThisDevice()">Mitteilungen aktivieren</button>
      <button class="pill" onclick="sendTestPush()">Test-Mitteilung</button>
      <button class="pill" onclick="disablePushOnThisDevice()">Auf diesem Gerät deaktivieren</button>
    </div>
   </div>
  </section>

  <section class="settings-section glass" data-settings-section="backup">
   <button class="settings-section-head" type="button" onclick="toggleSettingsSection('backup')">
    <div class="settings-section-title">
      <span class="emoji">💾</span>
      <div><strong>Backups</strong><div class="settings-section-sub">${schedule==="manual"?"manuell":schedule==="hourly"?"stündlich":schedule==="daily"?"täglich":schedule==="weekly"?"wöchentlich":schedule==="monthly"?"monatlich":"jährlich"}${last?" · "+new Date(last).toLocaleDateString("de-DE"):""}</div></div>
    </div>
    <div class="settings-section-right"><span class="settings-chevron">›</span></div>
   </button>
   <div class="settings-section-body">
    <label style="margin-top:12px">Automatik
      <select id="backupScheduleSelect" onchange="setBackupSchedule(this.value)">
        <option value="manual" ${schedule==="manual"?"selected":""}>Nur manuell</option>
        <option value="hourly" ${schedule==="hourly"?"selected":""}>Stündlich</option>
        <option value="daily" ${schedule==="daily"?"selected":""}>Täglich</option>
        <option value="weekly" ${schedule==="weekly"?"selected":""}>Wöchentlich</option>
        <option value="monthly" ${schedule==="monthly"?"selected":""}>Monatlich</option>
        <option value="yearly" ${schedule==="yearly"?"selected":""}>Jährlich</option>
      </select>
    </label>
    <div style="margin-top:12px">
      <button class="pill primary" onclick="createBackup('manual',true)">Jetzt sichern</button>
      <button class="pill" onclick="showBackups()">Backups verwalten (${backups.length})</button>
    </div>
   </div>
  </section>

  <section class="settings-section glass" data-settings-section="tutorial">
   <button class="settings-section-head" type="button" onclick="toggleSettingsSection('tutorial'); setTimeout(()=>{loadIntervalsConnectionStatus();loadIgpsportStatus()},0)">
    <div class="settings-section-title">
      <span class="emoji">🧭</span>
      <div><strong>Erste Einrichtung & Tutorial</strong><div class="settings-section-sub">App, Intervals.icu, Datenquellen & erster Start</div></div>
    </div>
    <div class="settings-section-right"><span class="settings-chevron">›</span></div>
   </button>
   <div class="settings-section-body">
    <div class="tutorial-steps">
      <div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">1</span><div><strong>App-Konto</strong><p>In My Training mit E-Mail und Passwort anmelden. Jeder Benutzer hat seinen eigenen Plan, Equipment, Auswertungen und Coach-Daten.</p><div class="tutorial-links"><a class="pill" href="https://f2dalo.github.io/Trainingsplan-App/" target="_blank" rel="noopener">App im Browser öffnen</a></div></div></div></div>
      <div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">2</span><div><strong>Intervals.icu kostenlos registrieren</strong><p>Intervals.icu ist die Trainingsdaten-Drehscheibe. Kostenloses Konto erstellen und anmelden. Danach unter Einstellungen ganz unten im Bereich „Developer Settings“ die persönliche Athlete ID und einen API Key erzeugen.</p><div class="tutorial-links"><a class="pill" href="https://www.intervals.icu/" target="_blank" rel="noopener">Intervals.icu öffnen</a><a class="pill" href="https://intervals.icu/settings" target="_blank" rel="noopener">Intervals Einstellungen</a></div></div></div></div>
      <div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">3</span><div><strong>Intervals.icu einmalig mit dieser App verbinden</strong><p>Athlete ID und API Key unten eintragen. Der Schlüssel wird direkt an die geschützte Serverfunktion übertragen und nicht im Browser oder in localStorage gespeichert. Danach verwendet jeder App-Benutzer ausschließlich sein eigenes Intervals.icu-Konto.</p></div></div>
       <div class="intervals-connect-box"><div id="intervalsConnectionStatus" class="intervals-status">Verbindungsstatus wird geprüft …</div><div class="intervals-connect-grid"><label>Athlete ID<input id="intervalsAthleteInput" autocomplete="off" placeholder="z. B. i123456"></label><label>Persönlicher API Key<input id="intervalsApiKeyInput" type="password" autocomplete="new-password" placeholder="nur einmal zum Verbinden"></label></div><div class="tutorial-links"><button class="pill primary" onclick="connectOwnIntervals()">Intervals.icu verbinden</button><button class="pill" onclick="disconnectOwnIntervals()">Verbindung trennen</button></div><div class="tutorial-note">Der API Key gehört immer dem gerade angemeldeten Benutzer. Niemals den Schlüssel einer anderen Person verwenden.</div></div>
      </div>
      <div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">4</span><div><strong>Aktivitätsquellen verbinden</strong><p>Die App übernimmt Aktivitäten automatisch aus dem persönlichen Intervals.icu-Konto. Verbinde dort die Plattformen, die du tatsächlich verwendest. iGPSPORT kann zusätzlich direkt über unseren Server angebunden werden.</p></div></div>
<div class="source-provider-grid">
 <div class="source-provider"><strong>Zwift</strong><span>Direkt mit Intervals.icu verbinden. Neue Zwift-Aktivitäten werden danach automatisch übernommen.</span><button class="pill" onclick="openIntervalsConnections()">In Intervals.icu verbinden</button></div>
 <div class="source-provider"><strong>MyWhoosh</strong><span>Direkte Intervals.icu-Integration verwenden. Trainings und Aktivitäten können zwischen den Plattformen synchronisiert werden.</span><button class="pill" onclick="openIntervalsConnections()">In Intervals.icu verbinden</button></div>
 <div class="source-provider"><strong>Garmin Connect</strong><span>Garmin direkt mit Intervals.icu verbinden. Für Garmin-Geräte ist dies der bevorzugte Datenweg.</span><button class="pill" onclick="openIntervalsConnections()">In Intervals.icu verbinden</button></div>
 <div class="source-provider"><strong>Suunto</strong><span>Suunto direkt in Intervals.icu verbinden; Aktivitäten werden anschließend von der App übernommen.</span><button class="pill" onclick="openIntervalsConnections()">In Intervals.icu verbinden</button></div>
 <div class="source-provider"><strong>ROUVY</strong><span>ROUVY direkt in Intervals.icu verbinden; abgeschlossene Indoor-Einheiten fließen danach automatisch ein.</span><button class="pill" onclick="openIntervalsConnections()">In Intervals.icu verbinden</button></div>
 <div class="source-provider"><strong>Strava</strong><span>Kann mit Intervals.icu verbunden werden. Wenn Garmin, Zwift, MyWhoosh, Suunto oder ROUVY direkt verfügbar sind, diese als Originalquelle bevorzugen, um Datenverluste und Dubletten zu vermeiden.</span><button class="pill" onclick="openIntervalsConnections()">In Intervals.icu verbinden</button></div>
 <div class="source-provider"><strong>QZ</strong><span>QZ ist eine Brücke für kompatible Trainer/Apps. Die Aktivität muss anschließend in Intervals.icu ankommen; die App übernimmt sie von dort.</span></div>
 <div class="source-provider"><strong>iGPSPORT / BSC500</strong><span>Optional direkte Serververbindung für iGPSPORT-Geräte.</span>
 <div id="igpsConnectionStatus" class="intervals-status">iGPSPORT-Status wird geprüft …</div>
 <div class="intervals-connect-grid"><label>iGPSPORT Konto<input id="igpsUserInput" autocomplete="username" placeholder="E-Mail / Benutzername"></label><label>iGPSPORT Passwort<input id="igpsPasswordInput" type="password" autocomplete="new-password" placeholder="nur einmal zum Verbinden"></label></div>
 <label>Region<select id="igpsRegionInput"><option value="intl">International / Europa</option><option value="cn">China</option></select></label>
 <div class="tutorial-links"><button class="pill primary" onclick="connectIgpsport()">iGPSPORT verbinden</button><button class="pill" onclick="disconnectIgpsport()">Verbindung trennen</button></div>
 <div class="tutorial-note">Die iGPSPORT-Zugangsdaten werden serverseitig verschlüsselt gespeichert. Diese Anbindung verwendet eine inoffizielle Cloud-Schnittstelle.</div></div>
</div></div></div>
      
<div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">5</span><div><strong>Plan erstellen oder fortsetzen</strong>
<p>Du brauchst keinen fertigen Import. My Trainings Coach kann einen neuen Trainingsplan oder die Fortsetzung eines bestehenden Plans direkt für dich erstellen.</p></div></div>
<div class="tutorial-example"><b>Neuer Plan:</b> Gib Ziel/Event, Datum, Sportart, aktuellen Trainingsstand, verfügbare Trainingstage und vorhandenes Equipment an. Daraus kann ein neuer Plan mit Blöcken und Einheiten aufgebaut werden.</div>
<div class="tutorial-example"><b>Fortsetzung:</b> Wenn bereits ein Plan vorhanden ist, kann My Trainings Coach ab dem aktuellen Stand weiterplanen. Bereits absolvierte Einheiten, Entwicklung, Zieltermin und verfügbare Zeit werden dabei als Grundlage verwendet.</div>
<div class="tutorial-note">Importdateien sind deshalb optional: Sie eignen sich zum Übernehmen vorhandener Pläne oder als Vorlage, sind aber keine Voraussetzung für einen neuen oder fortgesetzten Trainingsplan.</div>
</div>
<div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">6</span><div><strong>Beispieldateien herunterladen</strong>
<p>Die in dieser Anleitung erwähnten Beispiele kannst du direkt hier herunterladen und anschließend unter Einstellungen → Import verwenden.</p></div></div>
<div class="tutorial-links">
<button class="pill" type="button" onclick="downloadAppExample('import')">⬇ Import-Beispiel (CSV)</button>
<button class="pill" type="button" onclick="downloadAppExample('plan')">⬇ Planpaket-Beispiel (JSON)</button>
</div>
</div>
<div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">7</span><div><strong>Equipment anlegen</strong><p>Unter „Gerätesetup & Equipment“ Outdoor-Rad, Indoor-Trainer oder andere Geräte mit Gültig-ab-Datum anlegen. So bleiben spätere Gerätewechsel historisch korrekt.</p></div></div></div>
      <div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">8</span><div><strong>Trainingsplan anlegen oder importieren</strong><p>Event und Trainingsblöcke selbst anlegen oder über „Trainingsstruktur → Import“ importieren. Die beiden Beispiele aus dem Release-Paket zeigen CSV- und Planpaket-Format.</p><div class="tutorial-example">CSV: Event; Block; Datum; Trainingsart; Titel; Beschreibung …&#10;JSON: mein-training.plan-package.v1 mit Event, Plan, Blöcken und Einheiten</div></div></div></div>
      <div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">9</span><div><strong>Auswertung & My Trainings Coach</strong><p>„Einzelne Einheiten“ zeigt die echten importierten Aktivitäten. „Entwicklung“ vergleicht Zeiträume. My Trainings Coach verwendet Plan + tatsächlich importierte Ist-Daten für die weitere Planung.</p></div></div></div>
      <div class="tutorial-step"><div class="tutorial-step-head"><span class="tutorial-no">10</span><div><strong>Mitteilungen</strong><p>Auf jedem gewünschten Gerät separat unter „Erinnerungen“ aktivieren und mit einer Test-Mitteilung prüfen.</p></div></div></div>
    </div>
   </div>
  </section>

 </div>`;
 setTimeout(()=>{renderCoachSettingsPanel(); if(!coachState.loaded)loadCoachState();},0);
}

function updateCloud(){
 const text=!navigator.onLine?"⚠️ Offline":syncing?"☁️ Synchronisierung …":cloudUser?(lastSync?`☁️ Synchronisiert · ${new Date(lastSync).toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}`:`☁️ Verbunden`):"☁️ Nicht angemeldet";
 const el=document.getElementById("cloudStatus");if(el)el.textContent=text;const se=document.getElementById("settingsCloud");if(se)se.textContent=text
}
function exportBackup(){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:"application/json"}));a.download="mein-training-backup.json";a.click();URL.revokeObjectURL(a.href)}
