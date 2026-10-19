function repairMovedOriginalDates(){
  let changed=false;
  for(const s of db.sessions||[]){
    const original=ORIGINAL_SESSION_DATES[String(s.id)];
    if(!original)continue;
    if(s.date!==original && !s.originalDate){
      s.originalDate=original;
      changed=true;
    }
  }
  if(changed){
    safeSave();
  }
}

function sessionActionMenu(id){
  closeQuickMenu();
  const s=db.sessions.find(x=>x.id===id);
  if(!s)return;

  const back=document.createElement("div");
  back.className="quick-menu-backdrop";
  back.onclick=closeQuickMenu;

  const menu=document.createElement("div");
  menu.className="quick-menu glass";
  menu.innerHTML=`<div class="quick-menu-title">${unitEmoji(s)} ${esc(s.title)}</div>
    <button class="ok" onclick="setStatus('${id}','done');closeQuickMenu()">✓ Erledigt</button>
    <button class="neutral" onclick="neutralizeSession('${id}');closeQuickMenu()">○ Neutralisieren</button>
    <button class="warn" onclick="openMoveMenu('${id}',true)">↪ Verschieben</button>
    <button class="bad" onclick="setStatus('${id}','cancel');closeQuickMenu()">✕ Ausgefallen</button>
    <button onclick="closeQuickMenu();explainTrainingWithGPT('${id}')">💬 Mit GPT erklären</button>
    <button onclick="closeQuickMenu();exportSessionWorkout('${id}')">⇩ Workout exportieren</button>
    <button onclick="openSession('${id}');closeQuickMenu()">✏️ Bearbeiten</button>
    <button class="bad" onclick="deleteSession('${id}');closeQuickMenu()">🗑 Löschen</button>
    <button onclick="closeQuickMenu()">Abbrechen</button>`;
  document.body.append(back,menu);
}

function sessionVisualStatus(s){
  return (isSessionMoved(s) && s.status!=="done" && s.status!=="cancel") ? "move" : s.status;
}

document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"){
    if(autoCompletePastRestDays()){
      persist();
    }
  }
});
window.addEventListener("focus",()=>{
  if(autoCompletePastRestDays()){
    persist();
  }
});

let adaptiveNavTimer=null;
function setFloatingNavCompact(compact){
  document.querySelector(".nav")?.classList.toggle("scrolling",!!compact);
}
document.addEventListener("scroll",()=>{
  setFloatingNavCompact(true);
  clearTimeout(adaptiveNavTimer);
  adaptiveNavTimer=setTimeout(()=>setFloatingNavCompact(false),180);
},true);
document.addEventListener("touchmove",()=>{
  setFloatingNavCompact(true);
  clearTimeout(adaptiveNavTimer);
  adaptiveNavTimer=setTimeout(()=>setFloatingNavCompact(false),180);
},{passive:true});


/* V6.18.1: Every deliberate tap/click on the Plan navigation means "Plan → today". */
document.addEventListener("pointerdown",e=>{
 const b=e.target.closest("#navPlan");
 if(!b)return;
 planInitialScrollKey=null;
 forcePlanTodayOnEntry=true;
},{capture:true});




/* V6.18.3.5: iPhone status-scroll guard.
   Uses the actual scrolling element (#planContent) and survives delayed cloud renders. */
let statusPlanScrollGuard=null;
function beginStatusPlanScrollGuard(){
 const r=document.getElementById("planContent");
 if(!r||screen!=="plan")return;
 statusPlanScrollGuard={top:r.scrollTop,expires:Date.now()+2600};
}
function enforceStatusPlanScrollGuard(){
 if(!statusPlanScrollGuard)return;
 if(Date.now()>statusPlanScrollGuard.expires){statusPlanScrollGuard=null;return}
 const r=document.getElementById("planContent");
 if(r)r.scrollTop=statusPlanScrollGuard.top;
 requestAnimationFrame(enforceStatusPlanScrollGuard);
}
function startStatusPlanScrollGuard(){
 beginStatusPlanScrollGuard();
 requestAnimationFrame(enforceStatusPlanScrollGuard);
}


function xmlEsc(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function parseStructuredWorkout(text){
 const out=[], lines=String(text||"").split(/\n+/).map(x=>x.replace(/[*#•]/g," ").trim()).filter(Boolean);
 for(const line of lines){
  const tm=line.match(/(\d+(?:[.,]\d+)?)\s*(min(?:uten?)?|sek(?:unden?)?|s)\b/i);if(!tm)continue;
  const sec=Math.round(parseFloat(tm[1].replace(",","."))*(/^s|sek/i.test(tm[2])?1:60));
  const pct=line.match(/(\d{2,3})\s*%\s*(?:FTP)?/i), rpm=line.match(/(\d{2,3})\s*(?:rpm|U\/min)\b/i);
  const rpe=line.match(/RPE\s*(\d+(?:[.,]\d+)?)/i);
  let power=pct?parseFloat(pct[1])/100:null;
  if(power===null){
   if(/regeneration|locker|cool.?down|ausfahren/i.test(line))power=.50;
   else if(/warm.?up|einrollen/i.test(line))power=.55;
   else if(/zone\s*2|grundlage|GA1/i.test(line))power=.65;
   else if(/tempo/i.test(line))power=.78;
   else if(/sweet.?spot/i.test(line))power=.90;
   else if(/schwelle|threshold/i.test(line))power=1.00;
   else if(/VO2/i.test(line))power=1.10;
   else if(rpe){power=Math.max(.45,Math.min(1.15,.35+parseFloat(rpe[1].replace(",","."))*.08))}
  }
  if(power!==null&&sec>0)out.push({sec,power:Math.max(.25,Math.min(1.5,power)),cad:rpm?parseInt(rpm[1]):null,label:line});
 }
 return out;
}
function workoutSourceForSession(s,explanation=""){
 const own=[s?.title,s?.description,s?.note,s?.notes].filter(Boolean).join("\n");
 let steps=parseStructuredWorkout(own),source="Einheit";
 if(!steps.length&&explanation){steps=parseStructuredWorkout(explanation);source="GPT-Erklärung"}
 return {steps,source,text:own};
}
function makeZWO(title,steps,source){
 const rows=steps.map(s=>`    <SteadyState Duration="${s.sec}" Power="${s.power.toFixed(3)}"${s.cad?` Cadence="${s.cad}"`:""} />`).join("\n");
 return `<workout_file>\n  <author>Mein Training</author>\n  <name>${xmlEsc(title)}</name>\n  <description>Strukturierte Quelle: ${xmlEsc(source)}</description>\n  <sportType>bike</sportType>\n  <tags><tag name="Mein Training"/></tags>\n  <workout>\n${rows}\n  </workout>\n</workout_file>`;
}
async function shareWorkout(title,steps,source){
 if(!steps.length){alert("Für diese Einheit wurden noch keine ausreichend strukturierten Abschnitte mit Dauer und Intensität erkannt. Öffne „Mit GPT erklären“ und erstelle die Erklärung neu; daraus kann anschließend das Workout erzeugt werden.");return}
 const blob=new Blob([makeZWO(title,steps,source)],{type:"application/xml"});
 const name=(title.replace(/[^\p{L}\p{N}_-]+/gu,"_")||"Workout")+".zwo";
 const file=new File([blob],name,{type:"application/xml"});
 if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:`Workout: ${title}`});return}catch(e){if(e.name==="AbortError")return}}
 const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200);
}
function currentGPTSession(){
 const id=window.currentGptSessionId||window.gptSessionId||window.explainSessionId||null;
 return id?db.sessions.find(s=>s.id===id):null;
}
function exportGPTWorkoutZWO(){
 const dlg=document.getElementById("gptDialog"), body=dlg?.querySelector("#gptContent,.gpt-body,.content,.body")||dlg;
 const explanation=body?.innerText||"";
 const s=currentGPTSession();
 const src=workoutSourceForSession(s,explanation);
 const title=s?.title||(dlg?.querySelector("h2,h3")?.textContent||"Mein Training Workout").trim();
 shareWorkout(title,src.steps,src.source);
}
function exportSessionWorkout(id){
 const s=db.sessions.find(x=>x.id===id);if(!s)return;
 const explanation=s.gptExplanation||s.description?.gptExplanation||"";
 const src=workoutSourceForSession(s,explanation);
 shareWorkout(s.title||"Workout",src.steps,src.source);
}
function ensureGPTExportButton(){
 const d=document.getElementById("gptDialog");if(!d)return;
 const a=d.querySelector(".actions");if(!a||a.querySelector(".gpt-export-workout"))return;
 const b=document.createElement("button");b.type="button";b.className="pill gpt-export-workout";b.textContent="⇩ Workout";b.onclick=exportGPTWorkoutZWO;a.insertBefore(b,a.firstChild);
}
new MutationObserver(ensureGPTExportButton).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener("DOMContentLoaded",ensureGPTExportButton);

function ensureSessionWorkoutAction(){
 const menus=[...document.querySelectorAll("dialog,.action-menu,.sheet,.context-menu")];
 for(const m of menus){
  if(!m.textContent.includes("Mit GPT erklären")||m.querySelector(".session-workout-export"))continue;
  const g=[...m.querySelectorAll("button")].find(b=>b.textContent.includes("Mit GPT erklären"));
  if(!g)continue;
  const id=(g.getAttribute("onclick")||"").match(/['"]([^'"]+)['"]/)?.[1]||window.actionSessionId||window.menuSessionId;
  if(!id)continue;
  const b=document.createElement("button");b.type="button";b.className="session-workout-export";b.textContent="⇩ Workout exportieren";b.onclick=()=>exportSessionWorkout(id);
  g.insertAdjacentElement("afterend",b);
 }
}
new MutationObserver(ensureSessionWorkoutAction).observe(document.documentElement,{childList:true,subtree:true});

/* V6.21 canonical structured workout + future block import schema */
const PLAN_PACKAGE_SCHEMA="mein-training.plan-package.v1";

function normalizeWorkoutStep(x){
 if(!x||typeof x!=="object")return null;
 const type=["warmup","steady","interval","recovery","cooldown"].includes(x.type)?x.type:"steady";
 const durationSec=Math.max(1,Math.round(Number(x.durationSec||x.duration||0)));
 if(!durationSec)return null;
 const step={type,durationSec};
 if(Number.isFinite(Number(x.powerPctFtp)))step.powerPctFtp=Math.max(.20,Math.min(1.80,Number(x.powerPctFtp)));
 if(Number.isFinite(Number(x.cadence)))step.cadence=Math.max(30,Math.min(150,Math.round(Number(x.cadence))));
 if(x.label)step.label=String(x.label);
 if(Number.isFinite(Number(x.repeat)))step.repeat=Math.max(1,Math.round(Number(x.repeat)));
 return step;
}
function normalizeStructuredWorkout(w){
 if(!w||typeof w!=="object")return null;
 const steps=(w.steps||[]).map(normalizeWorkoutStep).filter(Boolean);
 if(!steps.length)return null;
 return {version:1,sport:"bike",mode:w.mode||"erg",steps};
}
function sessionStructuredWorkout(s){
 if(!s)return null;
 let w=normalizeStructuredWorkout(s.workout);
 if(w)return w;
 const parsed=parseStructuredWorkout([s.title,s.desc,s.description,s.note,s.notes].filter(Boolean).join("\n"));
 if(!parsed.length)return null;
 return {version:1,sport:"bike",mode:"erg",steps:parsed.map(x=>({type:"steady",durationSec:x.sec,powerPctFtp:x.power,cadence:x.cad||undefined,label:x.label||undefined}))};
}
function zwoFromStructured(title,w){
 const rows=w.steps.map(s=>{
  const tag=s.type==="warmup"?"Warmup":s.type==="cooldown"?"Cooldown":"SteadyState";
  const p=Number(s.powerPctFtp??.60).toFixed(3);
  if(tag==="Warmup")return `    <Warmup Duration="${s.durationSec}" PowerLow="${Math.max(.3,Number(p)-.1).toFixed(3)}" PowerHigh="${p}"${s.cadence?` Cadence="${s.cadence}"`:""} />`;
  if(tag==="Cooldown")return `    <Cooldown Duration="${s.durationSec}" PowerLow="${p}" PowerHigh="${Math.max(.3,Number(p)-.1).toFixed(3)}"${s.cadence?` Cadence="${s.cadence}"`:""} />`;
  return `    <SteadyState Duration="${s.durationSec}" Power="${p}"${s.cadence?` Cadence="${s.cadence}"`:""} />`;
 }).join("\n");
 return `<workout_file>\n  <author>Mein Training</author>\n  <name>${xmlEsc(title)}</name>\n  <description>Strukturiertes Workout aus Mein Training</description>\n  <sportType>bike</sportType>\n  <workout>\n${rows}\n  </workout>\n</workout_file>`;
}
async function exportStructuredSessionWorkout(id){
 const s=db.sessions.find(x=>x.id===id);if(!s)return;
 const w=sessionStructuredWorkout(s);
 if(!w){alert("Diese Einheit enthält noch kein strukturiertes Workout. Bei neuen importierten Trainingsblöcken wird diese Struktur automatisch mitgeliefert.");return}
 const title=s.title||"Workout",blob=new Blob([zwoFromStructured(title,w)],{type:"application/xml"});
 const file=new File([blob],(title.replace(/[^\p{L}\p{N}_-]+/gu,"_")||"Workout")+".zwo",{type:"application/xml"});
 if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title});return}catch(e){if(e.name==="AbortError")return}}
 const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();
}

function validatePlanPackage(pkg){
 if(!pkg||pkg.schema!==PLAN_PACKAGE_SCHEMA)throw new Error("Kein gültiges Mein-Training Planpaket v1.");
 if(!pkg.event||!pkg.plan||!Array.isArray(pkg.blocks))throw new Error("Event, Plan oder Blocks fehlen.");
 for(const b of pkg.blocks){
  if(!b.externalId||!b.title||!Array.isArray(b.sessions))throw new Error("Ein Block ist unvollständig.");
  for(const s of b.sessions){
   if(!s.externalId||!s.date||!s.title)throw new Error("Eine Einheit ist unvollständig.");
   if(s.workout)s.workout=normalizeStructuredWorkout(s.workout);
  }
 }
 return pkg;
}
function importPlanPackageObject(raw,coachPackageId=null){
 const pkg=validatePlanPackage(structuredClone(raw));
 const now=new Date().toISOString();
 db.events=db.events||[];db.plans=db.plans||[];db.blocks=db.blocks||[];db.sessions=db.sessions||[];
 let ev=db.events.find(x=>x.externalId===pkg.event.externalId);
 if(!ev){ev={id:crypto.randomUUID(),externalId:pkg.event.externalId,title:pkg.event.title,subtitle:pkg.event.subtitle||"",date:pkg.event.date||"",updatedAt:now,coachPackageId:coachPackageId||null};db.events.push(ev)}
 let pl=db.plans.find(x=>x.externalId===pkg.plan.externalId);
 if(!pl){pl={id:crypto.randomUUID(),externalId:pkg.plan.externalId,eventId:ev.id,title:pkg.plan.title,description:pkg.plan.description||"",updatedAt:now,coachPackageId:coachPackageId||null};db.plans.push(pl)}
 let addedBlocks=0,addedSessions=0,updatedFuture=0;
 for(const ib of pkg.blocks){
  let b=db.blocks.find(x=>x.externalId===ib.externalId);
  if(!b){b={id:crypto.randomUUID(),externalId:ib.externalId,planId:pl.id,title:ib.title,description:ib.description||"",startDate:ib.startDate||"",endDate:ib.endDate||"",updatedAt:now,coachPackageId:coachPackageId||null};db.blocks.push(b);addedBlocks++}
  for(const is of ib.sessions){
   let s=db.sessions.find(x=>x.externalId===is.externalId);
   const payload={externalId:is.externalId,planId:pl.id,blockId:b.id,date:is.date,title:is.title,description:is.description||"",type:is.type||"Indoor Rad",equipment:is.equipment||"",workout:is.workout||null,updatedAt:now};
   if(!s){db.sessions.push({id:crypto.randomUUID(),status:"neutral",coachPackageId:coachPackageId||null,...payload});addedSessions++;continue}
   /* Never overwrite training history/progress. Only update still-neutral future/open imported sessions. */
   const today=localTodayISO();
   if((s.status==="neutral"||s.status==="open"||!s.status)&&String(s.date)>=today){
    Object.assign(s,payload);updatedFuture++;
   }
  }
 }
 persist();
 alert(`Planpaket importiert:\n${addedBlocks} neue Block/Blöcke\n${addedSessions} neue Einheiten\n${updatedFuture} zukünftige Einheiten aktualisiert\n\nBereits absolvierte/ausgefallene Einheiten und deren Fortschritt wurden nicht überschrieben.`);
}
async function importPlanPackageFile(file){
 try{importPlanPackageObject(JSON.parse(await file.text()))}catch(e){alert("Planpaket konnte nicht importiert werden:\n"+e.message)}
}
function installPlanPackageImporter(){
 const settings=[...document.querySelectorAll("input[type=file]")].find(x=>/json|csv/i.test(x.accept||"")||/import/i.test(x.id+" "+x.name));
 if(settings&&!settings.dataset.planPackage){
  settings.dataset.planPackage="1";settings.accept=(settings.accept?settings.accept+",":"")+".json,application/json";
  settings.addEventListener("change",e=>{
   const f=e.target.files?.[0];if(f&&f.name.toLowerCase().endsWith(".json"))importPlanPackageFile(f);
  },true);
 }
}
new MutationObserver(installPlanPackageImporter).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener("DOMContentLoaded",installPlanPackageImporter);

/* Prefer canonical workout for direct session export. */
const _oldExportSessionWorkout=exportSessionWorkout;
exportSessionWorkout=function(id){
 const s=db.sessions.find(x=>x.id===id);
 if(sessionStructuredWorkout(s))return exportStructuredSessionWorkout(id);
 return _oldExportSessionWorkout(id);
};



/* V6.28 – My Trainings Coach, Supabase-backed */
