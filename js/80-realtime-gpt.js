const SETTINGS_OPEN_KEY="mt_settings_open_section";

function toggleSettingsSection(name){
  const sections=[...document.querySelectorAll(".settings-section")];
  const target=sections.find(s=>s.dataset.settingsSection===name);
  if(!target)return;

  const willOpen=!target.classList.contains("open");
  sections.forEach(s=>s.classList.remove("open"));

  if(willOpen){
    target.classList.add("open");
    localStorage.setItem(SETTINGS_OPEN_KEY,name);
    if(name==="equipment")setTimeout(renderEquipmentSettings,0);
    if(name==="reminders")setTimeout(refreshPushStatus,0);
  }else{
    localStorage.removeItem(SETTINGS_OPEN_KEY);
  }
}

function restoreSettingsOpenSection(){
  const name=localStorage.getItem(SETTINGS_OPEN_KEY);
  if(!name)return;
  const target=document.querySelector(`.settings-section[data-settings-section="${name}"]`);
  if(target){
    target.classList.add("open");
    if(name==="equipment")setTimeout(renderEquipmentSettings,0);
    if(name==="reminders")setTimeout(refreshPushStatus,0);
  }
}

function setBackupSchedule(v){
  const allowed=["manual","hourly","daily","weekly","monthly","yearly"];
  const value=allowed.includes(v)?v:"daily";
  localStorage.setItem(BACKUP_SCHEDULE_KEY,value);

  // Keep the currently selected option stable immediately.
  const select=document.getElementById("backupScheduleSelect");
  if(select)select.value=value;

  if(value!=="manual")maybeAutoBackup();

  // Do not force a full render here; that was causing the UI to jump back visually.
  localStorage.setItem(SETTINGS_OPEN_KEY,"backup");
}

const __v66RenderSettings=renderSettings;
renderSettings=function(){
  __v66RenderSettings();
  setTimeout(()=>{
    restoreSettingsOpenSection();
    renderEquipmentSettings();
    refreshPushStatus();
  },0);
};

const __v662OpenSession=openSession;
openSession=function(id=null,topup=false){
  __v662OpenSession(id,topup);
  requestAnimationFrame(()=>{
    const hint=document.getElementById("assignedEquipmentHint");
    if(!hint)return;
    const s=id?db.sessions.find(x=>x.id===id):null;
    const eq=s?equipmentForSession(s):null;
    hint.textContent=eq ? `Equipment: ${eq.name} · ${equipmentTypeLabel(eq.type)}` : "";
  });
};

function migrateEquipmentStorageV662(){
  try{
    if(equipmentAll().length)return;
    for(const key of ["mt_equipment","equipment_profiles","equipment"]){
      try{
        const parsed=JSON.parse(localStorage.getItem(key)||"null");
        if(Array.isArray(parsed)&&parsed.length){
          localStorage.setItem(EQUIPMENT_KEY,JSON.stringify(parsed));
          break;
        }
      }catch{}
    }
  }catch(err){console.warn("Equipment migration",err)}
}

/* ===== V6.6.3 equipment cloud resilience ===== */
async function syncEquipmentSafe(){
  try{
    await cloudLoadEquipment();
  }catch(err){
    console.warn("Equipment sync ignored",err);
  }
}

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible" && cloudUser)syncEquipmentSafe();
});

setTimeout(()=>{
  if(cloudUser)syncEquipmentSafe();
},1200);

function debugEquipmentMatch(sessionId){
  const s=db.sessions.find(x=>String(x.id)===String(sessionId));
  if(!s)return null;
  return {
    session:s,
    inferredType:inferEquipmentType(s),
    matchingDefault:equipmentForSession(s),
    allEquipment:equipmentAll()
  };
}

/* ===== V6.6.5 explicit equipment sync ===== */
let equipmentSyncRunning=false;

async function syncEquipmentNow(direction="both",showMessage=false){
  if(equipmentSyncRunning)return;
  if(!cloudUser||!sb){
    if(showMessage)alert("Bitte zuerst bei der Cloud anmelden.");
    return;
  }

  equipmentSyncRunning=true;
  try{
    if(direction==="push"||direction==="both") await cloudSaveEquipment();
    if(direction==="pull"||direction==="both") await cloudLoadEquipment();

    if(showMessage)alert("Equipment synchronisiert.");
  }catch(err){
    console.error("Equipment sync failed",err);
    if(showMessage)alert("Equipment-Sync fehlgeschlagen: "+(err?.message||err));
  }finally{
    equipmentSyncRunning=false;
  }
}

function scheduleEquipmentPull(){
  setTimeout(()=>{
    if(cloudUser)syncEquipmentNow("pull",false);
  },300);
}

/* On auth/session availability, load equipment from cloud. */
if(typeof sb!=="undefined" && sb?.auth){
  sb.auth.onAuthStateChange((_event,session)=>{
    if(session?.user){
      cloudUser=session.user;
      scheduleEquipmentPull();
    }
  });
}

window.addEventListener("focus",()=>{
  if(cloudUser)syncEquipmentNow("pull",false);
});

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible" && cloudUser){
    syncEquipmentNow("pull",false);
  }
});

setTimeout(()=>{
  if(cloudUser)syncEquipmentNow("pull",false);
},1500);

/* ===== V6.7 Realtime + Pull to Refresh ===== */
let realtimeChannel=null;
let realtimeRefreshTimer=null;
let globalSyncRunning=false;
let ptrStartY=0;
let ptrTracking=false;
let ptrTriggered=false;

async function syncAllNow(showMessage=false,mode="both"){
  if(globalSyncRunning)return;
  if(!cloudUser||!sb){
    if(showMessage)alert("Bitte zuerst bei der Cloud anmelden.");
    return;
  }

  globalSyncRunning=true;
  const indicator=document.getElementById("ptrIndicator");
  if(indicator){
    indicator.textContent="↻ Synchronisiere …";
    indicator.classList.add("show","syncing");
  }

  try{
    // Training/App data
    if(typeof syncCloud==="function"){
      await syncCloud(false);
    }

    // Equipment
    if(typeof syncEquipmentNow==="function"){
      await syncEquipmentNow(mode==="pull"?"pull":"both",false);
    }else{
      if(mode!=="pull" && typeof cloudSaveEquipment==="function")await cloudSaveEquipment();
      if(typeof cloudLoadEquipment==="function")await cloudLoadEquipment();
    }

    // Re-render current view from latest local state.
    repairMovedOriginalDates();if(typeof render==="function")render();

    document.querySelector("main")?.classList.add("sync-flash");
    setTimeout(()=>document.querySelector("main")?.classList.remove("sync-flash"),600);

    if(showMessage)alert("Synchronisierung abgeschlossen.");
  }catch(err){
    console.error("Global sync failed",err);
    if(showMessage)alert("Synchronisierung fehlgeschlagen: "+(err?.message||err));
  }finally{
    globalSyncRunning=false;
    if(indicator){
      indicator.textContent="✓ Aktualisiert";
      setTimeout(()=>{
        indicator.classList.remove("show","ready","syncing");
        indicator.textContent="↻ Synchronisieren";
      },650);
    }
  }
}

function scheduleRealtimeRefresh(){
  clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer=setTimeout(()=>{
    if(cloudUser)syncAllNow(false,"pull");
  },250);
}

function startRealtimeSync(){
  if(!sb||!cloudUser)return;

  if(realtimeChannel){
    try{sb.removeChannel(realtimeChannel)}catch{}
    realtimeChannel=null;
  }

  realtimeChannel=sb.channel(`training-live-${cloudUser.id}`);

  const watchedTables=[
    "training_sessions",
    "training_plans",
    "training_events",
    "equipment_profiles",
    "reminder_preferences"
  ];

  watchedTables.forEach(table=>{
    realtimeChannel.on(
      "postgres_changes",
      {
        event:"*",
        schema:"public",
        table,
        filter:`user_id=eq.${cloudUser.id}`
      },
      payload=>{
        console.log("Realtime change",table,payload.eventType);
        scheduleRealtimeRefresh();
      }
    );
  });

  realtimeChannel.subscribe(status=>{
    console.log("Realtime status",status);
  });
}

function stopRealtimeSync(){
  if(realtimeChannel && sb){
    try{sb.removeChannel(realtimeChannel)}catch{}
  }
  realtimeChannel=null;
}

/* Auth-aware realtime lifecycle */
setTimeout(()=>{
  if(cloudUser)startRealtimeSync();
},1800);

if(typeof sb!=="undefined" && sb?.auth){
  sb.auth.onAuthStateChange((_event,session)=>{
    if(session?.user){
      cloudUser=session.user;
      setTimeout(()=>{
        startRealtimeSync();
        syncAllNow(false,"pull");
      },150);
    }else{
      stopRealtimeSync();
    }
  });
}

/* Pull to refresh: works from every app view when page is at top. */
function activeScrollContainer(){
  if(screen==="plan")return document.getElementById("planContent");
  return document.querySelector("main");
}
document.addEventListener("touchstart",e=>{
  const scroller=activeScrollContainer();
  if((scroller?.scrollTop||0)>2)return;
  if(e.touches.length!==1)return;
  ptrStartY=e.touches[0].clientY;
  ptrTracking=true;
  ptrTriggered=false;
},{passive:true});

document.addEventListener("touchmove",e=>{
  const scroller=activeScrollContainer();
  if(!ptrTracking || (scroller?.scrollTop||0)>2){ptrTracking=false;return;}
  const dy=e.touches[0].clientY-ptrStartY;
  if(dy<=0)return;

  const indicator=document.getElementById("ptrIndicator");
  if(indicator){
    indicator.classList.add("show");
    if(dy>72){
      indicator.classList.add("ready");
      indicator.textContent="↓ Loslassen zum Aktualisieren";
      ptrTriggered=true;
    }else{
      indicator.classList.remove("ready");
      indicator.textContent="↻ Zum Aktualisieren ziehen";
      ptrTriggered=false;
    }
  }
},{passive:true});

document.addEventListener("touchend",()=>{
  if(!ptrTracking)return;
  ptrTracking=false;
  if(ptrTriggered){
    ptrTriggered=false;
    syncAllNow(false);
  }else{
    document.getElementById("ptrIndicator")?.classList.remove("show","ready");
  }
},{passive:true});

/* Desktop manual refresh gesture equivalent: browser focus + online + visibility */
window.addEventListener("focus",()=>{
  if(cloudUser){
    syncAllNow(false,"pull");
    startRealtimeSync();
  }
});
window.addEventListener("online",()=>{
  if(cloudUser){
    syncAllNow(false,"pull");
    startRealtimeSync();
  }
});
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible" && cloudUser){
    syncAllNow(false,"pull");
    startRealtimeSync();
  }
});

let movingSessionId=null;

/* ===== V6.8 ChatGPT handoff ===== */








/* ===== V6.9 embedded GPT explanation ===== */
let currentGPTSessionId=null;
function closeGPTExplanation(){
  const modal=document.getElementById("gptExplainModal");
  modal?.classList.remove("show");
  modal?.setAttribute("aria-hidden","true");
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
  currentGPTSessionId=null;
}
function gptExplanationKeyFor(s){
  return JSON.stringify({
    title:s.title||"",type:s.type||"",equipment:equipmentDisplay(s)||"",
    desc:s.desc||"",note:s.note||""
  });
}

function trainingPayloadForGPT(s){
  return {
    id:s.id,
    date:s.date,
    scheduledAt:s.scheduledAt||null,
    title:s.title||"",
    type:s.type||"",
    equipment:equipmentDisplay(s)||s.type||"",
    planDescription:s.desc||"",
    userNote:s.note||"",
    status:s.status||"open",
    topup:!!s.topup
  };
}

async function explainTrainingWithGPT(id,force=false){
  closeQuickMenu?.();
  const s=db.sessions.find(x=>String(x.id)===String(id));
  if(!s)return;

  currentGPTSessionId=String(id);
  const modal=document.getElementById("gptExplainModal");
  const title=document.getElementById("gptExplainTitle");
  const body=document.getElementById("gptExplainBody");
  const regen=document.getElementById("gptRegenerateBtn");
  const key=gptExplanationKeyFor(s);

  title.textContent=`${unitEmoji(s)} ${s.title}`;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");

  if(!force && s.gptExplanation && s.gptExplanationKey===key){
    body.textContent=s.gptExplanation;
    body.scrollTop=0;
    regen.style.display="";
    return;
  }

  body.innerHTML='<div class="gpt-loading">GPT analysiert die Einheit vollständig …</div>';
  regen.style.display="none";

  try{
    if(!cloudUser)throw new Error("Bitte zuerst bei der Cloud anmelden.");
    const {data:{session},error:sessionError}=await sb.auth.getSession();
    if(sessionError||!session?.access_token)throw new Error("Keine gültige Anmeldung vorhanden.");

    const res=await fetch(`${SUPABASE_URL}/functions/v1/explain-training`,{
      method:"POST",mode:"cors",cache:"no-store",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${session.access_token}`,
        "apikey":SUPABASE_PUBLISHABLE_KEY
      },
      body:JSON.stringify({training:trainingPayloadForGPT(s)})
    });
    const text=await res.text();
    let data={};try{data=text?JSON.parse(text):{}}catch{data={raw:text}}
    if(!res.ok)throw new Error(data.error||data.raw||`HTTP ${res.status}`);

    const explanation=data.explanation||"Keine Erklärung erhalten.";
    s.gptExplanation=explanation;
    s.gptExplanationKey=key;
    s.updatedAt=new Date().toISOString();
    safeSave();
    queueSync();
    body.textContent=explanation;
    body.scrollTop=0;
    regen.style.display="";
  }catch(err){
    console.error("GPT explanation",err);
    body.innerHTML=`<div class="gpt-error"><strong>GPT-Erklärung nicht verfügbar.</strong><br>${escapeHtml(err?.message||String(err))}</div>`;
    regen.style.display="";
  }
}

async function exportCurrentGPTWorkout(){
  const s=db.sessions.find(x=>String(x.id)===String(currentGPTSessionId));
  if(!s){alert("Keine Trainingseinheit für den Export ausgewählt.");return}
  const canonical=sessionStructuredWorkout(s);
  if(canonical)return exportStructuredSessionWorkout(s.id);
  const explanation=s.gptExplanation||document.getElementById("gptExplainBody")?.innerText||"";
  const parsed=parseStructuredWorkout(explanation);
  if(!parsed.length){
    alert("Für diese Einheit ist noch kein strukturiertes Workout vorhanden. Bei neuen Planpaketen werden Indoor-Einheiten direkt mit Workout-Blöcken geliefert. Für diese bestehende Einheit kann die GPT-Erklärung nur exportiert werden, wenn sie Dauer und Intensität eindeutig enthält.");
    return;
  }
  return shareWorkout(s.title||"Workout",parsed,"GPT-Erklärung");
}
function regenerateGPTExplanation(){
  if(currentGPTSessionId)explainTrainingWithGPT(currentGPTSessionId,true);
}

/* ===== V6.9.2 moved-date repair + canonical action menu ===== */
