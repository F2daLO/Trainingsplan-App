function packDesc(s){
  return "__MT__"+JSON.stringify({
    desc:s.desc||"",
    scheduledAt:s.scheduledAt||s.date+"T19:00",
    originalDate:s.originalDate||null,
    gptExplanation:s.gptExplanation||null,
    gptExplanationKey:s.gptExplanationKey||null,
    ...(s.workout?{workout:s.workout}:{})
  });
}
function unpackDesc(v){if(String(v||"").startsWith("__MT__")){try{return JSON.parse(String(v).slice(6))}catch{}}return{desc:v||"",scheduledAt:null}}
function planRemote(p){return{id:p.id,user_id:cloudUser.id,name:p.name,description:"__MTP__"+JSON.stringify({eventId:p.eventId,focus:p.focus||"",description:p.description||"",eventName:db.events.find(e=>e.id===p.eventId)?.name||""})}}
function planLocal(r){let meta={};if(String(r.description||"").startsWith("__MTP__"))try{meta=JSON.parse(String(r.description).slice(7))}catch{};if(meta.eventId&&!db.events.some(e=>e.id===meta.eventId))db.events.push({id:meta.eventId,name:meta.eventName||"Event",description:""});return{id:r.id,eventId:meta.eventId||db.activeEvent,name:r.name,focus:meta.focus||"",description:meta.description||""}}
function sessionRemote(s){return{id:s.id,user_id:cloudUser.id,plan_id:s.planId,training_date:s.date,training_type:s.type||"",title:s.title||"",description:packDesc(s),note:s.note||"",status:s.status||"open",topup:!!s.topup,reminder:"auto",reminder_time:"18:00",origin:s.origin||"planned",source_activity_id:s.sourceActivityId||null,actual_summary:s.actualSummary||null,updated_at:s.updatedAt||"2026-08-17T00:00:00.000Z"}}
function sessionLocal(r){
 const d=unpackDesc(r.description);
 const canonical=CANONICAL_PLAN_DESCRIPTIONS[r.id];
 let desc=d.desc||"";
 let note=r.note||"";
 let updatedAt=r.updated_at||"2026-08-17T00:00:00.000Z";
 if(canonical!==undefined && desc!==canonical){
   if(desc.trim() && !note.trim()) note=desc;
   else if(desc.trim() && note.trim() && !note.includes(desc)) note=note+"\n"+desc;
   desc=canonical;
   updatedAt=new Date().toISOString();
 }
 return{id:r.id,planId:r.plan_id,date:r.training_date,scheduledAt:d.scheduledAt||r.training_date+"T19:00",originalDate:d.originalDate||null,gptExplanation:d.gptExplanation||null,gptExplanationKey:d.gptExplanationKey||null,...(d.workout?{workout:d.workout}:{}),type:r.training_type||"",title:r.title||"",desc,note,status:r.status||"open",topup:!!r.topup,origin:r.origin||"planned",sourceActivityId:r.source_activity_id||null,actualSummary:r.actual_summary||null,reminder:"auto",reminderTime:"18:00",updatedAt};
}

function makeClient(){
 const remember=localStorage.getItem("mt_remember")!=="false",store=remember?localStorage:sessionStorage;
 return window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:{getItem:k=>store.getItem(k),setItem:(k,v)=>store.setItem(k,v),removeItem:k=>store.removeItem(k)},storageKey:"mt-auth-v51"}})
}

async function login(e){
 e.preventDefault();loginStatus.textContent="Anmeldung …";localStorage.setItem("mt_remember",String(rememberLogin.checked));sb=makeClient();
 const {data,error}=await sb.auth.signInWithPassword({email:loginEmail.value.trim(),password:loginPassword.value});if(error){loginStatus.textContent=error.message;return}
 cloudUser=data.session?.user||data.user;await prepareEmptyNewUser();loginDialog.close();await syncCloud(false);render()
}

async function logout(){await sb.auth.signOut();cloudUser=null;render()}
async function signup(){
 const email=loginEmail.value.trim(),password=loginPassword.value;
 if(!email||!password){loginStatus.textContent="Bitte E-Mail und Passwort eingeben.";return}
 if(password.length<8){loginStatus.textContent="Das Passwort muss mindestens 8 Zeichen haben.";return}
 loginStatus.textContent="Konto wird erstellt …";sb=makeClient();
 const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
 if(error){loginStatus.textContent=error.message;return}
 if(data?.session){
   cloudUser=data.user;await prepareEmptyNewUser();loginDialog.close();await syncCloud(false);render();
 }else{
   loginStatus.textContent="Konto erstellt. Bitte den Bestätigungslink in der E-Mail öffnen und danach anmelden.";
 }
}
function looksLikeBundledDemoPlan(){
 return db?.events?.some(e=>e.id==="event-mondsee-2027") || db?.plans?.some(p=>p.id==="MONDSEE-B1");
}
async function prepareEmptyNewUser(){
 if(!cloudUser||!sb)return;
 try{
   const {data,error}=await sb.from("training_plans").select("id").limit(1);
   if(error)throw error;
   if((data||[]).length===0 && looksLikeBundledDemoPlan()){
     db={events:[],plans:[],sessions:[],activeEvent:null,activePlan:null};
     safeSave();
   }
 }catch(e){console.error("New-user preparation",e)}
}


function migrateLocalPlanIds(){
 if(!cloudUser)return;
 const p=db.plans.find(x=>x.id===LOCAL_BLOCK_ID);
 if(p){const old=p.id;p.id=cloudUser.id;db.sessions.forEach(s=>{if(s.planId===old)s.planId=p.id});if(db.activePlan===old)db.activePlan=p.id;safeSave()}
}
/* ===== v6.54 Sync mit Löschmarkierungen und Abgleichsstand (siehe js/02-sync-core.js) ===== */
let syncCaps=null;
async function detectSyncCaps(){
 if(syncCaps)return syncCaps;
 const r=await sb.from("training_sessions").select("server_updated_at,deleted_at").limit(1);
 syncCaps={tombstones:!r.error};
 if(r.error)console.warn("Sync: Löschmarkierungen am Server noch nicht verfügbar (Migration 20261019130000 fehlt). Fallback: hartes Löschen.");
 return syncCaps;
}
function dbTombstones(){
 db.tombstones=db.tombstones||{};db.tombstones.sessions=db.tombstones.sessions||{};db.tombstones.plans=db.tombstones.plans||{};
 return db.tombstones;
}
function markDeleted(kind,ids){
 const t=dbTombstones()[kind],at=new Date().toISOString();
 [].concat(ids).forEach(id=>{if(id!=null)t[String(id)]=at});
}
function sessionFp(s){return MTSync.fingerprint(sessionRemote(s),MTSync.SESSION_COLS)}
function planFp(p){return MTSync.fingerprint(planRemote(p),MTSync.PLAN_COLS)}
function recordSyncConflict(id,kept,local){
 db.syncConflicts=db.syncConflicts||[];
 db.syncConflicts.unshift({id,at:new Date().toISOString(),kept,local:{title:local?.title,date:local?.date,note:local?.note,status:local?.status}});
 db.syncConflicts.length=Math.min(db.syncConflicts.length,20);
}
async function syncCloud(show=false){
 if(syncing||!cloudUser||!navigator.onLine)return;syncing=true;updateCloud();
 const report={pulled:0,pushed:0,deleted:0,conflicts:0};
 try{
  migrateLocalPlanIds();
  const caps=await detectSyncCaps();
  const [pr,sr]=await Promise.all([sb.from("training_plans").select("*"),sb.from("training_sessions").select("*")]);
  if(pr.error)throw pr.error;if(sr.error)throw sr.error;
  const tomb=dbTombstones(),alive=r=>caps.tombstones?{...r,deleted_at:null}:r;
  MTSync.purgeTombstones(tomb.sessions,60);MTSync.purgeTombstones(tomb.plans,60);

  /* ---- Pläne ---- */
  const remotePlans=new Map((pr.data||[]).map(r=>[r.id,r])),pushPlans=[];
  for(const r of pr.data||[]){
   const local=db.plans.find(p=>p.id===r.id);
   if(r.deleted_at){
    if(local){
     const clean=local.syncFp!==undefined&&planFp(local)===local.syncFp&&!db.sessions.some(s=>s.planId===local.id);
     if(clean){db.plans=db.plans.filter(p=>p.id!==local.id);report.deleted++}else pushPlans.push(local); // lokale Daten gewinnen
    }
    continue;
   }
   if(!local){if(!tomb.plans[r.id]){const p=planLocal(r);p.syncFp=planFp(p);db.plans.push(p);report.pulled++}continue}
   if(local.syncFp===undefined||planFp(local)!==local.syncFp)pushPlans.push(local);
   else{const rp=planLocal(r);if(planFp(rp)!==planFp(local)){Object.assign(local,rp,{syncFp:planFp(rp)});report.pulled++}}
  }
  for(const p of db.plans)if(!remotePlans.has(p.id)&&!tomb.plans[p.id]&&!pushPlans.includes(p))pushPlans.push(p);
  if(pushPlans.length){
   const {error}=await sb.from("training_plans").upsert(pushPlans.map(p=>alive(planRemote(p))),{onConflict:"id"});if(error)throw error;
   pushPlans.forEach(p=>{p.syncFp=planFp(p)});report.pushed+=pushPlans.length;
  }

  /* ---- Einheiten ---- */
  const remoteMap=new Map((sr.data||[]).map(r=>[r.id,r])),localMap=new Map(db.sessions.map(s=>[s.id,s]));
  const pushSessions=[],dropIds=[],deleteIds=[],ids=new Set([...remoteMap.keys(),...localMap.keys(),...Object.keys(tomb.sessions)]);
  for(const id of ids){
   const r=remoteMap.get(id),s=localMap.get(id),remoteS=r&&!r.deleted_at?sessionLocal(r):null,serverAt=r?(r.server_updated_at||r.updated_at):undefined;
   const act=MTSync.decide(
    {exists:!!s,fp:s?sessionFp(s):undefined,syncFp:s?.syncFp,syncServerAt:s?.syncServerAt,updatedAt:s?.updatedAt,tombstone:!!tomb.sessions[id]},
    {exists:!!r,fp:remoteS?sessionFp(remoteS):undefined,serverAt,updatedAt:r?.updated_at,deleted:!!r?.deleted_at});
   const take=()=>{remoteS.syncFp=sessionFp(remoteS);remoteS.syncServerAt=serverAt;const i=db.sessions.findIndex(x=>x.id===id);if(i<0)db.sessions.push(remoteS);else db.sessions[i]=remoteS;report.pulled++};
   switch(act){
    case "pull":case "pull-new":take();break;
    case "conflict-pull":recordSyncConflict(id,"server",s);report.conflicts++;take();break;
    case "push":case "push-new":case "push-resurrect":pushSessions.push(s);break;
    case "conflict-push":recordSyncConflict(id,"lokal",s);report.conflicts++;pushSessions.push(s);break;
    case "adopt":s.syncFp=sessionFp(s);s.syncServerAt=serverAt;break;
    case "drop-local":dropIds.push(id);break;
    case "push-delete":deleteIds.push(id);break;
    case "forget":delete tomb.sessions[id];break;
   }
  }
  if(dropIds.length){
   if(MTSync.dropAllowed(dropIds.length,db.sessions.length)){const gone=new Set(dropIds);db.sessions=db.sessions.filter(s=>!gone.has(s.id));report.deleted+=dropIds.length}
   else console.warn("Sync: Massenlöschung ("+dropIds.length+" Einheiten) verhindert – Serverantwort wirkt unvollständig.");
  }
  if(pushSessions.length){
   const ret=caps.tombstones?"id,updated_at,server_updated_at":"id,updated_at";
   const {data,error}=await sb.from("training_sessions").upsert(pushSessions.map(s=>alive(sessionRemote(s))),{onConflict:"id"}).select(ret);if(error)throw error;
   const back=new Map((data||[]).map(r=>[r.id,r]));
   pushSessions.forEach(s=>{const r=back.get(s.id);s.syncFp=sessionFp(s);s.syncServerAt=r?(r.server_updated_at||r.updated_at):new Date().toISOString()});
   report.pushed+=pushSessions.length;
  }

  /* ---- Löschungen an den Server melden ---- */
  const planDeleteIds=(pr.data||[]).filter(r=>!r.deleted_at&&tomb.plans[r.id]&&!db.plans.some(p=>p.id===r.id)).map(r=>r.id);
  Object.keys(tomb.plans).forEach(id=>{if(!planDeleteIds.includes(id)&&!db.plans.some(p=>p.id===id))delete tomb.plans[id]});
  const sendDeletes=async(table,list,map)=>{
   const uuids=list.filter(isUuid);
   if(uuids.length){
    const q=caps.tombstones?sb.from(table).update({deleted_at:new Date().toISOString()}).in("id",uuids):sb.from(table).delete().in("id",uuids);
    const {error}=await q;if(error)throw error;
   }
   list.forEach(id=>{delete map[id]});
  };
  await sendDeletes("training_sessions",deleteIds,tomb.sessions);
  await sendDeletes("training_plans",planDeleteIds,tomb.plans);

  safeSave();lastSync=new Date().toISOString();localStorage.setItem("mt_last_sync",lastSync);
  if(show)alert("Synchronisierung abgeschlossen.\n"+report.pulled+" geladen · "+report.pushed+" gesendet · "+report.deleted+" gelöscht"+(report.conflicts?"\n"+report.conflicts+" Konflikt(e) – siehe Einstellungen/Diagnose (db.syncConflicts).":""));
 }catch(e){console.error("Sync",e);if(show)alert("Sync fehlgeschlagen: "+e.message)}
 finally{syncing=false;render()}
}
let syncTimer;function queueSync(){if(!cloudUser)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncCloud(false),700)}
window.addEventListener("online",()=>syncCloud(false));document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")syncCloud(false)});
/* Start erst, wenn der lokale Speicher (IndexedDB) geladen ist */
mtStore.ready.then(()=>{
  const stored=mtStore.get("db");
  if(stored&&typeof stored==="object"&&Array.isArray(stored.sessions))db=stored;
  migrateEquipmentStorageV662();repairCanonicalDescriptions();repairMovedOriginalDates();autoCompletePastRestDays();maybeAutoBackup();render();initCloud();
});
if("serviceWorker" in navigator){
  navigator.serviceWorker.register("sw.js")
    .then(reg=>reg.update().catch(()=>{}))
    .catch(err=>console.error("Service Worker:",err));
}

/* ===== V5.3 password recovery fix ===== */
async function handleRecoverySession(event,session){
  if(event==="PASSWORD_RECOVERY"){
    cloudUser=session?.user||cloudUser;
    const dlg=document.getElementById("passwordDialog");
    if(dlg && !dlg.open) dlg.showModal();
  }
}
async function saveNewPassword(e){
  e.preventDefault();
  const p1=document.getElementById("newPassword").value;
  const p2=document.getElementById("newPassword2").value;
  const status=document.getElementById("passwordStatus");
  if(p1.length<8){status.textContent="Bitte mindestens 8 Zeichen verwenden.";return}
  if(p1!==p2){status.textContent="Die Passwörter stimmen nicht überein.";return}
  status.textContent="Passwort wird gespeichert …";
  try{
    const {error}=await sb.auth.updateUser({password:p1});
    if(error) throw error;
    status.textContent="Passwort wurde gespeichert.";
    setTimeout(()=>passwordDialog.close(),500);
  }catch(err){
    status.textContent="Fehler: "+(err?.message||err);
  }
}
async function initCloud(){
  try{
    sb=makeClient();
    sb.auth.onAuthStateChange((event,session)=>{
      cloudUser=session?.user||null;
      setTimeout(async()=>{
        await handleRecoverySession(event,session);
        if(cloudUser && event!=="PASSWORD_RECOVERY"){
          try{await prepareEmptyNewUser();await syncCloud(false)}catch(e){console.error(e)}
        }
        render();
      },0);
    });
    const {data,error}=await sb.auth.getSession();
    if(error) console.error(error);
    cloudUser=data?.session?.user||null;
    const u=location.href;
    if(cloudUser && /type=recovery/i.test(u)){
      setTimeout(()=>handleRecoverySession("PASSWORD_RECOVERY",data.session),80);
    }else if(cloudUser){
      await prepareEmptyNewUser();
      await syncCloud(false);
    }
    render();
  }catch(e){
    console.error("Cloud init",e);
    render();
  }
}
async function passwordReset(){
  const email=loginEmail.value.trim();
  if(!email){loginStatus.textContent="Bitte E-Mail eingeben.";return}
  const redirectTo=location.origin+location.pathname;
  const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
  loginStatus.textContent=error?error.message:"Recovery-Mail gesendet. Öffne den Link; danach erscheint automatisch das Formular für ein neues Passwort.";
}

/* ===== V5.4 gestures / status reset / details focus fix ===== */
