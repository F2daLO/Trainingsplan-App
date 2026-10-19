function neutralizeSession(id){
  const s=db.sessions.find(x=>x.id===id);
  if(!s)return;
  s.status="open";
  s.updatedAt=new Date().toISOString();
  persist();
}
function deleteSession(id){
  const s=db.sessions.find(x=>x.id===id);
  if(!s)return;
  if(!confirm(`Training "${s.title}" wirklich löschen?`)) return;
  markDeleted("sessions",id);
  db.sessions=db.sessions.filter(x=>x.id!==id);
  persist();
}




const __v54RenderBase=render;
render=function(){
  __v54RenderBase();
  /* v6.54: bindSessionGestures existiert seit V5.8 nicht mehr (Gesten laufen per Dokument-Listener). Der ungeschützte Aufruf warf nach jedem render() einen Fehler und verhinderte queueSync() in persist(). */
  if(typeof bindSessionGestures==="function")setTimeout(bindSessionGestures,0);
};

const __v54OpenSessionBase=openSession;
openSession=function(id=null,topup=false){
  const keepView=planView;
  __v54OpenSessionBase(id,topup);
  planView=keepView;
  requestAnimationFrame(()=>{
    const h=document.getElementById("sessionHeading");
    if(h) h.focus({preventScroll:true});
    else document.activeElement?.blur?.();
  });
};

/* ===== V5.6 gesture model ===== */
let gestureTapTimer=null;

function closeQuickMenu(){
  document.querySelector(".quick-menu-backdrop")?.remove();
  document.querySelector(".quick-menu")?.remove();
}



function openMoveMenu(id,fromActionMenu=false){
  if(fromActionMenu) closeQuickMenu();
  const s=db.sessions.find(x=>x.id===id);
  if(!s)return;

  closeQuickMenu();
  const back=document.createElement("div");
  back.className="quick-menu-backdrop";
  back.onclick=closeQuickMenu;

  const menu=document.createElement("div");
  menu.className="quick-menu glass";
  menu.innerHTML=`<div class="quick-menu-title">Training verschieben</div>
    <button class="warn" onclick="moveTomorrow('${id}');closeQuickMenu()">Morgen</button>
    <button onclick="chooseMoveDate('${id}')">Anderes Datum / Uhrzeit …</button>
    <button onclick="closeQuickMenu()">Abbrechen</button>`;
  document.body.append(back,menu);
}

function chooseMoveDate(id){
  closeQuickMenu();
  const s=db.sessions.find(x=>x.id===id);
  if(!s)return;
  movingSessionId=id;
  openSession(id);
  requestAnimationFrame(()=>{
    const f=document.getElementById("sDateTime");
    if(f){
      f.focus({preventScroll:false});
      try{ f.showPicker?.(); }catch{}
    }
  });
}

function singleTapDone(id){
  clearTimeout(gestureTapTimer);
  gestureTapTimer=setTimeout(()=>{
    setStatus(id,"done");
    gestureTapTimer=null;
  },260);
}
function doubleTapNeutral(id){
  if(gestureTapTimer){
    clearTimeout(gestureTapTimer);
    gestureTapTimer=null;
  }
  neutralizeSession(id);
}







/* ===== V5.7 interaction fixes ===== */
function closeInfoSheet(){
  document.querySelector(".info-sheet-backdrop")?.remove();
  document.querySelector(".info-sheet")?.remove();
}








function showManualNote(id){
  const s=db.sessions.find(x=>x.id===id);
  if(!s)return;
  const note=(s.note||"").trim();
  if(!note)return;

  closeInfoSheet?.();
  const back=document.createElement("div");
  back.className="info-sheet-backdrop";
  back.onclick=()=>closeInfoSheet?.();

  const sheet=document.createElement("div");
  sheet.className="info-sheet glass";
  sheet.innerHTML=`<h3>${unitEmoji(s)} ${esc(s.title)}</h3>
    <div class="info-block"><strong>Eigene Beschreibung / Notiz</strong><br>${esc(note)}</div>
    <button class="pill" style="width:100%" onclick="closeInfoSheet()">Schließen</button>`;
  document.body.append(back,sheet);
}

/* ===== V5.8 unified Pointer Events gestures ===== */
const GESTURE_LONG_MS=560;
const GESTURE_SWIPE_X=72;
const GESTURE_MOVE_TOL=12;
const GESTURE_DOUBLE_MS=330;

let gPointer=null;
let gLastTap={id:null,time:0};

function gestureTargetFromEventTarget(target){
  return target.closest?.(".session[data-session-id], .dayitem[data-session-id]") || null;
}

function isInteractiveGestureChild(target){
  return !!target.closest?.("button,.sdate,[data-move-id],[data-note-id],input,select,textarea,a");
}

function clearGestureTimer(){
  if(gPointer?.longTimer){
    clearTimeout(gPointer.longTimer);
    gPointer.longTimer=null;
  }
}

document.addEventListener("pointerdown",e=>{
  const el=gestureTargetFromEventTarget(e.target);
  if(!el || isInteractiveGestureChild(e.target)) return;

  const id=el.dataset.sessionId;
  gPointer={
    id,el,
    pointerId:e.pointerId,
    x:e.clientX,y:e.clientY,
    moved:false,
    longTriggered:false,
    started:performance.now(),
    longTimer:null
  };

  // Long press opens the same Ist-Auswertung in weekly and list views.
  if(el.classList.contains("dayitem") || el.classList.contains("session")){
    gPointer.longTimer=setTimeout(()=>{
      if(!gPointer || gPointer.id!==id || gPointer.moved) return;
      gPointer.longTriggered=true;
      sessionActualDetailV644(id);
    },GESTURE_LONG_MS);
  }

  try{ el.setPointerCapture?.(e.pointerId); }catch{}
});

document.addEventListener("pointermove",e=>{
  if(!gPointer || gPointer.pointerId!==e.pointerId) return;
  const dx=e.clientX-gPointer.x,dy=e.clientY-gPointer.y;
  if(Math.abs(dx)>GESTURE_MOVE_TOL || Math.abs(dy)>GESTURE_MOVE_TOL){
    gPointer.moved=true;
    clearGestureTimer();
  }
});

document.addEventListener("pointercancel",()=>{
  clearGestureTimer();
  gPointer=null;
});

// Prevent native text-selection/callout specifically for weekly items.


document.addEventListener("selectstart",e=>{
  if(e.target.closest?.(".dayitem[data-session-id],.session[data-session-id]")) e.preventDefault();
});

// Delegated controls inside cards.
document.addEventListener("click",e=>{
  const note=e.target.closest?.("[data-note-id]");
  if(note){
    e.preventDefault();e.stopPropagation();
    showManualNote(note.dataset.noteId);
    return;
  }
  const mv=e.target.closest?.("[data-move-id]");
  if(mv){
    e.preventDefault();e.stopPropagation();
    openMoveMenu(mv.dataset.moveId);
  }
});

/* ===== V5.9 desktop interaction ===== */

/* Desktop / mouse: right-click is the full action menu. */
document.addEventListener("contextmenu",e=>{
  const target=e.target.closest?.(".session[data-session-id],.dayitem[data-session-id]");
  if(!target) return;
  e.preventDefault();
  sessionActionMenu(target.dataset.sessionId);
});

/* Replace pointer-up behavior for the list:
   mouse = click/double-click only; touch/pen can swipe left. */
document.addEventListener("pointerup",e=>{
  if(!gPointer || gPointer.pointerId!==e.pointerId) return;

  const g=gPointer;
  clearGestureTimer();
  gPointer=null;

  const dx=e.clientX-g.x,dy=e.clientY-g.y;

  if(g.longTriggered){
    e.preventDefault();
    return;
  }

  /* Weekly view: long-press only on touch/pen. */
  if(g.el.classList.contains("dayitem")){
    return;
  }

  /* Swipe-left menu only on touch or pen, never mouse. */
  if(e.pointerType!=="mouse" && dx < -GESTURE_SWIPE_X && Math.abs(dx)>Math.abs(dy)*1.25){
    e.preventDefault();
    sessionActionMenu(g.id);
    return;
  }

  /* List tap/double-tap. */
  if(Math.abs(dx)<=GESTURE_MOVE_TOL && Math.abs(dy)<=GESTURE_MOVE_TOL){
    const now=performance.now();
    if(gLastTap.id===g.id && (now-gLastTap.time)<=GESTURE_DOUBLE_MS){
      if(gestureTapTimer){
        clearTimeout(gestureTapTimer);
        gestureTapTimer=null;
      }
      neutralizeSession(g.id);
      gLastTap={id:null,time:0};
    }else{
      gLastTap={id:g.id,time:now};
      if(gestureTapTimer) clearTimeout(gestureTapTimer);
      gestureTapTimer=setTimeout(()=>{
        setStatus(g.id,"done");
        gestureTapTimer=null;
      },GESTURE_DOUBLE_MS);
    }
  }
},true);

/* Long-press timer only for non-mouse pointers. */
document.addEventListener("pointerdown",e=>{
  const el=gestureTargetFromEventTarget(e.target);
  if(!el || isInteractiveGestureChild(e.target)) return;

  if(el.classList.contains("dayitem") && e.pointerType==="mouse"){
    clearGestureTimer();
  }
},true);

/* ===== V6.0 Events / Blocks / Import / Backup ===== */
function repairCanonicalDescriptions(){
  let changed=false;
  db.sessions.forEach(s=>{
    const canonical=CANONICAL_PLAN_DESCRIPTIONS[s.id];
    if(canonical===undefined) return;
    if((s.desc||"")!==canonical){
      const old=(s.desc||"").trim();
      if(old && !(s.note||"").trim()) s.note=old;
      else if(old && (s.note||"").trim() && !String(s.note).includes(old)) s.note=String(s.note)+"\n"+old;
      s.desc=canonical;
      s.updatedAt=new Date().toISOString();
      changed=true;
    }
  });
  if(changed) safeSave();
  return changed;
}

function eventEmoji(sport){
  return {cycling:"🚴",triathlon:"🏊🚴🏃",running:"🏃",swimming:"🏊",ski:"⛷️",general:"🏋️"}[sport]||"🏋️";
}
function openNewEvent(){
  newEventName.value="";
  newEventDetails.value="";
  newEventSport.value="cycling";
  newEventBlockName.value="Block 1";
  newEventBlockFocus.value="Grundlagen";
  eventDialog.showModal();
}
function saveNewEvent(e){
  e.preventDefault();
  const eventId=crypto.randomUUID();
  const blockId=crypto.randomUUID();
  const sport=newEventSport.value;
  const rawName=newEventName.value.trim();
  const details=newEventDetails.value.trim();
  const blockBase=newEventBlockName.value.trim()||"Block 1";
  const focus=newEventBlockFocus.value.trim()||"Grundlagen";
  db.events.push({id:eventId,name:`${eventEmoji(sport)} ${rawName}`,sport,description:details});
  db.plans.push({id:blockId,eventId,name:`${blockBase} · ${focus}`,focus,description:""});
  db.activeEvent=eventId;db.activePlan=blockId;
  eventDialog.close();
  persist();
  go("plan");
}
function openNewBlock(){
  const e=activeEvent();
  if(!e){alert("Bitte zuerst ein Event auswählen.");return}
  const blocks=db.plans.filter(p=>p.eventId===e.id);
  newBlockName.value=`Block ${blocks.length+1}`;
  newBlockFocus.value="";
  newBlockDescription.value="";
  blockEventLabel.textContent=e.name;
  blockDialog.showModal();
}
function saveNewBlock(e){
  e.preventDefault();
  const event=activeEvent();
  if(!event)return;
  const base=newBlockName.value.trim();
  const focus=newBlockFocus.value.trim();
  const id=crypto.randomUUID();
  db.plans.push({id,eventId:event.id,name:focus?`${base} · ${focus}`:base,focus,description:newBlockDescription.value.trim()});
  db.activePlan=id;
  blockDialog.close();
  persist();
}

function openImport(){
  importPlanFile.value="";
  importPlanFile.click();
}
function parseCSVLine(line,delimiter){
  const out=[];let cur="",quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++}
      else quoted=!quoted;
    }else if(c===delimiter && !quoted){
      out.push(cur);cur="";
    }else cur+=c;
  }
  out.push(cur);
  return out.map(v=>v.trim());
}
function parseCSV(text){
  const lines=text.replace(/\r/g,"").split("\n").filter(x=>x.trim());
  if(!lines.length)return[];
  const delimiter=(lines[0].split(";").length>lines[0].split(",").length)?";":",";
  const headers=parseCSVLine(lines[0],delimiter).map(h=>h.trim().toLowerCase());
  return lines.slice(1).map(line=>{
    const vals=parseCSVLine(line,delimiter),o={};
    headers.forEach((h,i)=>o[h]=vals[i]??"");
    return o;
  });
}
function mergeById(target,incoming){
  const map=new Map(target.map(x=>[x.id,x]));
  incoming.forEach(x=>{if(x?.id)map.set(x.id,{...(map.get(x.id)||{}),...x})});
  return [...map.values()];
}
function normalizeImportedDB(obj){
  if(obj?.data?.events && obj?.data?.plans && obj?.data?.sessions) obj=obj.data;
  if(obj?.events && obj?.plans && obj?.sessions) return obj;
  throw new Error("JSON enthält keinen gültigen Mein-Training-Datenbestand.");
}
function ensureEventImport(name,details="",sport="general"){
  let e=db.events.find(x=>String(x.name).replace(/^[^\w\d]+/u,"").trim().toLowerCase()===String(name).replace(/^[^\w\d]+/u,"").trim().toLowerCase());
  if(!e){
    const id=crypto.randomUUID();
    const n=/^[^\w\d]+/u.test(name)?name:`${eventEmoji(sport)} ${name}`;
    e={id,name:n,sport,description:details};
    db.events.push(e);
  }
  return e;
}
function ensureBlockImport(eventId,name,focus=""){
  let p=db.plans.find(x=>x.eventId===eventId && x.name.toLowerCase()===name.toLowerCase());
  if(!p){
    p={id:crypto.randomUUID(),eventId,name,focus,description:""};
    db.plans.push(p);
  }
  return p;
}
function importCSVRows(rows){
  let count=0;
  rows.forEach(r=>{
    const eventName=r.event||r.eventname||activeEvent()?.name||"Importiertes Event";
    const details=r.event_details||r.eventdetails||r.route||"";
    const sport=r.sport||"general";
    const ev=ensureEventImport(eventName,details,sport);
    const blockName=r.block||r.blockname||"Block 1 · Import";
    const block=ensureBlockImport(ev.id,blockName,r.block_focus||r.focus||"");
    const date=r.date||r.datum;
    const title=r.title||r.titel;
    if(!date||!title)return;
    const time=(r.time||r.uhrzeit||"19:00").slice(0,5);
    db.sessions.push({
      id:crypto.randomUUID(),planId:block.id,date,
      scheduledAt:`${date}T${time}`,
      type:r.type||r.trainingsart||"Sonstiges",
      title,
      desc:r.plan_description||r.planbeschreibung||r.description||"",
      note:r.note||r.notiz||"",
      status:r.status||"open",
      topup:/^(1|true|ja|yes)$/i.test(r.topup||""),
      reminder:"auto",
      reminderTime:"18:00",
      updatedAt:new Date().toISOString()
    });
    db.activeEvent=ev.id;db.activePlan=block.id;count++;
  });
  return count;
}
async function importPlanFileSelected(e){
  const file=e.target.files?.[0];if(!file)return;
  try{
    const text=await file.text();
    if(file.name.toLowerCase().endsWith(".json")){
      const incoming=normalizeImportedDB(JSON.parse(text));
      db.events=mergeById(db.events,incoming.events||[]);
      db.plans=mergeById(db.plans,incoming.plans||[]);
      db.sessions=mergeById(db.sessions,incoming.sessions||[]);(incoming.sessions||[]).forEach(x=>{if(db.tombstones&&db.tombstones.sessions)delete db.tombstones.sessions[x.id]});
      if(incoming.activeEvent)db.activeEvent=incoming.activeEvent;
      if(incoming.activePlan)db.activePlan=incoming.activePlan;
      repairCanonicalDescriptions();
      persist();
      alert(`JSON importiert: ${incoming.events?.length||0} Events, ${incoming.plans?.length||0} Blöcke, ${incoming.sessions?.length||0} Einheiten.`);
    }else{
      const count=importCSVRows(parseCSV(text));
      repairCanonicalDescriptions();
      persist();
      alert(`${count} Trainingseinheiten aus CSV importiert.`);
    }
  }catch(err){
    alert("Import fehlgeschlagen: "+(err?.message||err));
  }finally{
    e.target.value="";
  }
}

/* Backups */
