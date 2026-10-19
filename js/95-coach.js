const COACH_SCHEMA="mein-training.plan-package.v1";
let coachState={profile:null,requests:[],packages:[],loaded:false};

async function coachUser(){
  if(!sb){throw new Error("Cloud-Verbindung fehlt. Bitte anmelden.")}
  const {data:{user},error}=await sb.auth.getUser();
  if(error)throw error;
  return user||null;
}
async function loadCoachState(){
  const user=await coachUser(); if(!user)return;
  const [p,r,k]=await Promise.all([
    sb.from("coach_profiles").select("*").eq("user_id",user.id).maybeSingle(),
    sb.from("coach_requests").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20),
    sb.from("coach_plan_packages").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20)
  ]);
  for(const [name,result] of [["Profil",p],["Anfragen",r],["Planpakete",k]])if(result.error)throw new Error(name+": "+result.error.message);
  coachState.profile=p.data||null; coachState.requests=r.data||[]; coachState.packages=k.data||[]; coachState.loaded=true;
  renderCoachPanel();
}
async function upsertCoachProfile(patch){
  const user=await coachUser(); if(!user)return;
  const base={user_id:user.id,updated_at:new Date().toISOString(),...(coachState.profile||{}),...patch};
  const {data,error}=await sb.from("coach_profiles").upsert(base,{onConflict:"user_id"}).select().single();
  if(error){alert("Coach-Profil konnte nicht gespeichert werden:\n"+error.message);return}
  coachState.profile=data; renderCoachPanel();
}
function coachCurrentPlan(){
  return db.plans?.find(p=>p.id===db.activePlan)||db.plans?.[0]||null;
}
function coachCurrentBlock(){
  return db.blocks?.find(b=>b.id===db.activeBlock)||null;
}
function coachSnapshot(extra={}){
  const plan=coachCurrentPlan(),block=coachCurrentBlock();
  const sessions=(db.sessions||[]).filter(s=>!plan||s.planId===plan.id||s.plan_id===plan.id);
  const completed=sessions.filter(s=>["done","completed"].includes(s.status)).length;
  const cancelled=sessions.filter(s=>["cancel","cancelled","failed"].includes(s.status)).length;
  return {
    appVersion:APP_VERSION,
    plan:{id:plan?.id||null,title:plan?.title||plan?.name||""},
    block:{id:block?.id||null,title:block?.title||""},
    ftp:coachState.profile?.ftp_watts||null,
    ftpDate:coachState.profile?.ftp_date||null,
    ftpSource:coachState.profile?.ftp_source||null,
    equipment:(db.equipment||db.equipmentProfiles||[]).map(e=>({name:e.name,type:e.type,isDefault:e.isDefault??e.is_default})),
    summary:{sessions:sessions.length,completed,cancelled},
    ...extra
  };
}
async function createCoachRequest(type,requirements=""){
  const user=await coachUser(); if(!user){alert("Bitte zuerst anmelden.");return null}
  const plan=coachCurrentPlan(),block=coachCurrentBlock();
  const row={
    user_id:user.id,
    plan_id:plan?.id||null,
    request_type:type,
    source_block_ref:block?.id||block?.title||null,
    requirements:requirements||null,
    input_snapshot:coachSnapshot({requirements}),
    status:"pending",
    updated_at:new Date().toISOString()
  };
  const {data,error}=await sb.from("coach_requests").insert(row).select().single();
  if(error){alert("Coach-Anfrage konnte nicht erstellt werden:\n"+error.message);return null}
  coachState.requests.unshift(data); renderCoachPanel();
  if(type==="continue_plan"){
    try{
      const {data:fn,error:fe}=await sb.functions.invoke("training-coach",{body:{requestId:data.id}});
      if(fe)throw new Error(await coachFunctionError(fe));
      if(fn?.error)throw new Error(fn.error);
      await loadCoachState();
      if(fn?.packageId)coachPackagePreview(fn.packageId);
    }catch(e){
      console.error("TRAINING_COACH_INVOKE",e);
      await sb.from("coach_requests").update({status:"failed",error_message:String(e?.message||e).slice(0,1500),updated_at:new Date().toISOString()}).eq("id",data.id);
      await loadCoachState();
      alert("Die Anforderung wurde gespeichert, die Planerstellung ist fehlgeschlagen.\n"+(e?.message||e));
    }
  }
  return data;
}
function coachCloseRequestDialog(){document.getElementById("coachRequestDialog")?.remove()}
function coachOpenRequestDialog(initial=""){
 coachCloseRequestDialog();
 const plan=coachCurrentPlan(),block=coachCurrentBlock();
 const overlay=document.createElement("div");overlay.id="coachRequestDialog";
 overlay.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100000;display:flex;align-items:center;justify-content:center;padding:14px";
 overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="coachDialogTitle" style="width:min(620px,100%);max-height:92dvh;overflow:auto;background:var(--card,#20252b);color:var(--text,#fff);border:1px solid #7c8590;border-radius:16px;padding:18px;box-shadow:0 12px 45px #0008">
 <h3 id="coachDialogTitle">Trainingsplan fortsetzen</h3>
 <p class="eq-small">${esc(plan?.title||plan?.name||"Aktueller Plan")} · ${esc(block?.title||"Nächster Block")}</p>
 <label for="coachWishes"><strong>Deine Wünsche und Vorgaben</strong></label>
 <textarea id="coachWishes" rows="9" style="box-sizing:border-box;width:100%;min-height:200px;max-height:48dvh;overflow-y:auto;resize:vertical;border-radius:10px;padding:12px;font:inherit;line-height:1.5;background:var(--bg,#12171c);color:var(--text,#fff);border:1px solid #8c939b" placeholder="Zum Beispiel: verfügbare Trainingstage, maximale Dauer, Indoor/Outdoor, Urlaubszeiten, gewünschte Schwerpunkte, Wettkampfziel …">${esc(initial)}</textarea>
 <div class="eq-small" style="margin:8px 0 14px">Die Wünsche werden mit den gespeicherten Plan-, FTP- und Aktivitätsdaten an den Trainingscoach übermittelt. Eine bestehende Anforderung bleibt im Verlauf abrufbar.</div>
 <div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:flex-end"><button type="button" class="pill" onclick="coachCloseRequestDialog()">Abbrechen</button><button type="button" class="pill primary" id="coachSubmitWishes" onclick="coachSubmitRequestDialog()">Plan erstellen</button></div>
 <div id="coachRequestFeedback" role="status" aria-live="polite" style="margin-top:12px"></div></section>`;
 document.body.appendChild(overlay);
 overlay.querySelector('textarea').focus();
}
async function coachSubmitRequestDialog(){
 const input=document.getElementById("coachWishes"),button=document.getElementById("coachSubmitWishes"),feedback=document.getElementById("coachRequestFeedback");
 if(!input||!button)return;
 const wishes=input.value.trim();button.disabled=true;button.textContent="Anforderung wird verarbeitet …";
 feedback.textContent="Die Wünsche werden gespeichert und die Planerstellung gestartet. Bitte dieses Fenster geöffnet lassen.";
 try{
  const row=await createCoachRequest("continue_plan",wishes);
  if(!row)throw new Error("Die Anforderung konnte nicht gespeichert werden.");
  const fresh=coachState.requests.find(x=>x.id===row.id);
  if(fresh?.status==="ready"){coachCloseRequestDialog();return}
  if(fresh?.status==="failed"){
   feedback.textContent="Die Wünsche wurden gespeichert, aber die Erstellung ist fehlgeschlagen. Du findest die Anforderung unten im Verlauf und kannst sie erneut starten.";
  }else{coachCloseRequestDialog()}
 }catch(e){feedback.textContent="Fehler: "+(e?.message||e)}
 finally{button.disabled=false;button.textContent="Plan erstellen"}
}
function requestPlanContinuation(){coachOpenRequestDialog()}
async function coachRetryRequest(id){
 const r=coachState.requests.find(x=>x.id===id);if(!r)return alert("Anforderung nicht gefunden.");
 coachOpenRequestDialog(r.requirements||"");
}
function coachShowRequest(id){
 const r=coachState.requests.find(x=>x.id===id);if(!r)return;
 const when=new Date(r.created_at).toLocaleString("de-AT");
 const details=`Anforderung vom ${when}\nStatus: ${coachStatusText(r)}\n\nWünsche:\n${r.requirements||"(Keine zusätzlichen Wünsche)"}\n\n${r.error_message?"Fehler: "+r.error_message:""}`;
 alert(details);
}
async function coachFunctionError(error){
 let message=error?.message||String(error);
 try{if(error?.context?.json){const body=await error.context.json();message=body?.error||body?.message||message}
 else if(error?.context?.text){const body=await error.context.text();try{const obj=JSON.parse(body);message=obj.error||obj.message||message}catch{message=body||message}}}catch(_){}
 return message;
}
function ftpTestWorkout(){
 return {version:1,sport:"bike",mode:"erg",steps:[
  {type:"warmup",durationSec:600,powerPctFtp:.50,cadence:85,label:"Einrollen"},
  {type:"steady",durationSec:300,powerPctFtp:.65,cadence:90,label:"Aktivieren"},
  {type:"recovery",durationSec:300,powerPctFtp:.50,cadence:85,label:"Locker"},
  {type:"steady",durationSec:300,powerPctFtp:1.10,cadence:95,label:"5 min hart"},
  {type:"recovery",durationSec:600,powerPctFtp:.50,cadence:85,label:"Erholung"},
  {type:"steady",durationSec:1200,powerPctFtp:1.00,cadence:90,label:"20-min FTP-Test – maximal gleichmäßig"},
  {type:"cooldown",durationSec:600,powerPctFtp:.45,cadence:80,label:"Ausrollen"}
 ]};
}
async function createFTPTestRecord(){
  const user=await coachUser(); if(!user){alert("Bitte zuerst anmelden.");return null}
  const row={user_id:user.id,protocol:"20min",source:"My Trainings Coach",workout:ftpTestWorkout(),metrics:{}};
  const {data,error}=await sb.from("ftp_tests").insert(row).select().single();
  if(error){alert("FTP-Test konnte nicht gespeichert werden:\n"+error.message);return null}
  return data;
}
async function exportFTPTest(){
  await createFTPTestRecord();
  const w=ftpTestWorkout();
  const blob=new Blob([zwoFromStructured("FTP Test 20 min",w)],{type:"application/xml"});
  const file=new File([blob],"FTP_Test_20min.zwo",{type:"application/xml"});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:"FTP Test 20 min"});return}catch(e){if(e.name==="AbortError")return}}
  const a=document.createElement("a");a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();a.remove();
}
async function saveFTPResult(){
  const val=prompt("Ermittelten FTP-Wert in Watt eingeben:","");
  if(val===null)return;
  const ftp=Math.round(Number(String(val).replace(",",".")));
  if(!Number.isFinite(ftp)||ftp<50||ftp>600){alert("Bitte einen plausiblen FTP-Wert in Watt eingeben.");return}
  const src=prompt("Quelle, z. B. MyWhoosh, QZ, Zwift Ride oder MERACH:","MyWhoosh")||"manuell";
  const user=await coachUser(); if(!user)return;
  const today=localTodayISO();
  const {error}=await sb.from("ftp_tests").insert({
    user_id:user.id,test_date:today,protocol:"20min",result_ftp_watts:ftp,source:src,metrics:{}
  });
  if(error){alert("FTP-Ergebnis konnte nicht gespeichert werden:\n"+error.message);return}
  await upsertCoachProfile({ftp_watts:ftp,ftp_date:today,ftp_source:src});
  alert(`FTP gespeichert: ${ftp} W.`);
}
async function applyCoachPackage(id){
  const pkg=coachState.packages.find(x=>x.id===id); if(!pkg)return;
  try{
    if(!pkg.package||pkg.package.schema!==COACH_SCHEMA)throw new Error("Ungültiges Planpaket.");
    importPlanPackageObject(pkg.package,id);
    const now=new Date().toISOString();
    await sb.from("coach_plan_packages").update({applied_at:now}).eq("id",id);
    if(pkg.coach_request_id)await sb.from("coach_requests").update({status:"applied",updated_at:now}).eq("id",pkg.coach_request_id);
    await loadCoachState();
  }catch(e){alert("Planpaket konnte nicht übernommen werden:\n"+e.message)}
}
async function undoCoachPackage(id){
 const item=coachState.packages.find(x=>x.id===id);
 if(!item?.applied_at){alert("Dieses Planpaket wurde noch nicht übernommen.");return}
 const own=(db.sessions||[]).filter(x=>x.coachPackageId===id);
 const protectedRows=own.filter(x=>!["neutral","open",null,undefined].includes(x.status)||x.actualSummary||x.sourceActivityId||x.source_activity_id);
 if(protectedRows.length){alert("Rücknahme gesperrt: "+protectedRows.length+" Einheiten enthalten bereits Fortschritt oder Ist-Daten. Diese Daten werden nicht gelöscht. Bitte zuerst eine sichere manuelle Prüfung durchführen.");return}
 if(!confirm(`Planübernahme zurücknehmen?\n\n${own.length} ausschließlich von diesem Planpaket angelegte, noch unbearbeitete Einheiten werden entfernt.\n\nBestehende Pläne, FTP-Werte und Aktivitäten bleiben erhalten.`))return;
 const snapshot=structuredClone(db);
 try{
  const removed=new Set(own.map(x=>x.id));
  markDeleted("sessions",[...removed]);
  db.sessions=db.sessions.filter(x=>!removed.has(x.id));
  const blockIds=new Set((db.blocks||[]).filter(x=>x.coachPackageId===id&&!db.sessions.some(y=>y.blockId===x.id)).map(x=>x.id));
  db.blocks=db.blocks.filter(x=>!blockIds.has(x.id));
  const planIds=new Set((db.plans||[]).filter(x=>x.coachPackageId===id&&!db.sessions.some(y=>y.planId===x.id)&&!db.blocks.some(b=>b.planId===x.id)).map(x=>x.id));
  markDeleted("plans",[...planIds]);
  db.plans=db.plans.filter(x=>!planIds.has(x.id));
  const eventIds=new Set((db.events||[]).filter(x=>x.coachPackageId===id&&!db.plans.some(y=>y.eventId===x.id)).map(x=>x.id));
  db.events=db.events.filter(x=>!eventIds.has(x.id));
  if(planIds.has(db.activePlan))db.activePlan=db.plans[0]?.id||null;
  if(eventIds.has(db.activeEvent))db.activeEvent=db.events[0]?.id||null;
  const {error}=await sb.from("coach_plan_packages").update({applied_at:null}).eq("id",id);
  if(error)throw error;
  if(item.coach_request_id)await sb.from("coach_requests").update({status:"ready",updated_at:new Date().toISOString()}).eq("id",item.coach_request_id);
  persist();await loadCoachState();alert("Planübernahme zurückgenommen. Vorhandene Historie und Ist-Daten blieben erhalten.");
 }catch(e){db=snapshot;persist();alert("Rücknahme fehlgeschlagen: "+e.message)}
}
function exportCoachPackage(id){
 const item=coachState.packages.find(x=>x.id===id);if(!item?.package)return alert("Planpaket nicht gefunden.");
 const blob=new Blob([JSON.stringify(item.package,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="My_Trainings_Coach_Planpaket_"+(item.package.packageId||id)+".json";
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function coachPackagePreview(id){
 const item=coachState.packages.find(x=>x.id===id);if(!item?.package)return;
 const pkg=item.package;let count=(pkg.blocks||[]).reduce((n,b)=>n+(b.sessions||[]).length,0);
 const text=`${pkg.plan?.title||"Trainingsplan"}\n${(pkg.blocks||[]).length} Blöcke · ${count} Einheiten\n\nJetzt direkt übernehmen?\nAbbrechen = vorerst nicht übernehmen; der Download bleibt verfügbar.`;
 if(confirm(text))applyCoachPackage(id);
}
function coachStatusText(r){
  return ({pending:"Angefragt",processing:"Wird erstellt",ready:"Bereit",applied:"Übernommen",failed:"Fehler"})[r.status]||r.status;
}


function renderCoach(){
 main.innerHTML=head("My Trainings Coach")+`
 <div class="coach-screen">
  <section class="coach-hero glass">
   <div><strong>Trainingsplanung</strong><div class="eq-small">Planfortsetzung, FTP und Leistungsbasis</div></div>
   <button class="pill" onclick="loadCoachState()">↻ Aktualisieren</button>
  </section>
  <div id="coachScreenContent"><div class="card glass">Coach-Daten werden geladen …</div></div>
 </div>`;
 renderCoachPanel();
 if(!coachState.loaded) loadCoachState();
}
function renderCoachSettingsPanel(){
 const box=document.getElementById("coachSettingsContent");
 if(!box || screen!=="settings") return;
 const profile=coachState.profile;
 const ready=coachState.packages.filter(x=>!x.applied_at);
 const reqs=coachState.requests.slice(0,5);
 box.innerHTML=`
  <div class="coach-settings-grid">
   <div class="coach-settings-card">
    <strong>Leistungsbasis</strong>
    <div class="coach-value">${profile?.ftp_watts?`${profile.ftp_watts} W FTP`:"Noch kein FTP gespeichert"}</div>
    <div class="eq-small">${profile?.ftp_date||""}${profile?.ftp_source?` · ${profile.ftp_source}`:""}</div>
    <div class="stack"><button class="pill" onclick="exportFTPTest()">⚡ FTP-Test exportieren</button><button class="pill" onclick="saveFTPResult()">✓ FTP-Ergebnis speichern</button></div>
   </div>
   <div class="coach-settings-card">
    <strong>Trainingsplanung</strong>
    <div class="coach-value">${coachCurrentBlock()?.title||"Kein Block ausgewählt"}</div>
    <div class="stack"><button class="pill primary" onclick="requestPlanContinuation()">＋ Fortsetzung anfordern</button><button class="pill" onclick="syncIntervalsActivities(true)">↻ Trainingsdaten synchronisieren</button><button class="pill" onclick="loadCoachState()">↻ Aktualisieren</button></div>
   </div>
  </div>
  ${coachState.packages.some(x=>x.applied_at)?`<div class="coach-settings-card coach-section"><strong>Übernommene Coach-Pläne</strong>${coachState.packages.filter(x=>x.applied_at).map(x=>`<div class="coach-row"><span>${x.package?.plan?.title||"Planfortsetzung"}</span><button class="pill" onclick="undoCoachPackage('${x.id}')">Übernahme zurücknehmen</button></div>`).join("")}</div>`:""}
  ${ready.length?`<div class="coach-settings-card coach-section"><strong>Bereit zur Übernahme</strong>${ready.map(x=>`<div class="coach-row"><span>${x.package?.blocks?.[0]?.title||"Neuer Trainingsblock"}</span><button class="pill primary" onclick="coachPackagePreview('${x.id}')">Vorschau / Übernehmen</button><button class="pill" onclick="exportCoachPackage('${x.id}')">JSON herunterladen</button></div>`).join("")}</div>`:""}
  <div class="coach-settings-card coach-section"><strong>Letzte Coach-Anfragen</strong>${reqs.length?reqs.map(r=>`<div class="coach-row"><span>${r.request_type==="continue_plan"?"Plan fortsetzen":r.request_type} · ${coachStatusText(r)}<br><small>${esc((r.requirements||"Keine zusätzlichen Wünsche").slice(0,100))}</small></span><span class="eq-small">${new Date(r.created_at).toLocaleDateString("de-AT")}<br><button class="pill" onclick="coachShowRequest('${r.id}')">Details</button> ${r.status==="failed"?`<button class="pill" onclick="coachRetryRequest('${r.id}')">Erneut versuchen</button>`:""}</span></div>`).join(""):'<div class="eq-small" style="margin-top:8px">Noch keine Coach-Anfrage.</div>'}</div>`;
}
function renderCoachPanel(){ renderCoachSettingsPanel(); }

try{
 sb.channel("mein-training-coach")
  .on("postgres_changes",{event:"*",schema:"public",table:"coach_requests"},()=>loadCoachState())
  .on("postgres_changes",{event:"*",schema:"public",table:"coach_plan_packages"},()=>loadCoachState())
  .on("postgres_changes",{event:"*",schema:"public",table:"coach_profiles"},()=>loadCoachState())
  .subscribe();
}catch(_){}


/* ===== V6.28 imported activity UI ===== */
let importedActivities=[];
let activitiesLoaded=false;
let activityAnalyticsTab=localStorage.getItem("mt_analytics_tab")||"plan";
let openActivityId=null;
const DEMO_ACTIVITY={
 id:"demo-activity",provider:"demo",external_id:"demo",activity_date:new Date().toISOString(),activity_type:"Ride",name:"Sweet Spot – Demo-Aktivität",moving_time_seconds:3900,elapsed_time_seconds:3972,distance_m:28600,elevation_gain_m:214,average_speed_mps:7.33,max_speed_mps:12.7,average_hr:146,max_hr:171,average_cadence:89,average_watts:158,normalized_watts:171,intensity_factor:.81,training_load:72,calories:612,source_device:"MyWhoosh / KICKR CORE",training_session_id:null,match_method:"demo",match_confidence:.92,_demo:true,
 demoPower:[38,45,48,52,68,72,70,74,43,46,69,73,76,72,44,47,70,75,73,68,42,45,50,38],
 demoHr:[42,46,50,54,58,62,66,70,68,64,69,73,76,78,72,69,74,79,82,78,72,67,61,54],
 demoCad:[62,68,72,70,76,78,74,80,66,70,77,81,78,75,68,72,79,80,76,74,70,68,65,61]
};
