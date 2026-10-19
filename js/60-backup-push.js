const BACKUP_KEY="mt_local_backups_v60";
const BACKUP_SCHEDULE_KEY="mt_backup_schedule";
const BACKUP_LAST_KEY="mt_backup_last";
function getLocalBackups(){
  const v=mtStore.get("backups");return Array.isArray(v)?v:[];
}
function saveLocalBackups(rows){
  return mtStore.set("backups",rows.slice(0,60));
}
function backupIntervalMs(schedule){
  return {hourly:3600000,daily:86400000,weekly:604800000,monthly:2592000000,yearly:31536000000}[schedule]||0;
}
function setBackupSchedule(v){
  localStorage.setItem(BACKUP_SCHEDULE_KEY,v);
  if(v!=="manual") maybeAutoBackup();
  if(screen==="settings")renderSettings();
}
async function createBackup(reason="manual",download=false){
  const snap={id:crypto.randomUUID(),createdAt:new Date().toISOString(),reason,data:structuredClone(db)};
  const rows=getLocalBackups();rows.unshift(snap);saveLocalBackups(rows);
  localStorage.setItem(BACKUP_LAST_KEY,snap.createdAt);
  if(cloudUser&&sb){
    try{
      await sb.from("training_backups").insert({id:snap.id,user_id:cloudUser.id,reason,snapshot:snap.data,created_at:snap.createdAt});
    }catch(err){console.warn("Cloud backup unavailable",err)}
  }
  if(download){
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([JSON.stringify(snap,null,2)],{type:"application/json"}));
    a.download=`mein-training-backup-${snap.createdAt.slice(0,10)}.json`;
    a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  if(screen==="settings")renderSettings();
  return snap;
}
async function maybeAutoBackup(){
  const schedule=localStorage.getItem(BACKUP_SCHEDULE_KEY)||"daily";
  const interval=backupIntervalMs(schedule);
  if(!interval)return;
  const last=Date.parse(localStorage.getItem(BACKUP_LAST_KEY)||"0");
  if(!last||Date.now()-last>=interval) await createBackup(schedule,false);
}
function showBackups(){
  const rows=getLocalBackups();
  backupList.innerHTML=rows.length?rows.map(b=>`<div class="backup-row">
    <div><div class="backup-main">${new Date(b.createdAt).toLocaleString("de-DE")}</div><div class="backup-sub">${esc(b.reason)}</div></div>
    <div class="backup-actions"><button onclick="restoreBackup('${esc(b.id)}')">Wiederherstellen</button><button onclick="deleteBackup('${esc(b.id)}')">Löschen</button></div>
  </div>`).join(""):'<div class="empty">Noch keine Backups.</div>';
  backupDialog.showModal();
}
function restoreBackup(id){
  const b=getLocalBackups().find(x=>x.id===id);if(!b)return;
  if(!confirm("Diesen Backup-Stand wiederherstellen? Aktuelle lokale Daten werden ersetzt."))return;
  const prev=db;
  db=structuredClone(b.data);
  /* Löschmarkierungen erhalten und alles, was im Backup fehlt, als gelöscht markieren – sonst holt der Sync es zurück */
  dbTombstones();Object.assign(db.tombstones.sessions,prev.tombstones?.sessions||{});Object.assign(db.tombstones.plans,prev.tombstones?.plans||{});
  const keepS=new Set((db.sessions||[]).map(x=>x.id)),keepP=new Set((db.plans||[]).map(x=>x.id));
  (prev.sessions||[]).filter(x=>!keepS.has(x.id)).forEach(x=>markDeleted("sessions",x.id));
  (prev.plans||[]).filter(x=>!keepP.has(x.id)).forEach(x=>markDeleted("plans",x.id));
  keepS.forEach(id=>{delete db.tombstones.sessions[id]});keepP.forEach(id=>{delete db.tombstones.plans[id]});
  repairCanonicalDescriptions();
  safeSave();
  backupDialog.close();render();queueSync();
}
function deleteBackup(id){
  saveLocalBackups(getLocalBackups().filter(x=>x.id!==id));
  showBackups();
}

/* More transparent floating controls while scrolling. */
let navScrollTimer=null;
window.addEventListener("scroll",()=>{
  document.body.classList.add("nav-scrolling");
  clearTimeout(navScrollTimer);
  navScrollTimer=setTimeout(()=>document.body.classList.remove("nav-scrolling"),180);
},{passive:true});

/* Automatic backup checks. */
setInterval(maybeAutoBackup,300000);
window.addEventListener("online",maybeAutoBackup);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")maybeAutoBackup()});

/* ===== V6.1 menu flow cleanup ===== */
function closeCreateMenu(){
  document.querySelector(".create-menu-backdrop")?.remove();
  document.querySelector(".create-menu")?.remove();
}
function openCreateMenu(){
  closeCreateMenu();
  const back=document.createElement("div");
  back.className="create-menu-backdrop";
  back.onclick=closeCreateMenu;

  const menu=document.createElement("div");
  menu.className="create-menu glass";
  menu.innerHTML=`
    <button onclick="closeCreateMenu();openNewEvent()">＋ Neues Event</button>
    <button onclick="closeCreateMenu();openNewBlock()">＋ Neuer Block</button>
    <button onclick="closeCreateMenu();openImport()">⇧ Importieren</button>
    <button onclick="closeCreateMenu()">Abbrechen</button>`;
  document.body.append(back,menu);
}

/* Always close the action menu after a terminal action. */
function runMenuAction(fn){
  try{ fn(); }
  finally{ closeQuickMenu(); }
}

/* Replace the action menu with guaranteed close/forward behavior. */


/* ===== V6.3 Web Push / Reminder client ===== */
function b64UrlToUint8Array(base64String){
  const padding="=".repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
}
function isAppleMobileDevice(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
}
function isStandaloneWebApp(){
  return window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone===true;
}
function pushSupported(){
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}
async function currentPushSubscription(){
  if(!pushSupported())return null;
  const reg=await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription();
}
async function refreshPushStatus(){
  const el=document.getElementById("pushDeviceStatus");
  if(!el)return;
  if(!isAppleMobileDevice()){
    el.className="push-status";
    el.innerHTML='<span class="push-dot"></span><span>Desktop-Push ist für diese App bewusst deaktiviert.</span>';
    return;
  }
  if(!isStandaloneWebApp()){
    el.className="push-status off";
    el.innerHTML='<span class="push-dot"></span><span>Bitte diese Web-App zuerst zum Home-Bildschirm hinzufügen.</span>';
    return;
  }
  if(!pushSupported()){
    el.className="push-status off";
    el.innerHTML='<span class="push-dot"></span><span>Web Push wird auf diesem Gerät nicht unterstützt.</span>';
    return;
  }
  const sub=await currentPushSubscription();
  if(Notification.permission==="granted" && sub){
    el.className="push-status on";
    el.innerHTML='<span class="push-dot"></span><span>Mitteilungen auf diesem Gerät sind aktiv.</span>';
  }else if(Notification.permission==="denied"){
    el.className="push-status off";
    el.innerHTML='<span class="push-dot"></span><span>Mitteilungen wurden in iOS/iPadOS abgelehnt. Bitte in Einstellungen → Mitteilungen → Training erlauben.</span>';
  }else{
    el.className="push-status";
    el.innerHTML='<span class="push-dot"></span><span>Mitteilungen auf diesem Gerät sind noch nicht aktiviert.</span>';
  }
}
async function enablePushOnThisDevice(){
  try{
    if(!cloudUser){alert("Bitte zuerst bei der Cloud anmelden.");return}
    if(!isAppleMobileDevice()){alert("Push ist in dieser App nur für iPhone und iPad vorgesehen.");return}
    if(!isStandaloneWebApp()){alert('Bitte "Training" zuerst über Safari → Teilen → Zum Home-Bildschirm installieren und dann von dort öffnen.');return}
    if(!pushSupported()){alert("Web Push wird auf diesem Gerät nicht unterstützt.");return}

    const permission=await Notification.requestPermission();
    if(permission!=="granted"){await refreshPushStatus();return}

    const reg=await navigator.serviceWorker.ready;
    let sub=await reg.pushManager.getSubscription();
    const storedKeyVersion=localStorage.getItem("mt_push_key_version");
    if(sub && storedKeyVersion!==PUSH_KEY_VERSION){
      try{ await sub.unsubscribe(); }catch{}
      sub=null;
    }
    if(!sub){
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:b64UrlToUint8Array(VAPID_PUBLIC_KEY)
      });
      localStorage.setItem("mt_push_key_version",PUSH_KEY_VERSION);
    }
    const j=sub.toJSON();
    const row={
      user_id:cloudUser.id,
      endpoint:j.endpoint,
      p256dh:j.keys?.p256dh||"",
      auth:j.keys?.auth||"",
      device_label:isAppleMobileDevice() ? (/iPad/.test(navigator.userAgent)?"iPad":"iPhone") : "Gerät",
      enabled:true,
      updated_at:new Date().toISOString()
    };
    const {error}=await sb.from("push_subscriptions").upsert(row,{onConflict:"endpoint"});
    if(error)throw error;

    const pref={user_id:cloudUser.id,enabled:true,reminder_time:"18:00",timezone:"Europe/Vienna",updated_at:new Date().toISOString()};
    const {error:pe}=await sb.from("reminder_preferences").upsert(pref,{onConflict:"user_id"});
    if(pe)throw pe;

    await refreshPushStatus();
    alert("Mitteilungen sind auf diesem Gerät aktiviert.");
  }catch(err){
    console.error(err);
    alert("Mitteilungen konnten nicht aktiviert werden: "+(err?.message||err));
  }
}
async function disablePushOnThisDevice(){
  try{
    if(!pushSupported())return;
    const sub=await currentPushSubscription();
    if(sub){
      if(cloudUser){
        await sb.from("push_subscriptions").update({enabled:false,updated_at:new Date().toISOString()}).eq("endpoint",sub.endpoint);
      }
      await sub.unsubscribe();
    }
    await refreshPushStatus();
  }catch(err){
    alert("Deaktivieren fehlgeschlagen: "+(err?.message||err));
  }
}
async function sendTestPush(){
  if(!cloudUser){alert("Bitte zuerst bei der Cloud anmelden.");return}
  const sub=await currentPushSubscription();
  if(!sub){alert("Bitte Mitteilungen zuerst auf diesem Gerät aktivieren.");return}
  try{
    const {data:{session}}=await sb.auth.getSession();
    const url=`${SUPABASE_URL}/functions/v1/test-push`;
    const res=await fetch(url,{
      method:"POST",
      mode:"cors",
      cache:"no-store",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${session.access_token}`,
        "apikey":SUPABASE_PUBLISHABLE_KEY
      },
      body:JSON.stringify({endpoint:sub.endpoint})
    });
    const text=await res.text();
    let body={};
    try{body=text?JSON.parse(text):{}}catch{body={raw:text}}
    if(!res.ok)throw new Error(body.error||body.raw||`HTTP ${res.status}`);
    alert("Test-Mitteilung wurde versendet.");
  }catch(err){
    alert("Test fehlgeschlagen: "+(err?.message||err));
  }
}



/* ===== V6.4 Equipment profiles ===== */
