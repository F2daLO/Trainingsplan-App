function renderOverview(){
 const cards=db.events.map(e=>{
  const blocks=db.plans.filter(p=>p.eventId===e.id);
  const cleanTitle=String(e.name||"").replace(/^🚴\s*/,"").replace(/\s*[–-]\s*Route Typ C$/i,"");
  const detail=e.description||"Route Typ C";
  return `<article class="event-card glass" onclick="selectEvent('${e.id}')">
    <div>
      <h2>${esc(cleanTitle)}</h2>
      <div class="event-sub">${esc(detail)}</div>
    </div>
    <div class="foot">
      <div class="blocks">${blocks.length} Block${blocks.length===1?"":"e"}</div>
      <div class="chev">›</div>
    </div>
  </article>`;
}).join("");
 main.innerHTML=head("Übersicht")+`
 <div class="event-grid">${cards||'<div class="empty">Noch keine Events.</div>'}</div>
 <button class="overview-fab glass" aria-label="Hinzufügen" title="Hinzufügen" onclick="openCreateMenu()">＋</button>`;
}


function isSessionMoved(s){
  const builtInOriginal=ORIGINAL_SESSION_DATES[String(s.id)]||null;
  return !!(
    (s.originalDate && s.originalDate!==s.date) ||
    (builtInOriginal && builtInOriginal!==s.date)
  );
}


function isRestLikeSession(s){
  const t=(String(s?.type||"")+" "+String(s?.title||"")+" "+String(s?.desc||"")).toLowerCase();
  return /ruhe|ruhetag|regeneration|erholung|urlaub|ferien|recovery|rest day/.test(t);
}
function isRealTrainingSession(s){
  return !isRestLikeSession(s);
}
function sameDaySessions(date){
  return (db.sessions||[]).filter(s=>s.date===date);
}
function dayHasRealTraining(date,ignoreId=null){
  return sameDaySessions(date).some(s=>String(s.id)!==String(ignoreId||"") && isRealTrainingSession(s));
}
function reconcileRestDaysForDate(date){
  const rows=sameDaySessions(date);
  const hasReal=rows.some(isRealTrainingSession);
  if(hasReal){
    const before=db.sessions.length;
    markDeleted("sessions",db.sessions.filter(s=>s.date===date && isRestLikeSession(s)).map(s=>s.id));
    db.sessions=db.sessions.filter(s=>!(s.date===date && isRestLikeSession(s)));
    return db.sessions.length!==before;
  }
  return false;
}
function autoCompletePastRestDays(){
  const today=new Date().toISOString().slice(0,10);
  let changed=false;
  for(const s of db.sessions||[]){
    if(!isRestLikeSession(s))continue;
    if(s.date>=today)continue;
    const hasReal=dayHasRealTraining(s.date,s.id);
    if(!hasReal && s.status!=="done"){
      s.status="done";
      s.updatedAt=new Date().toISOString();
      changed=true;
    }
  }
  if(changed)safeSave();
  return changed;
}
function blockStats(planId){
  const rows=db.sessions.filter(s=>s.planId===planId && isRealTrainingSession(s));
  const total=rows.length;
  let done=0,moved=0,cancel=0,open=0;

  rows.forEach(s=>{
    if(isSessionMoved(s))moved++;
    if(s.status==="done")done++;
    else if(s.status==="cancel")cancel++;
    else open++;
  });

  const percent=total ? Math.round((done/total)*100) : 0;
  return {total,done,moved,cancel,open,percent};
}

function blockStatsHTML(planId){
  const st=blockStats(planId);
  return `<div class="block-stats" aria-label="Zusammenfassung dieses Trainingsblocks">
    <div class="block-stats-top">
      <div class="block-stats-total">${st.total} Einheit${st.total===1?"":"en"} im Block</div>
      <div class="block-stats-percent">${st.percent}% erledigt</div>
    </div>
    <div class="block-progress" aria-hidden="true"><span style="width:${st.percent}%"></span></div>
    <div class="block-stat-grid">
      <div class="block-stat done"><strong>${st.done}</strong><span>erledigt</span></div>
      <div class="block-stat move"><strong>${st.moved}</strong><span>verschoben</span></div>
      <div class="block-stat cancel"><strong>${st.cancel}</strong><span>übersprungen</span></div>
      <div class="block-stat open"><strong>${st.open}</strong><span>offen</span></div>
    </div>
  </div>`;
}

function renderPlan(){
 const e=activeEvent(), p=activePlan();
 if(!e||!p){
   main.innerHTML=head("Plan")+'<div class="empty">Kein Plan ausgewählt.</div>';
   return;
 }
 const blocks=db.plans.filter(x=>x.eventId===e.id);
 const fixed=`<div class="plan-fixed">
   ${head("Plan")}
   <section class="plan-head glass">
     <div class="plan-main">
       <div class="plan-event">${esc(e.name)}</div>
       <div class="plan-controls">
         <select onchange="selectPlan(this.value)">
           ${blocks.map(b=>`<option value="${b.id}" ${b.id===p.id?"selected":""}>${esc(b.name)}</option>`).join("")}
         </select>
         <div class="segment">
           <button class="${planView==="list"?"active":""}" onclick="planView='list';planInitialScrollKey=null;render()">Liste</button>
           <button class="${planView==="week"?"active":""}" onclick="planView='week';planInitialScrollKey=null;render()">Woche</button>
         </div>
       </div>
     </div>
     ${blockStatsHTML(p.id)}
   </section>
   <div class="actions-top">
     <button class="pill primary" onclick="openSession()" aria-label="Training hinzufügen"><span class="action-icon">＋</span><span class="action-label">Training</span></button>
     <button class="pill gold" onclick="openSession(null,true)" aria-label="On Top hinzufügen"><span class="action-icon">☆</span><span class="action-label">On Top</span></button>
     <button class="pill filter-pill" onclick="openPlanFilter()" aria-label="Plan filtern"><span class="action-icon">⌁</span><span class="action-label">Filter</span><span id="filterCount">${activePlanFilterCount()}</span></button>${activePlanFilterCount()?`<button class="pill clear-plan-filter" onclick="resetPlanFilterFromPlan()" aria-label="Filter zurücksetzen">×</button>`:""}
   </div>
 </div>`;
 main.innerHTML=fixed+`<div id="planContent" class="plan-scroll"></div>`;
 if(planView==="list")renderList();else renderWeek();
}

function normalizePlanFilter(){
 const p=planFilter||{};
 return {
  week:p.week||"all",
  equipment:p.equipment||"all",
  status:p.status||"all",
  weekday:p.weekday||"all"
 };
}
function activePlanFilterCount(){
 planFilter=normalizePlanFilter();
 return ["week","equipment","status","weekday"].filter(k=>planFilter[k]!=="all").length||""
}
function sessionWeekKey(s){const d=new Date(s.date+"T12:00:00");return `${d.getFullYear()}-${String(isoWeek(d)).padStart(2,"0")}`}
function sessionEquipmentKey(s){return equipmentDisplay(s)||s.type||"Sonstiges"}
function matchesPlanFilter(s){
 planFilter=normalizePlanFilter();
 if(planFilter.weekday!=="all"&&weekdayName(s.date)!==planFilter.weekday)return false;
 if(planFilter.week!=="all"&&sessionWeekKey(s)!==planFilter.week)return false;
 if(planFilter.equipment!=="all"&&sessionEquipmentKey(s)!==planFilter.equipment)return false;
 if(planFilter.status!=="all"){
  const today=new Date().toISOString().slice(0,10);
  if(planFilter.status==="moved"&&!isSessionMoved(s))return false;
  if(planFilter.status==="overdue"&&!(s.date<today&&s.status!=="done"&&s.status!=="cancel"))return false;
  if(planFilter.status==="open"&&!(s.status!=="done"&&s.status!=="cancel"))return false;
  if(planFilter.status==="done"&&s.status!=="done")return false;
  if(planFilter.status==="cancel"&&s.status!=="cancel")return false;
  if(planFilter.status==="topup"&&!s.topup)return false;
 } return true;
}
function currentSessions(){return db.sessions.filter(s=>s.planId===db.activePlan&&matchesPlanFilter(s)).sort((a,b)=>a.date.localeCompare(b.date))}
function openPlanFilter(){
 const all=db.sessions.filter(s=>s.planId===db.activePlan),weeks=[...new Set(all.map(sessionWeekKey))].sort(),eq=[...new Set(all.map(sessionEquipmentKey))].sort();
 pfWeek.innerHTML='<option value="all">Alle Kalenderwochen</option>'+weeks.map(k=>{const [y,w]=k.split("-");return `<option value="${k}">KW ${Number(w)} · ${y}</option>`}).join("");
 pfEquipment.innerHTML='<option value="all">Alle Geräte / Arten</option>'+eq.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join("");
 pfWeek.value=planFilter.week;pfEquipment.value=planFilter.equipment;pfStatus.value=planFilter.status;pfWeekday.value=planFilter.weekday||"all";
 if(document.activeElement)document.activeElement.blur();
 planFilterDialog.showModal();
 requestAnimationFrame(()=>{planFilterDialog.focus({preventScroll:true});});
}
function applyPlanFilter(e){e.preventDefault();planFilterOrigin=null;planFilter={week:pfWeek.value,equipment:pfEquipment.value,status:pfStatus.value,weekday:pfWeekday.value};planInitialScrollKey=null;planFilterDialog.close();render()}
function resetPlanFilterFromPlan(){
 const back=planFilterOrigin==="analytics";
 planFilterOrigin=null;
 planFilter={week:"all",equipment:"all",status:"all",weekday:"all"};
 planInitialScrollKey=null;
 if(back){screen="analytics";render();return}
 render();
}
function resetPlanFilter(){const back=planFilterOrigin==="analytics";planFilterOrigin=null;planFilter={week:"all",equipment:"all",status:"all",weekday:"all"};planInitialScrollKey=null;planFilterDialog.close();if(back)screen="analytics";render()}
function renderList(){
 const arr=currentSessions(), root=document.getElementById("planContent");if(!arr.length){root.innerHTML='<div class="empty">Noch keine Einheiten in diesem Block.</div>';return}
 const groups={};
 arr.forEach(s=>{
   const d=new Date(s.date+"T12:00:00");
   const k=`${d.getFullYear()}-${String(isoWeek(d)).padStart(2,"0")}`;
   (groups[k]??=[]).push(s);
 })
 root.innerHTML=Object.entries(groups)
   .sort(([a],[b])=>a.localeCompare(b))
   .map(([w,items])=>{
     const [year,week]=w.split("-");
     const today=new Date().toISOString().slice(0,10);
     const anchor=items.some(x=>x.date>=today)?' data-future-anchor="1"':"";
     return `<div class="week-title"${anchor}>KW ${Number(week)} · ${year}</div>${items.map(card).join("")}`;
   }).join("");
 requestAnimationFrame(scrollPlanToToday);
}
function card(s){
 const dt=new Date((s.scheduledAt||s.date+"T19:00")+":00");
 const hasManualNote=!!((s.note||"").trim());
 const builtInOriginal=ORIGINAL_SESSION_DATES[String(s.id)]||null;
 const originalDateValue =
   (s.originalDate && s.originalDate!==s.date)
     ? s.originalDate
     : ((builtInOriginal && builtInOriginal!==s.date) ? builtInOriginal : null);
 const original=originalDateValue ? new Date(originalDateValue+"T12:00:00") : null;
 const visualStatus=(isSessionMoved(s) && s.status!=="done" && s.status!=="cancel")?"move":s.status;
 return `<article class="session glass ${visualStatus} ${s.topup?"topup":""}" data-session-id="${s.id}" data-date="${s.date}">
   ${s.topup?'<div class="badge">⭐ ON TOP</div>':""}
   <div class="row">
     <div class="stitle">${unitEmoji(s)} ${esc(s.title)}</div>
     <div class="right-tools">
       ${hasManualNote?`<button class="note-icon" title="Eigene Notiz" aria-label="Eigene Notiz" data-note-id="${s.id}">📝</button>`:""}
       <div class="sdate-wrap">
         <div class="sdate" data-move-id="${s.id}">${dt.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"})} · ${dt.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"})}</div>
         ${original?`<div class="original-date"><span class="move-emoji">↪</span>ursprünglich ${original.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"})}</div>`:""}
       </div>
     </div>
   </div>
   <div class="meta">${esc(equipmentDisplay(s)||s.type||"")}${s.desc?` · ${esc(s.desc)}`:""}</div>
 </article>`;
}
function renderWeek(){
 const arr=currentSessions(), root=document.getElementById("planContent");if(!arr.length){root.innerHTML='<div class="empty">Noch keine Einheiten in diesem Block.</div>';return}
 const by={};arr.forEach(s=>{const d=new Date(s.date+"T12:00:00"),n=(d.getDay()+6)%7,m=new Date(d);m.setDate(d.getDate()-n);const k=m.toISOString().slice(0,10);(by[k]??=[]).push(s)})
 root.innerHTML=Object.keys(by).sort().map(k=>{const m=new Date(k+"T12:00:00");let days="";for(let i=0;i<7;i++){const d=new Date(m);d.setDate(m.getDate()+i);const ds=d.toISOString().slice(0,10);const items=by[k].filter(x=>x.date===ds);days+=`<div class="day glass ${ds===new Date().toISOString().slice(0,10)?"today":""}" data-date="${ds}"><div class="daynum">${d.toLocaleDateString("de-DE",{weekday:"short",day:"2-digit"})}</div>${items.map(x=>`<div class="dayitem ${x.status||"open"} ${x.topup?"topup":""}" data-session-id="${x.id}"><span class="week-emoji">${x.topup?"⭐":""}${unitEmoji(x)}</span><span class="week-text"> ${esc(x.title)}</span></div>`).join("")}</div>`}return `<div class="week-title">${esc(activePlan().name)} · Woche ab ${m.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})}</div><div class="calendar">${days}</div>`}).join("")

 requestAnimationFrame(scrollPlanToToday);
}


function analyticsScope(){
  const event=activeEvent();
  const planIds=event ? new Set(db.plans.filter(p=>p.eventId===event.id).map(p=>p.id)) : new Set(db.plans.map(p=>p.id));
  const sessions=(db.sessions||[]).filter(s=>planIds.has(s.planId) && isRealTrainingSession(s));
  return {event,sessions,plans:db.plans.filter(p=>planIds.has(p.id))};
}
function pct(n,d){return d?Math.round(n/d*100):0}
function weekdayName(date){
  return new Date(date+"T12:00:00").toLocaleDateString("de-DE",{weekday:"long"});
}
function analyticsBar(label,value,max,sub=""){
  const w=max?Math.max(3,Math.round(value/max*100)):0;
  return `<div class="a-bar-row"><div class="a-bar-label"><span>${esc(label)}</span><strong>${value}${sub}</strong></div><div class="a-bar-track"><span style="width:${w}%"></span></div></div>`;
}

let planFilterOrigin=null;
function analyticsToPlan(kind,value=""){
 const {sessions}=analyticsScope();
 const today=localTodayISO();
 let rows=sessions.slice();
 if(kind==="done")rows=rows.filter(s=>s.status==="done");
 else if(kind==="moved")rows=rows.filter(isSessionMoved);
 else if(kind==="movedOpen")rows=rows.filter(s=>isSessionMoved(s)&&s.status!=="done"&&s.status!=="cancel");
 else if(kind==="overdue")rows=rows.filter(s=>s.date<today&&s.status!=="done"&&s.status!=="cancel");
 else if(kind==="future")rows=rows.filter(s=>s.date>=today&&s.status!=="done"&&s.status!=="cancel");
 else if(kind==="cancel")rows=rows.filter(s=>s.status==="cancel");
 else if(kind==="topup")rows=rows.filter(s=>s.topup);
 else if(kind==="weekday")rows=rows.filter(s=>s.status==="done"&&weekdayName(s.date)===value);
 else if(kind==="equipment")rows=rows.filter(s=>sessionEquipmentKey(s)===value);
 if(!rows.length)return;
 const counts={};rows.forEach(s=>counts[s.planId]=(counts[s.planId]||0)+1);
 db.activePlan=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
 planFilter={week:"all",equipment:"all",status:"all",weekday:"all"};
 if(kind==="done")planFilter.status="done";
 else if(kind==="moved")planFilter.status="moved";
 else if(kind==="movedOpen")planFilter.status="moved";
 else if(kind==="overdue")planFilter.status="overdue";
 else if(kind==="future")planFilter.status="open";
 else if(kind==="cancel")planFilter.status="cancel";
 else if(kind==="topup")planFilter.status="topup";
 else if(kind==="weekday"){planFilter.status="done";planFilter.weekday=value}
 else if(kind==="equipment")planFilter.equipment=value;
 planFilterOrigin="analytics";planView="list";planInitialScrollKey=null;screen="plan";render();
}
function analyticsBarLink(label,value,max,kind,arg=""){
 const w=max?Math.max(3,Math.round(value/max*100)):0;
 const call=`analyticsToPlan('${kind}','${String(arg).replace(/\\/g,"\\\\").replace(/'/g,"\\'")}')`;
 return `<button type="button" class="a-bar-row analytics-link" onclick="${call}"><div class="a-bar-label"><span>${esc(label)}</span><strong>${value}</strong></div><div class="a-bar-track"><span style="width:${w}%"></span></div></button>`;
}
function renderAnalytics(){
 const {event,sessions,plans}=analyticsScope(),today=new Date().toISOString().slice(0,10),total=sessions.length;
 const done=sessions.filter(s=>s.status==="done").length,cancelled=sessions.filter(s=>s.status==="cancel").length;
 const moved=sessions.filter(isSessionMoved),movedDone=moved.filter(s=>s.status==="done").length,movedOpen=moved.filter(s=>s.status!=="done"&&s.status!=="cancel").length;
 const overdue=sessions.filter(s=>s.date<today&&s.status!=="done"&&s.status!=="cancel").length;
 const future=sessions.filter(s=>s.date>=today&&s.status!=="done"&&s.status!=="cancel").length,topup=sessions.filter(s=>s.topup).length;
 const wd=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"],wdCounts=Object.fromEntries(wd.map(x=>[x,0]));
 sessions.filter(s=>s.status==="done").forEach(s=>wdCounts[weekdayName(s.date)]++); const wdMax=Math.max(1,...Object.values(wdCounts));
 const equipCounts={},typeEquipment={};
 sessions.forEach(s=>{const type=s.type||"Sonstiges",eq=equipmentDisplay(s)||type;equipCounts[eq]=(equipCounts[eq]||0)+1;typeEquipment[type]??={};typeEquipment[type][eq]=(typeEquipment[type][eq]||0)+1});
 const equipRows=Object.entries(equipCounts).sort((a,b)=>b[1]-a[1]),equipMax=Math.max(1,...equipRows.map(x=>x[1]));
 const pairs={};moved.forEach(s=>{const f=s.originalDate||ORIGINAL_SESSION_DATES[String(s.id)];if(f){const k=`${weekdayName(f)} → ${weekdayName(s.date)}`;pairs[k]=(pairs[k]||0)+1}});
 const pairRows=Object.entries(pairs).sort((a,b)=>b[1]-a[1]),pairMax=Math.max(1,...pairRows.map(x=>x[1]));
 const originals=new Map((INITIAL_DB.sessions||[]).map(s=>[String(s.id),s])),changes=[],changeCounts={};
 sessions.forEach(s=>{const o=originals.get(String(s.id));if(!o)return;const oldEq=equipmentDisplay(o)||o.type||"Sonstiges",newEq=equipmentDisplay(s)||s.type||"Sonstiges";
   if((o.type||"")!==(s.type||"")||oldEq!==newEq){const k=`${oldEq} → ${newEq}`;changeCounts[k]=(changeCounts[k]||0)+1;changes.push({s,oldEq,newEq,from:s.originalDate||ORIGINAL_SESSION_DATES[String(s.id)]||o.date,to:s.date})}});
 const moveRows=moved.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(s=>{const f=s.originalDate||ORIGINAL_SESSION_DATES[String(s.id)]||"",to=s.date;
   return `<div class="move-row"><div><strong>${unitEmoji(s)} ${esc(s.title)}</strong><div class="a-muted">${f?new Date(f+"T12:00:00").toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"})+" → ":""}${new Date(to+"T12:00:00").toLocaleDateString("de-DE",{weekday:"short",day:"2-digit",month:"2-digit"})}</div></div><span class="a-status ${sessionVisualStatus(s)}">${s.status==="done"?"erledigt":s.status==="cancel"?"ausgefallen":"offen"}</span></div>`}).join("");
 main.innerHTML=head("Auswertung")+`
 <section class="analytics-hero glass"><div><div class="a-eyebrow">Gesamtauswertung</div><h2>${esc(event?.name||"Alle Trainings")}</h2><p>Nur tatsächliche Trainingseinheiten; Ruhetage, Regeneration und Urlaub sind ausgeschlossen.</p></div><div class="a-big"><strong>${pct(done,total)}%</strong><span>erledigt</span></div></section>
 <div class="metric-grid">
  <div class="metric glass"><span>Gesamt</span><strong>${total}</strong></div><button class="metric glass done analytics-link" onclick="analyticsToPlan('done')"><span>Erledigt</span><strong>${done}</strong></button>
  <button class="metric glass move analytics-link" onclick="analyticsToPlan('moved')"><span>Verschoben</span><strong>${moved.length}</strong><small>${movedDone} erledigt</small></button>
  <button class="metric glass move analytics-link" onclick="analyticsToPlan('movedOpen')"><span>Verschoben offen</span><strong>${movedOpen}</strong></button>
  <button class="metric glass overdue analytics-link" onclick="analyticsToPlan('overdue')"><span>Überfällig offen</span><strong>${overdue}</strong><small>Termin vor heute</small></button>
  <button class="metric glass analytics-link" onclick="analyticsToPlan('future')"><span>Zukünftig offen</span><strong>${future}</strong><small>heute oder später</small></button>
  <button class="metric glass cancel analytics-link" onclick="analyticsToPlan('cancel')"><span>Ausgefallen</span><strong>${cancelled}</strong></button><button class="metric glass topup analytics-link" onclick="analyticsToPlan('topup')"><span>On Top</span><strong>${topup}</strong></button>
 </div>
 <div class="analytics-grid">
  <section class="analytics-card glass"><h3>Training nach Wochentag</h3><p class="a-muted">Erledigte Trainings nach tatsächlichem Trainingstag.</p>${wd.map(d=>analyticsBarLink(d,wdCounts[d],wdMax,"weekday",d)).join("")}</section>
  <section class="analytics-card glass"><h3>Equipment gesamt</h3><p class="a-muted">Tatsächliche Anzahl der Einheiten je Equipment.</p>${equipRows.map(([k,v])=>analyticsBarLink(k,v,equipMax,"equipment",k)).join("")}</section>
 </div>
 <section class="analytics-card glass"><h3>Trainingsart × Equipment</h3><p class="a-muted">Welche Trainingsarten wie oft mit welchem Equipment geplant bzw. durchgeführt werden.</p>
 ${Object.entries(typeEquipment).sort().map(([t,eqs])=>`<div class="cross-row"><strong>${esc(t)}</strong><div>${Object.entries(eqs).sort((a,b)=>b[1]-a[1]).map(([eq,n])=>`<span class="data-chip">${esc(eq)} <b>${n}</b></span>`).join("")}</div></div>`).join("")}</section>
 <section class="analytics-card glass"><h3>Verschiebungen nach Wochentag</h3><p class="a-muted">Ursprünglicher → tatsächlicher Wochentag.</p>${pairRows.length?pairRows.map(([k,v])=>analyticsBar(k,v,pairMax)).join(""):'<div class="empty-small">Keine Verschiebungen.</div>'}</section>
 <section class="analytics-card glass"><h3>Equipment-/Trainingsart geändert</h3><p class="a-muted">${changes.length} Abweichung${changes.length===1?"":"en"} vom ursprünglichen eingebauten Plan erkannt.</p>
 ${Object.entries(changeCounts).map(([k,v])=>`<span class="data-chip">${esc(k)} <b>${v}×</b></span>`).join("")||'<div class="empty-small">Keine erkannten Änderungen.</div>'}
 ${changes.map(x=>`<div class="move-row"><div><strong>${esc(x.oldEq)} → ${esc(x.newEq)}</strong><div class="a-muted">${esc(x.s.title)} · ${new Date(x.from+"T12:00:00").toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})} → ${new Date(x.to+"T12:00:00").toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})}</div></div></div>`).join("")}</section>
 <section class="analytics-card glass"><h3>Fortschritt nach Block</h3>${plans.map(p=>{const b=blockStats(p.id);return `<div class="block-analysis-row"><div class="block-analysis-title"><strong>${esc(p.name)}</strong><span>${b.done}/${b.total} erledigt · ${b.moved} verschoben · ${b.open} offen</span></div><div class="a-bar-track"><span style="width:${b.percent}%"></span></div><strong>${b.percent}%</strong></div>`}).join("")}</section>
 <section class="analytics-card glass"><h3>Verschiebungen im Detail</h3><p class="a-muted">${moved.length} verschoben · ${movedDone} erledigt · ${movedOpen} offen.</p>${moveRows||'<div class="empty-small">Keine Verschiebungen.</div>'}</section>`;
}
let planInitialScrollKey=null;
let forcePlanTodayOnEntry=false;
function localTodayISO(){
 const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");
 return `${y}-${m}-${day}`;
}
function scrollPlanToToday(){
 if(statusPlanScrollGuard)return;
 const forced=forcePlanTodayOnEntry;
 if(forced){planInitialScrollKey=null;forcePlanTodayOnEntry=false;}
 const root=document.getElementById("planContent");if(!root)return;
 const key=`${db.activePlan||""}:${planView}:${planFilter.week}:${planFilter.equipment}:${planFilter.status}:${planFilter.weekday||"all"}`;
 if(planInitialScrollKey===key)return;
 const today=localTodayISO(),dated=[...root.querySelectorAll("[data-date]")];
 const target=dated.find(el=>el.dataset.date===today)||dated.find(el=>el.dataset.date>today);
 if(!target)return;
 planInitialScrollKey=key;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
   const rr=root.getBoundingClientRect(),tr=target.getBoundingClientRect();
   root.scrollTop=Math.max(0,root.scrollTop+(tr.top-rr.top)-6);
 }));
}
function openSession(id=null,topup=false){
 editId=id;const s=id?db.sessions.find(x=>x.id===id):null;
 sessionHeading.textContent=s?"Training bearbeiten":(topup?"On-Top-Training":"Training hinzufügen");
 sDateTime.value=s?.scheduledAt||nowLocal();sType.value=s?.type||"Indoor Rad";sTitle.value=s?.title||"";sDesc.value=s?.desc||"";sStatus.value=s?.status||"open";sReminder.value="auto";sReminderTime.value="18:00";sTopup.checked=!!(s?.topup||topup);sNote.value=s?.note||"";sessionDialog.showModal()
}
function saveSession(e){
 e.preventDefault();
 const scheduledAt=sDateTime.value||nowLocal(),date=scheduledAt.slice(0,10);
 const previous=editId?db.sessions.find(x=>x.id===editId):null;
 let originalDate=previous?.originalDate||null;
 let status=sStatus.value;

 // Every real date change is a move, independent of how the editor was opened.
 // This also correctly handles two units swapping their dates.
 if(previous && date!==previous.date){
   originalDate=originalDate||previous.date;
   status="move";
 }

 const obj={
   id:editId||crypto.randomUUID(),
   planId:db.activePlan,
   date,
   scheduledAt,
   originalDate,
   gptExplanation:previous?.gptExplanation||null,
   gptExplanationKey:previous?.gptExplanationKey||null,
   type:sType.value,
   title:sTitle.value,
   desc:sDesc.value,
   note:sNote.value,
   status,
   topup:sTopup.checked,
   reminder:"auto",
   reminderTime:"18:00",
   updatedAt:new Date().toISOString()
 };
 const newGptKey=gptExplanationKeyFor(obj);
 if(obj.gptExplanationKey && obj.gptExplanationKey!==newGptKey){
   obj.gptExplanation=null;
   obj.gptExplanationKey=null;
 }
 const i=db.sessions.findIndex(x=>x.id===obj.id);
 if(i>=0)db.sessions[i]=obj;else db.sessions.push(obj);

 if(isRealTrainingSession(obj)){
   reconcileRestDaysForDate(obj.date);
 }

 movingSessionId=null;
 sessionDialog.close();
 persist();
}
function setStatus(id,status){const s=db.sessions.find(x=>x.id===id);if(!s)return;startStatusPlanScrollGuard();s.status=status;s.updatedAt=new Date().toISOString();persist()}
function moveTomorrow(id){
  const s=db.sessions.find(x=>x.id===id);if(!s)return;
  if(!s.originalDate)s.originalDate=s.date;
  const d=new Date((s.scheduledAt||s.date+"T19:00")+":00");
  d.setDate(d.getDate()+1);
  d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
  s.scheduledAt=d.toISOString().slice(0,16);
  s.date=s.scheduledAt.slice(0,10);
  s.status="move";
  s.updatedAt=new Date().toISOString();
  if(isRealTrainingSession(s))reconcileRestDaysForDate(s.date);
  persist();
}
