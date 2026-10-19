function activityListForUi(){return importedActivities.length?importedActivities:[DEMO_ACTIVITY]}
function fmtDuration(sec){sec=Math.max(0,Number(sec)||0);const h=Math.floor(sec/3600),m=Math.round((sec%3600)/60);return h?`${h}:${String(m).padStart(2,"0")} h`:`${m} min`}
function fmtKm(m){return m==null?"–":`${(Number(m)/1000).toLocaleString("de-AT",{minimumFractionDigits:1,maximumFractionDigits:1})} km`}
function fmtNum(v,suffix="",digits=0){return v==null||v===""?"–":`${Number(v).toLocaleString("de-AT",{maximumFractionDigits:digits})}${suffix}`}
function activitySportEmoji(a){const t=String(a.activity_type||a.name||"").toLowerCase();if(/ride|cycl|bike|rad/.test(t))return"🚴";if(/run|lauf/.test(t))return"🏃";if(/swim|schwimm/.test(t))return"🏊";return"🏋️"}
function activityDateLabel(a){const d=new Date(a.activity_date);return isNaN(d)?"":d.toLocaleString("de-AT",{weekday:"short",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function activityBars(values){return `<div class="activity-bars">${values.map(v=>`<i style="height:${Math.max(5,Math.min(100,v))}%"></i>`).join("")}</div>`}
function syntheticSeries(base,spread=18){return Array.from({length:24},(_,i)=>Math.max(10,Math.min(96,48+Math.sin(i*.8)*spread+((i*13)%17))))}
function rawActivityValue(a,...keys){const r=a.raw_summary||{};for(const k of keys){const v=r?.[k];if(v!==undefined&&v!==null&&v!==""&&Number.isFinite(Number(v)))return Number(v)}return null}
function maxPower(a){return rawActivityValue(a,"max_watts","max_power","icu_max_watts","max_watts_1m")}
function maxCadence(a){return rawActivityValue(a,"max_cadence","icu_max_cadence")}
function maxSpeedKmh(a){const v=a.max_speed_mps??rawActivityValue(a,"max_speed");return v==null?null:Number(v)*3.6}
function leftRightBalance(a){return rawActivityValue(a,"left_right_balance","average_left_power_phase","left_power_balance")}
function extraActivityMetrics(a){
 const mp=a._demo?462:maxPower(a), mc=a._demo?118:maxCadence(a), ms=a._demo?45.7:maxSpeedKmh(a), lr=a._demo?null:leftRightBalance(a);
 const vals=[['Max. Leistung',mp==null?'–':fmtNum(mp,' W')],['Max. Kadenz',mc==null?'–':fmtNum(mc,' rpm')],['Max. Geschwindigkeit',ms==null?'–':fmtNum(ms,' km/h',1)],['Kalorien',a.calories==null?'–':fmtNum(a.calories,' kcal')]];
 if(lr!=null)vals.push(['Links/Rechts',`${fmtNum(lr,' %',1)} / ${fmtNum(100-lr,' %',1)}`]);
 return `<div class="activity-extra-grid">${vals.map(([l,v])=>`<div class="activity-detail-metric"><span>${l}</span><strong>${v}</strong></div>`).join('')}</div><div class="activity-unavailable">Zusätzliche Sensordaten werden automatisch eingeblendet, sobald Intervals.icu sie für die jeweilige Aktivität liefert.</div>`;
}
function activityCard(a){
 const open=String(openActivityId)===String(a.id);const power=a.demoPower||syntheticSeries(a.average_watts||140,20);const hr=a.demoHr||syntheticSeries(a.average_hr||135,14);const cad=a.demoCad||syntheticSeries(a.average_cadence||85,10);
 const relationLabels={
 "planned_match":"✓ Passender Planeinheit automatisch zugeordnet",
 "replacement":"↔ Ersetzt eine geplante Einheit",
 "on_top":"★ On Top – zusätzliche Einheit",
 "instead_of_rest":"⚠ Training statt geplanter Regeneration",
 "unplanned":"★ Ungeplant absolviert (On Top)"
};
 const planned=a.relation_note||relationLabels[a.plan_relation]|| (a.training_session_id?"✓ Mit geplanter Einheit verknüpft":a._demo?"Demo: automatische Soll-/Ist-Zuordnung":"Ungeplante Aktivität");
 return `<button type="button" class="activity-card" onclick="toggleActivityDetail('${esc(String(a.id))}')">
  <div class="activity-card-head"><div><div class="activity-date">${activityDateLabel(a)}</div><h3>${activitySportEmoji(a)} ${esc(a.name||"Training")}</h3><div class="activity-source">${esc(a.source_device||a.provider||"Intervals.icu")}</div></div>${a._demo?'<span class="activity-demo">DEMO</span>':""}</div>
  <div class="activity-kpis"><div class="activity-kpi"><strong>${fmtDuration(a.moving_time_seconds||a.elapsed_time_seconds)}</strong><span>Dauer</span></div><div class="activity-kpi"><strong>${fmtKm(a.distance_m)}</strong><span>Distanz</span></div><div class="activity-kpi"><strong>${fmtNum(a.average_watts," W")}</strong><span>Ø Leistung</span></div><div class="activity-kpi"><strong>${fmtNum(a.training_load,"",0)}</strong><span>Belastung</span></div></div>
  <div class="activity-match">${planned}${a.match_confidence&&!a._demo?` · ${Math.round(Number(a.match_confidence)*100)} %` : ""}</div>
  ${open?`<div class="activity-detail">
   <div class="activity-detail-grid"><div class="activity-detail-metric"><span>Gewichtete Leistung</span><strong>${fmtNum(a.normalized_watts," W")}</strong></div><div class="activity-detail-metric"><span>Ø Herzfrequenz</span><strong>${fmtNum(a.average_hr," bpm")}</strong></div><div class="activity-detail-metric"><span>Max. Herzfrequenz</span><strong>${fmtNum(a.max_hr," bpm")}</strong></div><div class="activity-detail-metric"><span>Ø Kadenz</span><strong>${fmtNum(a.average_cadence," rpm")}</strong></div><div class="activity-detail-metric"><span>Höhenmeter</span><strong>${fmtNum(a.elevation_gain_m," hm")}</strong></div><div class="activity-detail-metric"><span>Intensitätsfaktor</span><strong>${fmtNum(a.intensity_factor,"",2)}</strong></div></div>${extraActivityMetrics(a)}
   <div class="activity-chart"><div class="activity-chart-title"><span>Leistung</span><span>${fmtNum(a.average_watts," W Ø")}</span></div>${activityBars(power)}</div>
   <div class="activity-chart"><div class="activity-chart-title"><span>Herzfrequenz</span><span>${fmtNum(a.average_hr," bpm Ø")}</span></div>${activityBars(hr)}</div>
   <div class="activity-chart"><div class="activity-chart-title"><span>Kadenz</span><span>${fmtNum(a.average_cadence," rpm Ø")}</span></div>${activityBars(cad)}</div>
  </div>`:""}
 </button>`;
}
function toggleActivityDetail(id){openActivityId=String(openActivityId)===String(id)?null:id;renderActivityAnalyticsPanel()}
function setActivityAnalyticsTab(tab){activityAnalyticsTab=tab;localStorage.setItem("mt_analytics_tab",tab);document.getElementById("analyticsExisting")?.toggleAttribute("hidden",tab!=="plan");document.getElementById("analyticsActivities")?.toggleAttribute("hidden",tab!=="activities");document.getElementById("analyticsDevelopment")?.toggleAttribute("hidden",tab!=="development");document.querySelectorAll(".analytics-switch button").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));if((tab==="activities"||tab==="development")&&!activitiesLoaded)loadImportedActivities(false);if(tab==="development")renderDevelopmentAnalytics()}
async function loadImportedActivities(showError=false){
 if(!sb||!cloudUser){activitiesLoaded=true;renderActivityAnalyticsPanel();return}
 try{const {data,error}=await sb.from("activity_imports").select("*").eq("user_id",cloudUser.id).order("activity_date",{ascending:false}).limit(100);if(error)throw error;importedActivities=data||[];activitiesLoaded=true;renderActivityAnalyticsPanel();renderDevelopmentAnalytics();renderCoachSettingsPanel()}catch(e){console.error(e);if(showError)alert("Trainingsdaten konnten nicht geladen werden: "+(e.message||e));}
}
async function syncIntervalsActivities(show=true){
 if(!sb||!cloudUser){if(show)alert("Bitte zuerst bei der Cloud anmelden.");return}
 try{if(show){const b=document.getElementById("activitySyncStatus");if(b)b.textContent="Synchronisierung läuft …"}const {data,error}=await sb.functions.invoke("intervals-sync",{body:{days:90}});if(error)throw error;await loadImportedActivities(false);if(show){const n=data?.count??data?.imported??data?.upserted??importedActivities.length;alert(`Trainingsdaten synchronisiert. ${n} Aktivität${n===1?"":"en"} verarbeitet.`)}}catch(e){console.error(e);if(show)alert("Intervals.icu-Synchronisierung fehlgeschlagen: "+(e.message||e))}
}
function renderActivityAnalyticsPanel(){
 const root=document.getElementById("analyticsActivities");if(!root)return;const list=activityListForUi();const real=importedActivities;const totalKm=real.reduce((s,a)=>s+(Number(a.distance_m)||0),0)/1000;const totalMin=real.reduce((s,a)=>s+(Number(a.moving_time_seconds)||Number(a.elapsed_time_seconds)||0),0)/60;const totalLoad=real.reduce((s,a)=>s+(Number(a.training_load)||0),0);
 root.innerHTML=`<div class="activity-toolbar"><div><strong>Einzelne Trainingseinheiten</strong><div id="activitySyncStatus" class="activity-source">${real.length?`${real.length} Aktivität${real.length===1?"":"en"} aus Intervals.icu`:'Noch keine echte Aktivität – Demo wird angezeigt'}<div class="auto-sync-note">Automatische Synchronisierung aktiv · „Jetzt“ ist nur für sofortiges manuelles Aktualisieren.</div></div></div><button class="pill activity-refresh" title="Normalerweise automatisch. Damit kannst du neue Daten sofort abrufen." onclick="syncIntervalsActivities(true)">↻ Jetzt</button></div>
 <div class="activity-summary"><div class="metric glass"><span>Aktivitäten</span><strong>${real.length}</strong></div><div class="metric glass"><span>Zeit</span><strong>${real.length?`${Math.round(totalMin)} min`:"–"}</strong></div><div class="metric glass"><span>Distanz</span><strong>${real.length?`${totalKm.toLocaleString("de-AT",{maximumFractionDigits:1})} km`:"–"}</strong></div><div class="metric glass"><span>Belastung</span><strong>${real.length?Math.round(totalLoad):"–"}</strong></div></div>
 <div class="activity-grid">${list.map(activityCard).join("")}</div>${!real.length?'<div class="activity-empty">Die Demo-Aktivität ist nur ein optischer Referenzpunkt und wird nicht in Supabase gespeichert oder vom Coach als echtes Training gewertet.</div>':""}`;
}
const _renderAnalyticsV627=renderAnalytics;
renderAnalytics=function(){
 _renderAnalyticsV627();
 const headEl=main.querySelector(".page-head");const nodes=[...main.children].filter(n=>n!==headEl);const existing=document.createElement("div");existing.id="analyticsExisting";nodes.forEach(n=>existing.appendChild(n));
 const sw=document.createElement("div");sw.className="analytics-switch";sw.innerHTML=`<button data-tab="plan" onclick="setActivityAnalyticsTab('plan')">Plan & Fortschritt</button><button data-tab="activities" onclick="setActivityAnalyticsTab('activities')">Einzelne Einheiten</button><button data-tab="development" onclick="setActivityAnalyticsTab('development')">Entwicklung</button>`;
 const activities=document.createElement("div");activities.id="analyticsActivities";const development=document.createElement("div");development.id="analyticsDevelopment";main.insertBefore(sw,headEl?.nextSibling||main.firstChild);main.appendChild(existing);main.appendChild(activities);main.appendChild(development);renderActivityAnalyticsPanel();renderDevelopmentAnalytics();setActivityAnalyticsTab(activityAnalyticsTab);
};

const _renderCoachSettingsPanelV627=renderCoachSettingsPanel;
renderCoachSettingsPanel=function(){
 _renderCoachSettingsPanelV627();const box=document.getElementById("coachSettingsContent");if(!box)return;
 const real=importedActivities.length;const info=document.createElement("div");info.className="coach-settings-card coach-section";info.innerHTML=`<strong>Trainingsdaten</strong><div class="coach-value">${real?`${real} Aktivität${real===1?"":"en"} verfügbar`:"Noch keine Aktivität importiert"}</div><div class="eq-small">Datenquelle: Intervals.icu → Supabase → My Trainings Coach · echte Aktivitäten werden bei der Plananpassung als Ist-Daten berücksichtigt</div><div class="stack"><button class="pill primary" onclick="syncIntervalsActivities(true)">↻ Jetzt synchronisieren</button><button class="pill" onclick="go('analytics');setTimeout(()=>setActivityAnalyticsTab('activities'),0)">◫ Einzelne Einheiten</button></div>`;box.appendChild(info);
};


function trendSportClass(a){
 const type=String(a.activity_type||'').toLowerCase();
 const name=String(a.name||'').toLowerCase();
 const device=String(a.source_device||'').toLowerCase();
 const raw=a.raw_summary||{};
 const identity=(type+' '+name+' '+device).toLowerCase();

 // IMPORTANT: sport identity is derived only from activity type/name/device.
 // Do not scan JSON key names: fields such as "average_stride" contain "ride"
 // and previously caused running/strength/swim activities to be misclassified as cycling.
 if(/(^|\s)(virtualride|ride|cycling|cycle|bike|rad)(\s|$)/.test(identity)){
   const indoorByFlag=raw?.trainer===true;
   const indoorBySource=/zwift|mywhoosh|kickr|smart trainer|trainerroad|rouvy|kinomap|qdomyos|\bqz\b|erg/.test(identity+' '+String(raw?.oauth_client_name||'').toLowerCase());
   const hasRoute=Boolean(raw?.route_id||raw?.map||raw?.polyline||raw?.start_latlng||raw?.start_lat||raw?.start_lon);
   const outdoorByDevice=/igpsport|bsc500|bsc 500|garmin edge|wahoo elemnt|hammerhead/.test(identity);
   if(indoorByFlag||indoorBySource)return'bike_indoor';
   if(hasRoute||outdoorByDevice)return'bike_outdoor';
   if(type==='virtualride')return'bike_unknown';
   return'bike_outdoor';
 }
 if(/(^|\s)(virtualrun|run|running|lauf|jog)(\s|$)/.test(identity)){
   const indoorBySource=/treadmill|laufband|indoor/.test(identity)||raw?.trainer===true;
   const hasRoute=Boolean(raw?.route_id||raw?.map||raw?.polyline||raw?.start_latlng||raw?.start_lat||raw?.start_lon);
   if(indoorBySource)return'run_indoor';
   if(hasRoute)return'run_outdoor';
   if(type==='virtualrun')return'run_unknown';
   return'run_outdoor';
 }
 if(/swim|swimming|schwimm/.test(identity))return'swim';
 if(/strength|weight|kraft|core training|calisthen|functional|betterme|workout/.test(identity))return'strength';
 if(/walk|walking|gehen|spazier|hike|hiking|wandern/.test(identity))return'walk_hike';
 if(/ski|skiing|skitour|alpine|nordic|cross.?country/.test(identity))return'ski';
 if(/row|rowing|rudern/.test(identity))return'rowing';
 if(/elliptical|crosstrainer/.test(identity))return'elliptical';
 return'other';
}
function trendSportLabel(k){
 return ({all:'Alle Sportarten',bike_all:'Rad – gesamt',bike_outdoor:'Rad – Outdoor',bike_indoor:'Rad – Indoor',bike_unknown:'Rad – nicht zugeordnet',run_all:'Laufen – gesamt',run_outdoor:'Laufen – Outdoor',run_indoor:'Laufen – Indoor',run_unknown:'Laufen – nicht zugeordnet',walk_hike:'Gehen / Wandern',swim:'Schwimmen',strength:'Kraft / Functional',ski:'Ski / Skitour',rowing:'Rudern',elliptical:'Crosstrainer',other:'Sonstige'})[k]||k;
}
function trendSportMatch(a,k){
 if(k==='all')return true;
 const c=trendSportClass(a);
 if(k==='bike_all')return c==='bike_outdoor'||c==='bike_indoor'||c==='bike_unknown';
 if(k==='run_all')return c==='run_outdoor'||c==='run_indoor'||c==='run_unknown';
 return c===k;
}
function availableTrendSports(all){
 const classes=new Set(all.map(trendSportClass));
 const hasBike=['bike_outdoor','bike_indoor','bike_unknown'].some(k=>classes.has(k));
 const hasRun=['run_outdoor','run_indoor','run_unknown'].some(k=>classes.has(k));
 const opts=[['all','Alle Sportarten']];
 // Keep the complete cycling split visible whenever any cycling data exists.
 if(hasBike){
   opts.push(['bike_all','Rad – gesamt'],['bike_outdoor','Rad – Outdoor'],['bike_indoor','Rad – Indoor']);
   if(classes.has('bike_unknown'))opts.push(['bike_unknown','Rad – nicht zugeordnet']);
 }
 if(hasRun){
   opts.push(['run_all','Laufen – gesamt'],['run_outdoor','Laufen – Outdoor'],['run_indoor','Laufen – Indoor']);
   if(classes.has('run_unknown'))opts.push(['run_unknown','Laufen – nicht zugeordnet']);
 }
 for(const k of ['walk_hike','swim','strength','ski','rowing','elliptical','other'])if(classes.has(k))opts.push([k,trendSportLabel(k)]);
 return opts;
}
function monthKey(d){const x=new Date(d);return isNaN(x)?'':`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`}
function pctChange(cur,prev){if(!prev)return null;return (cur-prev)/prev*100}
function deltaText(label,cur,prev,unit='',digits=0){if(prev==null||cur==null)return'';const d=pctChange(cur,prev);if(d==null)return'';const cls=Math.abs(d)<1?'trend-neutral':d>0?'trend-positive':'trend-negative';return `<span class="${cls}">${label}: ${d>=0?'+':''}${d.toFixed(1)} %</span>`}
function lineSvg(vals){if(!vals.length)return'';const w=600,h=100,p=8,min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;const pts=vals.map((v,i)=>`${p+(w-2*p)*(i/(Math.max(1,vals.length-1)))},${h-p-(h-2*p)*((v-min)/range)}`).join(' ');return `<svg class="trend-line" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="3" vector-effect="non-scaling-stroke"/><circle cx="${pts.split(' ').at(-1).split(',')[0]}" cy="${pts.split(' ').at(-1).split(',')[1]}" r="5" fill="currentColor"/></svg>`}
function trendAxisV643(arr){
 if(!arr.length)return "";
 const d=arr.map(a=>new Date(a.activity_date)).sort((a,b)=>a-b),f=x=>x.toLocaleDateString("de-AT",{day:"2-digit",month:"2-digit",year:d[d.length-1]-d[0]>31536000000?"2-digit":undefined});
 const mid=d[Math.floor((d.length-1)/2)];
 return `<div class="trend-axis"><span>${f(d[0])}</span><span>${f(mid)}</span><span>${f(d.at(-1))}</span></div>`;
}
function renderDevelopmentAnalytics(){
 const root=document.getElementById('analyticsDevelopment');if(!root)return;
 const all=importedActivities.length?importedActivities:[];
 const sport=document.getElementById('trendSport')?.value||'all';
 const focus=document.getElementById('trendMetric')?.value||'all';
 const range=document.getElementById('trendRange')?.value||'30d';
 const customFrom=document.getElementById('trendFrom')?.value||'';
 const customTo=document.getElementById('trendTo')?.value||'';
 const now=new Date(), endDate=range==='custom'&&customTo?new Date(customTo+'T23:59:59'):now;
 let startDate=new Date(endDate);
 const subDays=n=>startDate.setDate(startDate.getDate()-n);
 if(range==='7d')subDays(6); else if(range==='30d')subDays(29); else if(range==='3m')startDate.setMonth(startDate.getMonth()-3); else if(range==='6m')startDate.setMonth(startDate.getMonth()-6); else if(range==='12m')startDate.setFullYear(startDate.getFullYear()-1); else if(range==='2y')startDate.setFullYear(startDate.getFullYear()-2); else if(range==='year')startDate=new Date(now.getFullYear(),0,1); else if(range==='lastyear'){startDate=new Date(now.getFullYear()-1,0,1);endDate.setFullYear(now.getFullYear()-1,11,31);endDate.setHours(23,59,59)} else if(range==='plan'){const ds=db.sessions.filter(x=>x.planId===db.activePlan).map(x=>x.date).sort();startDate=ds[0]?new Date(ds[0]+'T00:00:00'):new Date(0)} else if(range==='all')startDate=new Date(0); else if(range==='custom'&&customFrom)startDate=new Date(customFrom+'T00:00:00');
 const inRange=a=>{const d=new Date(a.activity_date);return d>=startDate&&d<=endDate};
 const filtered=all.filter(a=>trendSportMatch(a,sport)&&inRange(a));
 const span=Math.max(86400000,endDate-startDate),prevEnd=new Date(startDate.getTime()-1),prevStart=new Date(prevEnd.getTime()-span);
 const prev=all.filter(a=>{const d=new Date(a.activity_date);return trendSportMatch(a,sport)&&d>=prevStart&&d<=prevEnd});
 const ordered=filtered.slice().sort((a,b)=>new Date(a.activity_date)-new Date(b.activity_date));
 const sportCount=filtered.length;
 const rangeLabel=`${startDate.getTime()===0?'Seit erster Aktivität':startDate.toLocaleDateString('de-AT')} – ${endDate.toLocaleDateString('de-AT')}`;

 const nums=(arr,getter)=>arr.map(getter).map(Number).filter(Number.isFinite);
 const avgVals=(arr,getter)=>{const v=nums(arr,getter).filter(x=>x>0);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null};
 const sumVals=(arr,getter)=>nums(arr,getter).reduce((s,x)=>s+x,0);
 const raw=(a,...keys)=>rawActivityValue(a,...keys);

 const metrics=[
  {k:'sessions',label:'Einheiten',unit:'',digits:0,agg:'count',get:a=>1},
  {k:'duration',label:'Trainingszeit',unit:' h',digits:1,agg:'sum',get:a=>(Number(a.moving_time_seconds||a.elapsed_time_seconds)||0)/3600},
  {k:'distance',label:'Distanz',unit:' km',digits:1,agg:'sum',get:a=>(Number(a.distance_m)||0)/1000},
  {k:'elevation',label:'Höhenmeter',unit:' hm',digits:0,agg:'sum',get:a=>Number(a.elevation_gain_m)||0},
  {k:'avg_speed',label:'Ø Geschwindigkeit',unit:' km/h',digits:1,agg:'avg',get:a=>a.average_speed_mps==null?NaN:Number(a.average_speed_mps)*3.6},
  {k:'max_speed',label:'Max. Geschwindigkeit',unit:' km/h',digits:1,agg:'maxavg',get:a=>a.max_speed_mps==null?NaN:Number(a.max_speed_mps)*3.6},
  {k:'avg_watts',label:'Ø Leistung',unit:' W',digits:0,agg:'avg',get:a=>a.average_watts},
  {k:'normalized_watts',label:'Gewichtete Leistung',unit:' W',digits:0,agg:'avg',get:a=>a.normalized_watts},
  {k:'max_watts',label:'Max. Leistung',unit:' W',digits:0,agg:'maxavg',get:a=>raw(a,'max_watts','max_power','icu_max_watts','max_watts_1m')},
  {k:'avg_hr',label:'Ø Herzfrequenz',unit:' bpm',digits:0,agg:'avg',get:a=>a.average_hr},
  {k:'max_hr',label:'Max. Herzfrequenz',unit:' bpm',digits:0,agg:'maxavg',get:a=>a.max_hr},
  {k:'avg_cadence',label:'Ø Kadenz',unit:' rpm',digits:0,agg:'avg',get:a=>a.average_cadence},
  {k:'max_cadence',label:'Max. Kadenz',unit:' rpm',digits:0,agg:'maxavg',get:a=>raw(a,'max_cadence','icu_max_cadence')},
  {k:'intensity',label:'Intensitätsfaktor',unit:'',digits:2,agg:'avg',get:a=>a.intensity_factor},
  {k:'load',label:'Trainingsbelastung',unit:'',digits:0,agg:'sum',get:a=>a.training_load},
  {k:'calories',label:'Kalorien',unit:' kcal',digits:0,agg:'sum',get:a=>a.calories}
 ];
 function aggregate(arr,m){
  if(m.agg==='count')return arr.length;
  const v=nums(arr,m.get).filter(x=>x>0);
  if(!v.length)return null;
  if(m.agg==='sum')return v.reduce((s,x)=>s+x,0);
  if(m.agg==='maxavg')return Math.max(...v);
  return v.reduce((s,x)=>s+x,0)/v.length;
 }
 function valText(v,m){return v==null?'–':`${Number(v).toLocaleString('de-AT',{minimumFractionDigits:m.digits?Math.min(m.digits,1):0,maximumFractionDigits:m.digits})}${m.unit}`}
 function series(m){return ordered.map(a=>Number(m.get(a))).filter(Number.isFinite).filter(v=>v>0)}
 function delta(cur,prv){
  if(cur==null||prv==null||prv===0)return '';
  const d=(cur-prv)/prv*100,cls=Math.abs(d)<1?'trend-neutral':d>0?'trend-positive':'trend-negative';
  return `<span class="${cls}">${d>=0?'+':''}${d.toFixed(1)} % zur Vorperiode</span>`;
 }
 const available=metrics.filter(m=>m.agg==='count'||nums(filtered,m.get).some(v=>v>0));
 const selected=metrics.find(m=>m.k===focus)||metrics.find(m=>m.k==='avg_watts');
 const selectedSeries=focus==='all'?[]:series(selected);
 const selectedPrev=focus==='all'?null:aggregate(prev,selected);
 const selectedCur=focus==='all'?null:aggregate(filtered,selected);

 const overview=available.map(m=>{
  const cur=aggregate(filtered,m),pr=aggregate(prev,m);
  return `<div class="trend-overview-card"><span>${m.label}</span><strong>${valText(cur,m)}</strong><small>${prev.length?delta(cur,pr):''}</small></div>`;
 }).join('');

 const allSeries=available.filter(m=>!['sessions'].includes(m.k)).map(m=>{
  const pts=series(m),cur=aggregate(filtered,m),pr=aggregate(prev,m);
  const meaning=m.agg==='sum'?'Summe im gewählten Zeitraum':m.agg==='avg'?'Durchschnitt pro Einheit':m.agg==='maxavg'?'Höchster Einzelwert im Zeitraum':'Anzahl im Zeitraum';
  return `<div class="trend-mini"><div class="trend-mini-head"><strong>${m.label}</strong><span>${valText(cur,m)}</span></div><div class="trend-stat-explain">${meaning}</div>${pts.length>1?lineSvg(pts):'<div class="activity-empty" style="padding:16px 4px">Zu wenig Datenpunkte</div>'}${trendAxisV643(ordered)}${prev.length?`<div style="font-size:9px;margin-top:4px">${delta(cur,pr)}</div>`:''}</div>`;
 }).join('');

 const dist=aggregate(filtered,metrics.find(m=>m.k==='distance'));
 const elev=aggregate(filtered,metrics.find(m=>m.k==='elevation'));
 const avgW=aggregate(filtered,metrics.find(m=>m.k==='avg_watts'));
 const prevDist=aggregate(prev,metrics.find(m=>m.k==='distance'));
 const prevElev=aggregate(prev,metrics.find(m=>m.k==='elevation'));
 const prevW=aggregate(prev,metrics.find(m=>m.k==='avg_watts'));
 const insight=filtered.length
  ? `Im gewählten Zeitraum wurden ${filtered.length} Einheit${filtered.length===1?'':'en'} ausgewertet${dist!=null?`, ${valText(dist,metrics.find(m=>m.k==='distance'))}`:''}${elev!=null?` und ${valText(elev,metrics.find(m=>m.k==='elevation'))}`:''}. ${prev.length&&dist!=null&&prevDist!=null?`Die Distanz liegt ${dist>=prevDist?'über':'unter'} der Vorperiode (${Math.abs((dist-prevDist)).toLocaleString('de-AT',{maximumFractionDigits:1})} km ${dist>=prevDist?'mehr':'weniger'}). `:''}${prev.length&&avgW!=null&&prevW!=null?`Die durchschnittliche Leistung liegt bei ${Math.round(avgW)} W gegenüber ${Math.round(prevW)} W in der Vorperiode. `:''}${prev.length&&elev!=null&&prevElev!=null?`Höhenmeter: ${Math.round(elev)} hm gegenüber ${Math.round(prevElev)} hm.`:''}`
  : 'Noch keine echten Aktivitäten für diese Auswahl vorhanden.';

 root.innerHTML=`<div class="activity-toolbar"><div><strong>Entwicklung</strong><div class="activity-source">Standardmäßig alle verfügbaren Daten im gewählten Zeitraum · einzelne Kennzahl nur bei Bedarf fokussieren</div></div></div>
 <div class="trend-controls">
  <select id="trendSport" onchange="renderDevelopmentAnalytics()">${availableTrendSports(all).map(([k,l])=>`<option value="${k}" ${sport===k?'selected':''}>${l}</option>`).join('')}</select>
  <select id="trendRange" onchange="renderDevelopmentAnalytics()">
   ${[['7d','7 Tage'],['30d','30 Tage'],['3m','3 Monate'],['6m','6 Monate'],['12m','12 Monate'],['year','Dieses Jahr'],['lastyear','Letztes Jahr'],['2y','Letzte 2 Jahre'],['plan','Seit Planbeginn'],['all','Seit erster Aktivität'],['custom','Benutzerdefiniert']].map(([v,l])=>`<option value="${v}" ${range===v?'selected':''}>${l}</option>`).join('')}
  </select>
  ${range==='custom'?`<div class="trend-custom-dates"><label>Von<input id="trendFrom" type="date" value="${customFrom}" onchange="renderDevelopmentAnalytics()"></label><label>Bis<input id="trendTo" type="date" value="${customTo}" onchange="renderDevelopmentAnalytics()"></label></div>`:''}
  <select id="trendMetric" onchange="renderDevelopmentAnalytics()"><option value="all" ${focus==='all'?'selected':''}>Gesamtübersicht – alle Daten</option>${metrics.filter(m=>m.k!=='sessions').map(m=>`<option value="${m.k}" ${m.k===focus?'selected':''}>Nur ${m.label}</option>`).join('')}</select>
 </div>
 <div class="trend-hero glass">
  <div class="trend-hero-head"><div><h3>${trendSportLabel(sport)} · ${rangeLabel}</h3><div class="activity-source">Vergleich mit vorherigem gleich langen Zeitraum</div></div><span class="activity-demo" style="display:${all.length?'none':'inline-block'}">WARTET AUF DATEN</span></div>
  ${!sportCount?`<div class="activity-empty" style="margin:12px 0">Für <strong>${trendSportLabel(sport)}</strong> gibt es in diesem Monat keine importierten Aktivitäten. Es werden bewusst keine Daten einer anderen Sportart angezeigt.</div>`:''}
  ${focus==='all'
   ? `<div class="trend-overview-head"><div><strong>Gesamtübersicht</strong><div class="activity-source">${available.length} verfügbare Kennzahlen</div></div></div><div class="trend-overview-grid">${overview}</div><div class="trend-overview-head"><div><strong>Entwicklung aller verfügbaren Kennzahlen</strong><div class="activity-source">Verlauf von Einheit zu Einheit</div></div></div><div class="trend-all-series">${allSeries||'<div class="activity-empty">Noch keine verwertbaren Messwerte.</div>'}</div>`
   : `<div class="trend-chart"><div class="trend-chart-head"><span>${selected.label} je Einheit</span><span>${selectedSeries.length} Datenpunkte</span></div>${selectedSeries.length?lineSvg(selectedSeries):'<div class="activity-empty">Keine Datenpunkte für diese Kennzahl.</div>'}${trendAxisV643(ordered)}<div class="trend-focus-note">Zeitraumwert: <strong>${valText(selectedCur,selected)}</strong>${prev.length&&selectedPrev!=null?` · Vorperiode: ${valText(selectedPrev,selected)} · ${delta(selectedCur,selectedPrev)}`:''}</div></div>`}
  <div class="trend-comparison">${insight}</div>
 </div>`;
}

// Automatic, throttled activity sync while the app is in use.
let lastIntervalsAutoSync=0;
async function maybeSyncIntervalsActivities(){if(!cloudUser||!sb||!navigator.onLine)return;const now=Date.now();if(now-lastIntervalsAutoSync<10*60*1000)return;lastIntervalsAutoSync=now;await syncIntervalsActivities(false)}
window.addEventListener("online",maybeSyncIntervalsActivities);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")maybeSyncIntervalsActivities()});
setTimeout(()=>{if(cloudUser){loadImportedActivities(false);maybeSyncIntervalsActivities()}},1800);

/* ===== V6.31 adaptive settings scrolling ===== */
function refreshSettingsScrolling(){
  if(screen!=="settings") return;
  requestAnimationFrame(()=>{
    if(screen!=="settings") return;
    // Keep main as the sole scroll container. "auto" only scrolls if content
    // is actually taller than the available viewport.
    main.style.setProperty("overflow-y","auto","important");
    main.style.setProperty("height","auto","important");
    main.style.setProperty("min-height","0","important");
  });
}
const __v631ToggleSettingsSection=toggleSettingsSection;
toggleSettingsSection=function(name){
  __v631ToggleSettingsSection(name);
  refreshSettingsScrolling();
  setTimeout(refreshSettingsScrolling,60);
  setTimeout(refreshSettingsScrolling,250);
};
const __v631RenderSettings=renderSettings;
renderSettings=function(){
  __v631RenderSettings();
  refreshSettingsScrolling();
  setTimeout(refreshSettingsScrolling,100);
  setTimeout(refreshSettingsScrolling,400);
};

/* ===== V6.32 per-user Intervals.icu connection ===== */
async function loadIntervalsConnectionStatus(){
 const el=document.getElementById("intervalsConnectionStatus");if(!el)return;
 if(!cloudUser||!sb){el.innerHTML='<span class="tutorial-check warn">Zuerst bei der App-Cloud anmelden.</span>';return}
 try{const {data,error}=await sb.functions.invoke("intervals-connect",{body:{action:"status"}});if(error)throw error;
  if(data?.connected){const c=data.connection||{};el.innerHTML=`<span class="tutorial-check ok">✓ Verbunden${c.athlete_name?` mit ${esc(c.athlete_name)}`:""}${c.athlete_id?` · ${esc(c.athlete_id)}`:""}</span>${c.last_sync_at?`<div class="tutorial-note">Letzte Synchronisierung: ${new Date(c.last_sync_at).toLocaleString("de-AT")}</div>`:""}`}
  else el.innerHTML='<span class="tutorial-check warn">Noch nicht mit einem persönlichen Intervals.icu-Konto verbunden.</span>';
 }catch(e){console.error(e);el.textContent="Verbindungsstatus konnte nicht geladen werden."}
}
async function connectOwnIntervals(){
 if(!cloudUser||!sb){alert("Bitte zuerst bei der App anmelden.");return}
 const athleteId=document.getElementById("intervalsAthleteInput")?.value?.trim();const apiKey=document.getElementById("intervalsApiKeyInput")?.value?.trim();
 if(!athleteId||!apiKey){alert("Bitte Athlete ID und persönlichen API Key eintragen.");return}
 try{const {data,error}=await sb.functions.invoke("intervals-connect",{body:{action:"connect",athleteId,apiKey}});if(error)throw error;if(data?.error)throw new Error(data.error);
  const key=document.getElementById("intervalsApiKeyInput");if(key)key.value="";await loadIntervalsConnectionStatus(); await loadIgpsportStatus();await syncIntervalsActivities(false);alert("Intervals.icu ist mit diesem Benutzer verbunden.");
 }catch(e){console.error(e);alert("Verbindung fehlgeschlagen. Athlete ID und API Key bitte prüfen.")}
}

async function loadIgpsportStatus(){
 const el=document.getElementById("igpsConnectionStatus");if(!el)return;
 if(!cloudUser||!sb){el.textContent="Zuerst bei der App-Cloud anmelden.";return}
 try{const {data,error}=await sb.functions.invoke("activity-source-connect",{body:{action:"status"}});if(error)throw error;
  if(data?.connected){const x=data.source||{};el.innerHTML=`<span class="tutorial-check ok">✓ iGPSPORT verbunden</span>${x.last_success_at?`<div class="tutorial-note">Letzter erfolgreicher Abruf: ${new Date(x.last_success_at).toLocaleString("de-AT")}</div>`:""}${x.last_error?`<div class="tutorial-note">${esc(x.last_error)}</div>`:""}`}
  else el.innerHTML='<span class="tutorial-check warn">iGPSPORT noch nicht verbunden.</span>';
 }catch(e){el.textContent="iGPSPORT-Status konnte nicht geladen werden."}
}
async function connectIgpsport(){
 if(!cloudUser||!sb){alert("Bitte zuerst bei der App anmelden.");return}
 const username=document.getElementById("igpsUserInput")?.value?.trim(),password=document.getElementById("igpsPasswordInput")?.value||"",region=document.getElementById("igpsRegionInput")?.value||"intl";
 if(!username||!password){alert("Bitte iGPSPORT Benutzername/E-Mail und Passwort eintragen.");return}
 try{const {data,error}=await sb.functions.invoke("activity-source-connect",{body:{action:"connect",username,password,region}});if(error)throw error;if(data?.error)throw new Error(data.error);
  document.getElementById("igpsPasswordInput").value="";await loadIgpsportStatus();alert("iGPSPORT wurde für den automatischen Server-Sync gespeichert.");
 }catch(e){alert("iGPSPORT-Verbindung konnte nicht gespeichert werden: "+(e.message||e))}
}
async function disconnectIgpsport(){if(!confirm("iGPSPORT-Verbindung wirklich trennen?"))return;try{await sb.functions.invoke("activity-source-connect",{body:{action:"disconnect"}});await loadIgpsportStatus()}catch(e){alert("Trennen fehlgeschlagen.")}}

async function disconnectOwnIntervals(){
 if(!cloudUser||!sb)return;if(!confirm("Intervals.icu für diesen Benutzer wirklich trennen? Bereits importierte Aktivitäten bleiben erhalten."))return;
 try{const {error}=await sb.functions.invoke("intervals-connect",{body:{action:"disconnect"}});if(error)throw error;await loadIntervalsConnectionStatus()}catch(e){alert("Verbindung konnte nicht getrennt werden.")}
}
