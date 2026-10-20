const COACH_SCHEMA="mein-training.plan-package.v1";
let coachState={profile:null,requests:[],packages:[],tests:[],loaded:false};

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
  try{const t=await sb.from("activity_imports").select("activity_date,name,moving_time_seconds,average_watts,normalized_watts,raw_summary").eq("user_id",user.id).or("name.ilike.%ramp%,name.ilike.%ftp%").order("activity_date",{ascending:false}).limit(5);coachState.tests=t.data||[]}catch(e){coachState.tests=[]}
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
/* ===== v6.55: Coach – neuer Plan / bestehenden Plan fortsetzen / Entwurf mit Ergänzungen neu erstellen ===== */
const COACH_DAYS=[[1,"Mo"],[2,"Di"],[3,"Mi"],[4,"Do"],[5,"Fr"],[6,"Sa"],[0,"So"]];
const COACH_FOCUS=["","Grundlagenausdauer","Aufbau / Schwelle","Wettkampfvorbereitung / Spitze","FTP steigern","Erholung / Entlastung","Gewicht & Kraft"];
const COACH_SECTION_STYLE="";
function coachIso(d){const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")}
function coachPlanLastDate(planId){
 const ds=(db.sessions||[]).filter(s=>s.planId===planId).map(s=>String(s.date||"")).filter(Boolean).sort();
 return ds.length?ds[ds.length-1]:"";
}
function coachContextFor(planId){
 const plan=(db.plans||[]).find(p=>p.id===planId)||null;
 if(!plan)return {};
 const ev=(db.events||[]).find(e=>e.id===plan.eventId)||null;
 const sessions=(db.sessions||[]).filter(s=>s.planId===plan.id).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 return {
  plan:{externalId:plan.externalId||plan.id,title:plan.name||plan.title||"",description:String(plan.description||"").slice(0,1000)},
  event:ev?{externalId:ev.externalId||ev.id,title:ev.name||ev.title||"",subtitle:ev.description||ev.subtitle||"",date:ev.date||""}:undefined,
  blocks:(db.blocks||[]).filter(b=>b.planId===plan.id).slice(-60).map(b=>({externalId:b.externalId||b.id,title:b.title||b.name||"",startDate:b.startDate||"",endDate:b.endDate||""})),
  sessions:sessions.slice(-120).map(s=>({date:String(s.date||"").slice(0,10),title:String(s.title||"").slice(0,200),type:s.type||"",status:s.status||""}))
 };
}
function coachPackageAsPrevious(pkg){
 const out=[];
 for(const b of pkg?.blocks||[])for(const s of b.sessions||[])out.push({date:s.date,title:String(s.title||"").slice(0,200),type:s.type||"",description:String(s.description||"").slice(0,300)});
 return out.slice(0,250);
}
async function createCoachRequest(type,requirements="",opts={}){
  const user=await coachUser(); if(!user){alert("Bitte zuerst anmelden.");return null}
  const params=opts.params||{mode:"continue",weeks:4};
  const planId=params.mode==="continue"?(opts.planId||coachCurrentPlan()?.id||null):null;
  const block=coachCurrentBlock();
  const context=opts.context||(planId?coachContextFor(planId):{});
  const row={
    user_id:user.id,
    plan_id:planId,
    request_type:type,
    source_block_ref:planId?(block?.id||block?.title||null):null,
    requirements:requirements||null,
    input_snapshot:coachSnapshot({requirements,params,context}),
    status:"pending",
    updated_at:new Date().toISOString()
  };
  let ins=await sb.from("coach_requests").insert(row).select().single();
  if(ins.error&&ins.error.code==="23503"){ /* Plan noch nicht in der Cloud: ohne Verknüpfung, Kontext reicht dem Coach */
    ins=await sb.from("coach_requests").insert({...row,plan_id:null}).select().single();
  }
  const {data,error}=ins;
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
/** opts: {mode:"new"|"continue", planId, refineOf:packageId, restore:requestRow} */
function coachOpenRequestDialog(initial="",opts={}){
 coachCloseRequestDialog();
 const prefs=coachState.profile?.preferences?.coach||{};
 const restoreParams=opts.restore?.input_snapshot?.params||{};
 const p={mode:"continue",weeks:prefs.weeks||4,trainingDays:prefs.trainingDays||[1,2,3,4,5,6,0],maxMinutes:prefs.maxMinutes||"",environment:prefs.environment||"mixed",focus:prefs.focus||"",...restoreParams,...(opts.mode?{mode:opts.mode}:{})};
 const refine=!!opts.refineOf;
 const plans=db.plans||[];
 const planId=opts.planId||opts.restore?.plan_id||coachCurrentPlan()?.id||plans[0]?.id||"";
 const last=planId?coachPlanLastDate(planId):"";
 const todayIso=coachIso(Date.now());
 const startDefault=p.startDate&&p.startDate>=todayIso?p.startDate:(last&&last>=todayIso?coachIso(new Date(last+"T12:00:00").getTime()+864e5):todayIso);
 const overlay=document.createElement("div");overlay.id="coachRequestDialog";
 overlay.dataset.refine=opts.refineOf||"";
 overlay.className="coach-overlay";
 const planOpts=plans.map(x=>`<option value="${esc(x.id)}"${x.id===planId?" selected":""}>${esc(x.name||x.title||"Plan")}${coachPlanLastDate(x.id)?" · bis "+esc(coachPlanLastDate(x.id)):""}</option>`).join("");
 const days=COACH_DAYS.map(([v,l])=>`<label class="coach-day"><input type="checkbox" name="coachDay" value="${v}"${(p.trainingDays||[]).includes(v)?" checked":""}> ${l}</label>`).join("");
 const focusOpts=COACH_FOCUS.map(f=>`<option value="${esc(f)}"${f===(p.focus||"")?" selected":""}>${f||"(kein besonderer Schwerpunkt)"}</option>`).join("");
 const weekOpts=[1,2,3,4,6,8,12].map(w=>`<option value="${w}"${w===Number(p.weeks)?" selected":""}>${w} Woche${w>1?"n":""}</option>`).join("");
 const lab=t=>`<div class="coach-label">${t}</div>`;
 overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="coachDialogTitle" class="coach-sheet">
 <h3 id="coachDialogTitle">${refine?"Entwurf überarbeiten":"Trainingsplan vom Coach erstellen"}</h3>
 ${refine?`<p class="eq-small">Der bisherige Entwurf wird mit deinen ergänzten Wünschen komplett neu erstellt. Der alte Entwurf wird danach verworfen.</p>`:`<div style="display:flex;gap:8px;margin:8px 0" role="group" aria-label="Art der Planung">
  <button type="button" class="pill${p.mode==="new"?" primary":""}" id="coachModeNew" onclick="coachSetMode('new')">Neuer Plan</button>
  <button type="button" class="pill${p.mode==="continue"?" primary":""}" id="coachModeContinue" onclick="coachSetMode('continue')"${plans.length?"":" disabled"}>Bestehenden Plan fortsetzen</button></div>`}
 <input type="hidden" id="coachMode" value="${esc(p.mode)}">
 <div id="coachContinueBox"${p.mode==="continue"?"":' style="display:none"'}>
  ${lab('<label for="coachPlan">Plan, der fortgesetzt wird</label>')}
  <select id="coachPlan" onchange="coachPlanChanged()" class="coach-field"${refine?" disabled":""}>${planOpts||'<option value="">(kein Plan vorhanden)</option>'}</select>
 </div>
 <div id="coachNewBox"${p.mode==="new"?"":' style="display:none"'}>
  ${lab('<label for="coachEventSel">Zu welchem Event gehört der Plan?</label>')}
  <select id="coachEventSel" class="coach-field"><option value="">Neues Event anlegen</option>${(db.events||[]).map(e=>`<option value="${esc(e.id)}">${esc(e.name||e.title||"Event")}</option>`).join("")}</select>
  <div class="eq-small">Bei einem bestehenden Event erscheint der Plan nur im Dropdown des Events, nicht als eigenes Event.</div>
  ${lab('<label for="coachGoalTitle">Ziel / Event (optional)</label>')}
  <input id="coachGoalTitle" type="text" maxlength="120" value="${esc(p.goalTitle||"")}" placeholder="z. B. Radmarathon, Grundlagenblock, Abnehmen" class="coach-field">
  ${lab('<label for="coachGoalDate">Zieldatum (optional)</label>')}
  <input id="coachGoalDate" type="date" value="${esc(p.goalDate||"")}" class="coach-field">
 </div>
 ${lab('<label for="coachStart">Beginn</label>')}
 <input id="coachStart" type="date" min="${todayIso}" value="${esc(startDefault)}" class="coach-field">
 <div class="eq-small" id="coachStartHint"></div>
 ${lab('<label for="coachWeeks">Zeitraum</label>')}
 <select id="coachWeeks" class="coach-field">${weekOpts}</select>
 ${lab('An welchen Tagen kannst du trainieren?')}
 <div>${days}</div>
 ${lab('<label for="coachMaxMin">Maximale Dauer pro Einheit (Minuten, optional)</label>')}
 <input id="coachMaxMin" type="number" inputmode="numeric" min="15" max="600" step="5" value="${esc(String(p.maxMinutes||""))}" class="coach-field">
 ${lab('<label for="coachEnv">Indoor / Outdoor</label>')}
 <select id="coachEnv" class="coach-field"><option value="mixed"${p.environment==="mixed"?" selected":""}>Mischung</option><option value="indoor"${p.environment==="indoor"?" selected":""}>Nur Indoor (Rad indoor + Kraft/BetterMe)</option><option value="outdoor"${p.environment==="outdoor"?" selected":""}>Bevorzugt Outdoor</option></select>
 ${lab('<label for="coachFocus">Schwerpunkt</label>')}
 <select id="coachFocus" class="coach-field">${focusOpts}</select>
 ${refine?`${lab('Bisherige Wünsche')}<div class="eq-small coach-quote">${esc(initial||"(keine)")}</div>
 ${lab('<label for="coachWishes">Ergänzungen / Änderungen</label>')}`:lab('<label for="coachWishes">Deine Wünsche und Vorgaben</label>')}
 <textarea id="coachWishes" rows="6" maxlength="2500" class="coach-field coach-textarea" placeholder="${refine?"Was soll anders werden? z. B. mehr Intervalle am Samstag, Dienstag lockerer, eine Entlastungswoche früher …":"z. B. Urlaub vom 3. bis 10., am Wochenende lange Ausfahrt, Knie schonen, Wettkampf am 20.6. …"}">${refine?"":esc(initial)}</textarea>
 <div class="eq-small" style="margin:8px 0 14px">Die Angaben werden zusammen mit deinem Plan, FTP, Equipment und den Aktivitäten der letzten 90 Tage an den Coach übermittelt. Das Ergebnis siehst du erst als Vorschau und kannst es danach übernehmen, mit Ergänzungen neu erstellen lassen oder verwerfen.</div>
 <div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:flex-end"><button type="button" class="pill" onclick="coachCloseRequestDialog()">Abbrechen</button><button type="button" class="pill primary" id="coachSubmitWishes" onclick="coachSubmitRequestDialog()">${refine?"Neu erstellen":"Plan erstellen"}</button></div>
 <div id="coachRequestFeedback" role="status" aria-live="polite" style="margin-top:12px"></div></section>`;
 overlay.dataset.initial=initial||"";
 document.body.appendChild(overlay);
 coachPlanChanged();
}
function coachSetMode(m){
 const mode=document.getElementById("coachMode");if(!mode)return;mode.value=m;
 document.getElementById("coachContinueBox").style.display=m==="continue"?"":"none";
 document.getElementById("coachNewBox").style.display=m==="new"?"":"none";
 document.getElementById("coachModeNew")?.classList.toggle("primary",m==="new");
 document.getElementById("coachModeContinue")?.classList.toggle("primary",m==="continue");
 coachPlanChanged();
}
function coachPlanChanged(){
 const hint=document.getElementById("coachStartHint"),start=document.getElementById("coachStart"),mode=document.getElementById("coachMode")?.value;
 if(!hint||!start)return;
 const planId=document.getElementById("coachPlan")?.value;
 const last=mode==="continue"&&planId?coachPlanLastDate(planId):"";
 if(last){
  const next=coachIso(new Date(last+"T12:00:00").getTime()+864e5);
  hint.textContent="Der gewählte Plan hat Einheiten bis "+last+". Empfohlener Beginn: "+next+".";
  if(!start.dataset.touched&&next>=start.min)start.value=next;
 }else hint.textContent="";
 start.addEventListener("input",()=>{start.dataset.touched="1"},{once:true});
}
function coachReadDialog(){
 const g=id=>document.getElementById(id);
 const mode=g("coachMode").value==="new"?"new":"continue";
 const days=[...document.querySelectorAll('#coachRequestDialog input[name="coachDay"]:checked')].map(x=>Number(x.value));
 const params={mode,weeks:Number(g("coachWeeks").value)||4,trainingDays:days,environment:g("coachEnv").value||"mixed"};
 const pl=coachPlatforms();if(pl.length)params.platforms=pl;
 const start=g("coachStart").value; if(/^\d{4}-\d{2}-\d{2}$/.test(start))params.startDate=start;
 const mm=parseInt(g("coachMaxMin").value,10); if(Number.isFinite(mm)&&mm>=15)params.maxMinutes=Math.min(600,mm);
 const focus=g("coachFocus").value; if(focus)params.focus=focus;
 if(mode==="new"){
  const t=g("coachEventSel").value?"":g("coachGoalTitle").value.trim(); if(t)params.goalTitle=t.slice(0,200);
  const d=g("coachGoalDate").value; if(/^\d{4}-\d{2}-\d{2}$/.test(d))params.goalDate=d;
 }
 return {params,eventId:mode==="new"?(g("coachEventSel").value||""):"",planId:mode==="continue"?(g("coachPlan").value||null):null,wishes:g("coachWishes").value.trim()};
}
async function coachSubmitRequestDialog(){
 const overlay=document.getElementById("coachRequestDialog"),button=document.getElementById("coachSubmitWishes"),feedback=document.getElementById("coachRequestFeedback");
 if(!overlay||!button)return;
 const refineOf=overlay.dataset.refine||"";
 const f=coachReadDialog();
 if(f.params.mode==="continue"&&!f.planId){feedback.textContent="Bitte einen Plan wählen oder „Neuer Plan“ verwenden.";return}
 if(f.params.trainingDays.length===0){feedback.textContent="Bitte mindestens einen Trainingstag auswählen.";return}
 let wishes=f.wishes,context=null;
 if(refineOf){
  const old=coachState.packages.find(x=>x.id===refineOf),oldReq=coachState.requests.find(x=>x.id===old?.coach_request_id);
  wishes=((oldReq?.requirements||"")+(f.wishes?"\n\nERGÄNZUNG/ÄNDERUNG:\n"+f.wishes:"")).trim();
  context=f.params.mode==="continue"&&f.planId?coachContextFor(f.planId):{};
  context.previous=coachPackageAsPrevious(old?.package);
  f.params.refine=true;
 }
 if(f.params.mode==="new"&&f.eventId){const ev=(db.events||[]).find(x=>x.id===f.eventId);if(ev){context=context||{};context.event={externalId:ev.externalId||ev.id,title:ev.name||ev.title||"",subtitle:ev.description||ev.subtitle||"",date:ev.date||""}}}
 button.disabled=true;button.textContent="Der Coach arbeitet … (bis zu 2 Minuten)";
 feedback.textContent="Die Angaben werden gespeichert und die Planerstellung läuft. Bitte dieses Fenster geöffnet lassen.";
 try{
  const row=await createCoachRequest("continue_plan",wishes,{params:f.params,planId:f.planId,context:context||undefined});
  if(!row)throw new Error("Die Anforderung konnte nicht gespeichert werden.");
  /* Einstellungen für das nächste Mal merken (best effort) */
  try{upsertCoachProfile({preferences:{...(coachState.profile?.preferences||{}),coach:{weeks:f.params.weeks,trainingDays:f.params.trainingDays,maxMinutes:f.params.maxMinutes||"",environment:f.params.environment,focus:f.params.focus||""}}})}catch(_){}
  const fresh=coachState.requests.find(x=>x.id===row.id);
  if(fresh?.status==="failed"){
   feedback.textContent="Die Wünsche wurden gespeichert, aber die Erstellung ist fehlgeschlagen. Du findest die Anforderung im Verlauf und kannst sie erneut starten.";
  }else{
   if(refineOf)await coachDiscardPackage(refineOf,true);
   coachCloseRequestDialog();
  }
 }catch(e){feedback.textContent="Fehler: "+(e?.message||e)}
 finally{button.disabled=false;button.textContent=refineOf?"Neu erstellen":"Plan erstellen"}
}
function requestPlanContinuation(mode){coachOpenRequestDialog("",{mode:mode||((db.plans||[]).length?"continue":"new")})}
function requestNewCoachPlan(){coachOpenRequestDialog("",{mode:"new"})}
async function coachRetryRequest(id){
 const r=coachState.requests.find(x=>x.id===id);if(!r)return alert("Anforderung nicht gefunden.");
 coachOpenRequestDialog(r.requirements||"",{restore:r,mode:r.input_snapshot?.params?.mode||"continue",planId:r.plan_id||undefined});
}
function coachRefinePackage(id){
 const item=coachState.packages.find(x=>x.id===id);if(!item)return;
 if(item.applied_at)return alert("Dieser Entwurf wurde bereits übernommen. Mit „Übernahme zurücknehmen“ kannst du ihn entfernen und dann neu erstellen lassen.");
 const r=coachState.requests.find(x=>x.id===item.coach_request_id);
 coachClosePackagePreview();
 coachOpenRequestDialog(r?.requirements||"",{restore:r,mode:r?.input_snapshot?.params?.mode||"continue",planId:r?.plan_id||undefined,refineOf:id});
}
async function coachDiscardPackage(id,silent=false){
 const item=coachState.packages.find(x=>x.id===id);if(!item)return;
 if(item.applied_at)return alert("Ein übernommener Plan kann nur über „Übernahme zurücknehmen“ entfernt werden.");
 if(!silent&&!confirm("Diesen Entwurf verwerfen? Er wird gelöscht; deine Pläne und Einheiten bleiben unverändert."))return;
 try{
  const {error}=await sb.from("coach_plan_packages").delete().eq("id",id);if(error)throw error;
  if(item.coach_request_id)await sb.from("coach_requests").delete().eq("id",item.coach_request_id);
  coachClosePackagePreview();await loadCoachState();
 }catch(e){alert("Entwurf konnte nicht verworfen werden:\n"+(e?.message||e))}
}
function coachShowRequest(id){
 const r=coachState.requests.find(x=>x.id===id);if(!r)return;
 const when=new Date(r.created_at).toLocaleString("de-AT"),p=r.input_snapshot?.params||{};
 const days=(p.trainingDays||[]).map(d=>(COACH_DAYS.find(x=>x[0]===d)||[0,"?"])[1]).join(", ");
 const details=`Anforderung vom ${when}\nStatus: ${coachStatusText(r)}\nArt: ${p.mode==="new"?"Neuer Plan":"Plan fortsetzen"}${p.refine?" (überarbeitet)":""}\nBeginn: ${p.startDate||"–"} · ${p.weeks||"?"} Wochen\nTage: ${days||"alle"}${p.maxMinutes?" · max. "+p.maxMinutes+" min":""}\n\nWünsche:\n${r.requirements||"(Keine zusätzlichen Wünsche)"}\n\n${r.error_message?"Fehler: "+r.error_message:""}`;
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
function coachFtpTestsHtml(){
 const t=coachState.tests||[]; if(!t.length)return "";
 return `<div class="eq-small" style="margin-top:8px">Erkannte Testeinheiten:</div>`+t.map((a,i)=>{const icu=a.raw_summary?.icu_ftp;return `<div class="coach-row"><span>${esc((a.activity_date||"").slice(0,10))} · ${esc(a.name||"Test")}<br><small>${a.average_watts?Math.round(a.average_watts)+" W Ø":""}${icu?` · Intervals.icu-FTP: ${esc(String(icu))} W`:""}</small></span><button class="pill" onclick="useFtpTest(${i})">Als FTP übernehmen</button></div>`}).join("");
}
async function useFtpTest(i){
 const a=(coachState.tests||[])[i]; if(!a)return;
 const icu=a.raw_summary?.icu_ftp;
 const val=prompt("FTP-Wert aus dem Test \""+(a.name||"")+"\" (Rampentest: ca. 75 % der besten Minute, siehe MyWhoosh-Ergebnis):",icu||"");
 if(val===null)return;
 await saveFtpValue(val,"Test "+(a.activity_date||"").slice(0,10)+" · "+(a.name||""),(a.activity_date||"").slice(0,10),"ramp");
}
async function editFTP(){
 const val=prompt("FTP in Watt eintragen oder ändern:",coachState.profile?.ftp_watts||"");
 if(val===null)return;
 await saveFtpValue(val,"manuell",localTodayISO(),"manual");
}
async function saveFtpValue(val,src,date,protocol){
 const ftp=Math.round(Number(String(val).replace(",",".")));
 if(!Number.isFinite(ftp)||ftp<50||ftp>600){alert("Bitte einen plausiblen FTP-Wert in Watt eingeben.");return}
 const user=await coachUser(); if(!user)return;
 const {error}=await sb.from("ftp_tests").insert({user_id:user.id,test_date:date,protocol,result_ftp_watts:ftp,source:src,metrics:{}});
 if(error){alert("FTP konnte nicht gespeichert werden:\n"+error.message);return}
 await upsertCoachProfile({ftp_watts:ftp,ftp_date:date,ftp_source:src});
 alert(`FTP gespeichert: ${ftp} W. Der Coach nutzt diesen Wert ab sofort.`);
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
    /* Neu erstellter Plan wird direkt aktiv; fortgesetzter Plan bleibt aktiv und springt auf den neuen Block */
    const pl=(db.plans||[]).find(x=>x.externalId===pkg.package.plan?.externalId);
    if(pl){
      db.activePlan=pl.id;
      const ev=(db.events||[]).find(x=>x.id===pl.eventId); if(ev)db.activeEvent=ev.id;
      const firstBlock=(db.blocks||[]).filter(b=>b.planId===pl.id&&b.coachPackageId===id).sort((a,b)=>String(a.startDate).localeCompare(String(b.startDate)))[0];
      if(firstBlock)db.activeBlock=firstBlock.id;
      persist();
    }
    const now=new Date().toISOString();
    await sb.from("coach_plan_packages").update({applied_at:now}).eq("id",id);
    if(pkg.coach_request_id)await sb.from("coach_requests").update({status:"applied",updated_at:now}).eq("id",pkg.coach_request_id);
    await loadCoachState();
  }catch(e){alert("Planpaket konnte nicht übernommen werden:\n"+e.message)}
}

function planDeleteInfo(planId){const own=(db.sessions||[]).filter(s=>s.planId===planId);const prog=own.filter(s=>!["neutral","open",null,undefined,""].includes(s.status)||s.actualSummary||s.sourceActivityId).length;return {n:own.length,prog}}
async function coachAfterDelete(){try{await loadCoachState()}catch(_){}}
function removePlanData(planId){
 const ids=(db.sessions||[]).filter(s=>s.planId===planId).map(s=>s.id);
 markDeleted("sessions",ids);db.sessions=db.sessions.filter(s=>s.planId!==planId);
 markDeleted("plans",[planId]);db.plans=db.plans.filter(p=>p.id!==planId);
 db.blocks=(db.blocks||[]).filter(b=>b.planId!==planId);
}
async function deletePlanFlow(planId){
 const pl=(db.plans||[]).find(p=>p.id===planId);if(!pl)return;
 const {n,prog}=planDeleteInfo(planId);
 if(!confirm(`„${pl.name||pl.title||"Plan"}“ löschen?\n\n${n} Einheit(en) werden entfernt${prog?`, davon ${prog} mit Fortschritt oder Ist-Daten (diese gehen verloren)`:""}.\nDas Event bleibt erhalten.`))return;
 const eventId=pl.eventId;
 removePlanData(planId);
 if(db.activePlan===planId)db.activePlan=(db.plans.find(p=>p.eventId===eventId)||db.plans[0]||{}).id||null;
 persist();render();await coachAfterDelete();
}
async function deleteEventFlow(eventId){
 const ev=(db.events||[]).find(e=>e.id===eventId);if(!ev)return;
 const plans=(db.plans||[]).filter(p=>p.eventId===eventId);
 const tot=plans.reduce((a,p)=>{const i=planDeleteInfo(p.id);return {n:a.n+i.n,prog:a.prog+i.prog}},{n:0,prog:0});
 if(!confirm(`Event „${ev.name||ev.title||"Event"}“ löschen?\n\n${plans.length} Plan/Pläne und ${tot.n} Einheit(en) werden entfernt${tot.prog?`, davon ${tot.prog} mit Fortschritt oder Ist-Daten`:""}.\nDas kann nicht rückgängig gemacht werden.`))return;
 if(tot.prog&&!confirm("Wirklich löschen? Erledigte Einheiten und Ist-Daten daran gehen verloren."))return;
 plans.forEach(p=>removePlanData(p.id));
 db.events=db.events.filter(e=>e.id!==eventId);
 if(db.activeEvent===eventId)db.activeEvent=db.events[0]?.id||null;
 if(!(db.plans||[]).some(p=>p.id===db.activePlan))db.activePlan=(db.plans.find(p=>p.eventId===db.activeEvent)||{}).id||null;
 persist();render();await coachAfterDelete();
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
function coachClosePackagePreview(){document.getElementById("coachPackagePreview")?.remove()}

const COACH_PLATFORMS=[["MyWhoosh","MyWhoosh","Workout-Datei (.zwo) in MyWhoosh importieren: Trainings → Eigene Workouts → Import. Die App-Menüs ändern sich, bitte dort nachsehen."],["QZ","QZ (qdomyos-zwift)","In QZ: Trainingsprogramme → .zwo-Datei auswählen."],["Zwift","Zwift","Datei in Dokumente/Zwift/Workouts/<ID> kopieren; danach in Zwift unter Eigene Workouts."],["Intervals.icu","Intervals.icu","In Intervals.icu per Kalender → Workout hochladen (.zwo)."]];
function coachPlatforms(){const p=coachState.profile?.preferences?.platforms;return Array.isArray(p?.list)?p.list:[]}
async function coachSavePlatforms(){
 const list=[...document.querySelectorAll('input[name="coachPlat"]:checked')].map(x=>x.value);
 const primary=document.querySelector('input[name="coachPlatPrimary"]:checked')?.value||list[0]||"";
 await upsertCoachProfile({preferences:{...(coachState.profile?.preferences||{}),platforms:{list,primary:list.includes(primary)?primary:list[0]||""}}});
}
function coachTogglePlatform(k){
 const cur=coachPlatforms().slice(),i=cur.indexOf(k);if(i>=0)cur.splice(i,1);else cur.push(k);
 const prim=coachState.profile?.preferences?.platforms?.primary||"";
 return upsertCoachProfile({preferences:{...(coachState.profile?.preferences||{}),platforms:{list:cur,primary:cur.includes(prim)?prim:cur[0]||""}}});
}
function coachSetPrimaryPlatform(k){
 const cur=coachPlatforms();if(!cur.includes(k))return;
 return upsertCoachProfile({preferences:{...(coachState.profile?.preferences||{}),platforms:{list:cur,primary:k}}});
}
function coachPlatformsHtml(){
 const cur=coachPlatforms(),primary=coachState.profile?.preferences?.platforms?.primary||"";
 return `<div class="coach-settings-card coach-section"><strong>Plattformen</strong><div class="eq-small">Auf welchen Plattformen fährst du? Der Coach plant dafür fahrbare Workouts (.zwo-Datei).</div>
 <div class="coach-chips">${COACH_PLATFORMS.map(([k,l])=>`<button type="button" class="pill${cur.includes(k)?" primary":""}" aria-pressed="${cur.includes(k)}" onclick="coachTogglePlatform('${k}')">${cur.includes(k)?"✓ ":""}${esc(l)}</button>`).join("")}</div>
 ${cur.length>1?`<div class="coach-label" style="margin-top:10px">Hauptplattform</div><div class="coach-chips">${cur.map(k=>`<button type="button" class="pill${primary===k?" primary":""}" aria-pressed="${primary===k}" onclick="coachSetPrimaryPlatform('${k}')">${primary===k?"★ ":""}${esc(k)}</button>`).join("")}</div>`:""}
 <div class="eq-small" style="margin-top:8px">Eine direkte Anbindung gibt es bei MyWhoosh, QZ und Zwift nicht (keine offene Schnittstelle): Workouts werden als .zwo exportiert und dort importiert. Intervals.icu ist bereits angebunden.</div></div>`;
}
function coachIsoWeek(d){const x=new Date(d+"T12:00:00Z");const day=(x.getUTCDay()+6)%7;x.setUTCDate(x.getUTCDate()-day+3);const y=x.getUTCFullYear();const j=new Date(Date.UTC(y,0,4,12));const wk=1+Math.round(((x-j)/864e5-3+((j.getUTCDay()+6)%7))/7);return {wk,y}}
function coachWeekRange(d){const x=new Date(d+"T12:00:00Z");const day=(x.getUTCDay()+6)%7;const a=new Date(x-day*864e5),b=new Date(+a+6*864e5);const f=z=>String(z.getUTCDate()).padStart(2,"0")+"."+String(z.getUTCMonth()+1).padStart(2,"0")+".";return f(a)+"–"+f(b)}
function coachSessionFile(s){const w=normalizeStructuredWorkout(s.workout);const name=((s.date||"")+"_"+(s.title||"Workout")).replace(/[^\p{L}\p{N}_-]+/gu,"_")+".zwo";return new File([new Blob([zwoFromStructured(s.title||"Workout",w)],{type:"application/xml"})],name,{type:"application/xml"})}
async function coachDeliverFiles(files,title){
 if(!files.length){alert("Keine exportierbaren Workouts (Indoor-Einheiten mit Struktur) vorhanden.");return}
 if(navigator.canShare&&navigator.canShare({files})){try{await navigator.share({files,title});return}catch(e){if(e.name==="AbortError")return}}
 for(const f of files){const a=document.createElement("a");a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();a.remove();await new Promise(r=>setTimeout(r,350))}
}
function coachPkgSessions(id){const item=coachState.packages.find(x=>x.id===id);return (item?.package?.blocks||[]).flatMap(b=>b.sessions||[]).filter(s=>s.workout&&(s.workout.steps||[]).length).sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function coachExportOne(id,i){const s=coachPkgSessions(id)[i];if(s)coachDeliverFiles([coachSessionFile(s)],s.title)}
function coachExportAll(id){coachDeliverFiles(coachPkgSessions(id).map(coachSessionFile),"Coach-Workouts")}
function coachExportHelp(){const pl=coachPlatforms();const list=COACH_PLATFORMS.filter(([k])=>!pl.length||pl.includes(k));return list.map(([k,l,h])=>`<div class="eq-small"><b>${esc(l)}:</b> ${esc(h)}</div>`).join("")}
function coachPackagePreview(id){
 const item=coachState.packages.find(x=>x.id===id);if(!item?.package)return;
 coachClosePackagePreview();
 const pkg=item.package,fmtDay=d=>{const x=new Date(d+"T12:00:00");return isNaN(x)?d:x.toLocaleDateString("de-AT",{weekday:"short",day:"2-digit",month:"2-digit"})};
 const minutes=s=>{const sec=(s.workout?.steps||[]).reduce((n,x)=>n+(Number(x.durationSec)||0)*(Number(x.repeat)||1),0);return sec?Math.round(sec/60)+" min":""};
 let count=0;
 const all=[];for(const b of pkg.blocks||[])for(const s of b.sessions||[])all.push({...s,_block:b.title||""});
 all.sort((x,y)=>String(x.date).localeCompare(String(y.date)));
 const wl=coachPkgSessions(id);
 const weeks=new Map();for(const s of all){const k=coachIsoWeek(s.date);const key=k.y+"-"+k.wk;if(!weeks.has(key))weeks.set(key,{k,date:s.date,items:[]});weeks.get(key).items.push(s)}
 const blocks=[...weeks.values()].map(w=>{
  const tot=w.items.reduce((n,s)=>n+Math.round((s.workout?.steps||[]).reduce((m,x)=>m+(Number(x.durationSec)||0)*(Number(x.repeat)||1),0)/60),0);
  const rows=w.items.map(s=>{count++;const xi=wl.findIndex(x=>x.date===s.date&&x.title===s.title);const exp=xi>=0?`<button type="button" class="pill" onclick="coachExportOne('${esc(id)}',${xi})">⇩ .zwo</button>`:"";return `<div class="coach-item"><span class="coach-item-date">${esc(fmtDay(s.date))}</span><span style="flex:1"><strong>${esc(s.title||"")}</strong><br><small>${esc(s.type||"")}${minutes(s)?" · "+minutes(s):""}${s._block?" · "+esc(s._block):""}</small>${s.description?`<details><summary class="eq-small">Details</summary><small>${esc(String(s.description))}</small></details>`:""}</span>${exp}</div>`}).join("");
  return `<div style="margin:14px 0 4px"><strong>KW ${w.k.wk}</strong> <small>${esc(coachWeekRange(w.date))}${tot?" · "+Math.floor(tot/60)+" h "+String(tot%60).padStart(2,"0")+" min Radtraining":""}</small></div>${rows}`;
 }).join("");
 const overlay=document.createElement("div");overlay.id="coachPackagePreview";
 overlay.className="coach-overlay top";
 overlay.innerHTML=`<section role="dialog" aria-modal="true" aria-labelledby="coachPrevTitle" class="coach-sheet wide">
  <h3 id="coachPrevTitle">Vorschau: ${esc(pkg.plan?.title||"Trainingsplan")}</h3>
  <div class="eq-small">${(pkg.blocks||[]).length} Block/Blöcke · ${count} Einheiten${item.applied_at?" · bereits übernommen":""}</div>
  ${pkg.coachNote?`<p class="coach-note">${esc(pkg.coachNote)}</p>`:""}
  ${blocks}
  ${coachPkgSessions(id).length?`<div style="margin-top:14px"><button type="button" class="pill" onclick="coachExportAll('${esc(id)}')">⇩ Alle Workouts als .zwo</button>${coachExportHelp()}</div>`:""}
  <div style="display:flex;flex-wrap:wrap;gap:9px;justify-content:flex-end;margin-top:16px">
   <button type="button" class="pill" onclick="coachClosePackagePreview()">Später entscheiden</button>
   ${item.applied_at?"":`<button type="button" class="pill" onclick="coachDiscardPackage('${esc(id)}')">Verwerfen</button><button type="button" class="pill" onclick="coachRefinePackage('${esc(id)}')">Überarbeiten (Wünsche ergänzen)</button><button type="button" class="pill primary" onclick="coachClosePackagePreview();applyCoachPackage('${esc(id)}')">Übernehmen</button>`}
  </div></section>`;
 document.body.appendChild(overlay);
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

function coachRequestRow(r){
 const label=r.request_type==="continue_plan"?(r.input_snapshot?.params?.mode==="new"?"Neuer Plan":"Plan fortsetzen"):r.request_type;
 return `<div class="coach-row"><span style="min-width:0">${esc(label)} · ${esc(coachStatusText(r))}<br><small>${esc((r.requirements||"Keine zusätzlichen Wünsche").slice(0,70))}</small></span><span class="coach-row-actions"><span class="eq-small">${new Date(r.created_at).toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit"})}</span><button type="button" class="pill" onclick="coachShowRequest('${r.id}')">Details</button>${r.status==="failed"?`<button type="button" class="pill" onclick="coachRetryRequest('${r.id}')">Erneut</button>`:""}</span></div>`;
}
function coachRequestsHtml(reqs){
 const head=reqs.slice(0,3),rest=reqs.slice(3),done=reqs.filter(r=>r.status==="failed"||r.status==="applied").length;
 return `<div class="coach-settings-card coach-section"><strong>Coach-Anfragen</strong>${reqs.length?head.map(coachRequestRow).join(""):'<div class="eq-small" style="margin-top:8px">Noch keine Coach-Anfrage.</div>'}
 ${rest.length?`<details class="coach-more"><summary>Ältere Anfragen (${rest.length})</summary>${rest.map(coachRequestRow).join("")}</details>`:""}
 ${done?`<div class="coach-chips"><button type="button" class="pill" onclick="coachClearRequests()">Fehlgeschlagene &amp; übernommene entfernen (${done})</button></div>`:""}</div>`;
}
async function coachClearRequests(){
 const ids=coachState.requests.filter(r=>r.status==="failed"||r.status==="applied").map(r=>r.id);
 if(!ids.length||!confirm(`${ids.length} erledigte oder fehlgeschlagene Anfrage(n) aus dem Verlauf entfernen?\nÜbernommene Pläne bleiben erhalten.`))return;
 const {error}=await sb.from("coach_requests").delete().in("id",ids);
 if(error){alert("Entfernen fehlgeschlagen:\n"+error.message);return}
 await loadCoachState();
}
function renderCoachSettingsPanel(){
 const box=document.getElementById("coachSettingsContent");
 if(!box || screen!=="settings") return;
 const profile=coachState.profile;
 const ready=coachState.packages.filter(x=>!x.applied_at);
 const appliedPk=coachState.packages.filter(x=>x.applied_at&&(db.sessions||[]).some(s=>s.coachPackageId===x.id));
 const reqs=coachState.requests;
 box.innerHTML=`
  <div class="coach-settings-grid">
   <div class="coach-settings-card">
    <strong>Leistungsbasis</strong>
    <div class="coach-value">${profile?.ftp_watts?`${profile.ftp_watts} W FTP`:"Noch kein FTP gespeichert"}</div>
    <div class="eq-small">${profile?.ftp_date||""}${profile?.ftp_source?` · ${profile.ftp_source}`:""}</div>
    ${coachFtpTestsHtml()}
    <div class="stack"><button class="pill" onclick="editFTP()">✎ FTP manuell eintragen/ändern</button><button class="pill" onclick="exportFTPTest()">⚡ FTP-Test exportieren</button><button class="pill" onclick="saveFTPResult()">✓ FTP-Ergebnis speichern</button></div>
   </div>
   <div class="coach-settings-card">
    <strong>Trainingsplanung</strong>
    <div class="coach-value">${coachCurrentBlock()?.title||"Kein Block ausgewählt"}</div>
    <div class="stack"><button class="pill primary" onclick="requestNewCoachPlan()">＋ Neuer Plan</button><button class="pill primary" onclick="requestPlanContinuation('continue')">＋ Plan fortsetzen</button><button class="pill" onclick="syncIntervalsActivities(true)">↻ Trainingsdaten synchronisieren</button><button class="pill" onclick="loadCoachState()">↻ Aktualisieren</button></div>
   </div>
  </div>
  ${coachPlatformsHtml()}
  ${appliedPk.length?`<div class="coach-settings-card coach-section"><strong>Übernommene Coach-Pläne</strong>${appliedPk.map(x=>`<div class="coach-row"><span>${x.package?.plan?.title||"Planfortsetzung"}</span><button class="pill" onclick="undoCoachPackage('${x.id}')">Übernahme zurücknehmen</button></div>`).join("")}</div>`:""}
  ${ready.length?`<div class="coach-settings-card coach-section"><strong>Bereit zur Übernahme</strong>${ready.map(x=>`<div class="coach-row"><span>${esc(x.package?.plan?.title||"Planentwurf")} · ${esc(x.package?.blocks?.[0]?.title||"Neuer Trainingsblock")}</span><button class="pill primary" onclick="coachPackagePreview('${x.id}')">Vorschau / Übernehmen</button><button class="pill" onclick="exportCoachPackage('${x.id}')">JSON herunterladen</button></div>`).join("")}</div>`:""}
  ${coachRequestsHtml(reqs)}`;
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
