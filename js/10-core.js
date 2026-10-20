const LOCAL_BLOCK_ID="MONDSEE-B1";
const CANONICAL_PLAN_DESCRIPTIONS={"c8a6edc9-7167-4621-8474-7c2f8fa6ecbf":"45 min Z2 · 45 min lockere Grundlage; gleichmäßig, nicht überziehen.","2c412d0d-802b-4704-8ef3-fd209fe07227":"20–30 min · Kurze Ganzkörpereinheit, Schwerpunkt Rumpf/Beine.","5e8d5198-bd4a-4fe4-89eb-0e07da43beb1":"60 min · Einrollen, anschließend kontrollierte Belastungsblöcke; sauber und nicht maximal.","ed7eee2b-0933-4bf5-8fa3-cb7ee552c942":"— · Kein Radtraining. Locker bewegen/Mobilität nach Bedarf.","2af2c410-12d8-4d42-9406-d9170fa553cd":"50–60 min Z2 · Ruhige Ausdauer, gleichmäßige Trittfrequenz.","1bcd549c-ac74-4015-80fb-30de3d22ee8a":"40–55 km · 40–55 km, überwiegend locker; keine harte Bergbelastung.","af11e453-07d4-4d3e-b0c8-569103844c2d":"— · Komplett frei oder Spaziergang.","72dc8ec5-76c9-478c-94fa-f5e03cd516bb":"50–60 min Z2 · Lockere Ausdauer.","87a8421b-7eb5-48af-8929-ea87ea8ccbc8":"20–30 min · Kurze Kraft-/Core-Einheit.","40d41b63-8578-4962-aa1a-27a2f17b97de":"ca. 60 min · Strukturiertes Intervalltraining; kontrollierte Belastung.","01810473-5ed8-4452-acba-1d9dd50d364c":"— · Vor dem Urlaub keine zusätzliche Belastung erzwingen.","4cf54b38-afb1-45df-8317-9cada96127d9":"— · Urlaub mit Tochter. Training nur optional abends.","30cae4ff-df49-443d-9676-687562298aa0":"— · Kein geplantes Radtraining.","c63dede2-3e88-426a-9106-ad213d6f5a2d":"— · Kein geplantes Radtraining.","7285e693-076b-4b6e-885b-beca7aacbd3a":"— · Kein Pflichttraining; optional kurze BetterMe-Einheit abends.","a4a8206b-6486-4df7-b159-01f609364a64":"— · Kein Pflichttraining.","3a0a6527-d545-4eaf-a5cb-9821f892f3f4":"— · Kein Pflichttraining; optional kurze BetterMe-Einheit.","d446970d-ff06-4714-a7f7-cafee7145b70":"— · Kein Pflichttraining.","7c2936fb-37ed-4223-948a-b265c3890040":"— · Kein Pflichttraining.","38026b75-3818-4b76-8cb5-44bdf92f1706":"— · Kein Pflichttraining.","b546a015-e2c6-4f38-8bc6-00871b818911":"— · Rückkehr; noch keine harte Einheit.","d4a09fa6-a290-4770-8be7-3d63425ee914":"40–50 min Z2 · Locker wieder in den Rhythmus kommen.","10f81a4f-aef8-48c2-9c78-3737ede4f514":"20–30 min · Moderate Ganzkörper-/Core-Einheit.","d3165a09-5488-4018-bcdb-1e9a0f28bb4f":"50–60 min Z2 · Ruhige Ausdauer.","9313347a-ca03-4d75-8146-baa24e626efc":"— · Erholung.","fde295b3-8e78-4e8f-aafe-3177b6c399f7":"ca. 60 min · Kurze kontrollierte Intervalle, keine Maximalbelastung.","5434eff2-dbba-41e6-8499-325e740770fd":"50–60 km · 50–60 km; überwiegend Z2, Anstiege kontrolliert fahren.","fe5505a8-149e-49ca-a0ae-cbddf05a6d1f":"— · Erholung.","a5fe7374-f10c-46d5-88db-0bd5c479cb45":"60 min Z2 · Ausdauerarbeit.","2146ce9a-be52-4697-b6b9-e3dfa5660938":"20–30 min · Moderate Kraft-/Core-Einheit.","24dde07d-3606-4ccd-a53a-cd70fd1bf046":"60–70 min · Belastungsblöcke an der oberen Ausdauer-/Tempo-Grenze.","5adf7eee-01bf-4922-925d-e40956abbedf":"— · Erholung.","3b7fd233-6ce5-4ba6-bca7-74ed5cd97bb5":"50–60 min · Lockere bis moderate Ausdauer.","c543c676-fc84-421c-a7cc-8a022af8d68e":"75–90 min Z2 · Längere Indoor-Einheit, gleichmäßig.","1ce85adb-624a-4d41-8e9e-813eeb0a1654":"— · Erholung.","1b64215c-7f05-448f-9501-f395575b7605":"60 min Z2 · Ruhige Ausdauer.","7d0c1480-d72c-419e-9078-f685d568ba2d":"20–30 min · Kraft/Core, nicht bis zur völligen Ermüdung.","6345b4ee-35b5-4e20-bfd7-d974a9892d5f":"60–70 min · Strukturiertes Intervalltraining.","6002cef1-c649-4af4-ad1e-a14c042a2ffd":"— · Erholung.","847bc44b-3006-4429-8866-e1575a360bc7":"40–50 min · Kurze lockere Einheit.","e4138030-7dae-46ba-86cc-e764837f11da":"55–65 km · 55–65 km; zwei längere Anstiege kontrolliert fahren, Fokus Ausdauer.","ba565f3a-2a43-4832-9b2d-c20b96c96e5a":"— · Erholung.","993399b0-03bf-4c00-9191-4ac9d71d8902":"60 min Z2 · 60 min ruhige Ausdauer.","31fc1803-53ef-4893-8119-9b2cdbf113f5":"20–30 min · Moderate Kraft-/Core-Einheit.","bb5c578b-54d2-453b-bbf3-785736c8bf74":"60–70 min · Kontrollierte Tempo-Blöcke.","9a19fe4a-c48e-4d43-a04f-e0264cdf5fee":"— · Erholung.","dae0b3ea-22b4-45f2-a144-0f4e825dc1bc":"50–60 min Z2 · Locker bis moderat.","a327ccf9-d77c-4844-aea8-b0456cbf07f6":"90 min Z2 · Längere Ausdauer-Einheit.","d82011b0-c596-4ddd-8942-c68126bcf467":"— · Erholung."};
const VAPID_PUBLIC_KEY="BOSHi-nP7V_m0ZtxL7klNzQ8HZaGkmBRqp0uF7c27rs-ANZrLuvys3TDWtI20BY29NQYiwvo3YR_EQR4dc_UG0s";
const PUSH_KEY_VERSION="2026-08-19-v2";

const APP_VERSION="6.65";
const KEY="meintraining-v51";
const SUPABASE_URL="https://vhbhocfjzrgdcekjuime.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_iI79yd8iQ0R7hT500Ijtpw_jAWZMu14";
const ORIGINAL_SESSION_DATES=Object.fromEntries(
  (INITIAL_DB.sessions||[]).map(s=>[String(s.id),s.date])
);
let db=JSON.parse(localStorage.getItem(KEY)||"null")||structuredClone(INITIAL_DB);
let screen="overview", planView="list", planFilter={week:"all",equipment:"all",status:"all",weekday:"all"}, editId=null, sb=null, cloudUser=null, syncing=false, lastSync=localStorage.getItem("mt_last_sync")||"";

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function nowLocal(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function isoWeek(d){const x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=x.getUTCDay()||7;x.setUTCDate(x.getUTCDate()+4-day);const y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y)/86400000)+1)/7)}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||""))}
function activeEvent(){return db.events.find(e=>e.id===db.activeEvent)||db.events[0]}
function activePlan(){return db.plans.find(p=>p.id===db.activePlan)||db.plans.find(p=>p.eventId===db.activeEvent)}
function unitEmoji(s){const t=((s.type||"")+" "+(s.title||"")).toLowerCase();if(/betterme|kraft|core|calis/.test(t))return"💪";if(/urlaub|ferien|vacation/.test(t))return"🏖️";if(/ruhe|ruhetag|regeneration|erholung/.test(t))return"😴";if(/mobil/.test(t))return"🧘";if(/indoor/.test(t)&&/rad|bike/.test(t))return"🚲";if(/outdoor/.test(t)&&/rad|bike/.test(t))return"🚴";if(/rad|bike|rennrad/.test(t))return"🚴";if(/lauf|run/.test(t))return"🏃";if(/schwimm|swim/.test(t))return"🏊";if(/ski/.test(t))return"⛷️";return"🏋️"}

function safeSave(){
  const ok=mtStore.set("db",db);
  if(!ok&&!window.__quotaWarned){window.__quotaWarned=true;alert("Speichern nicht möglich (Speicher voll oder gesperrt). Änderungen sind evtl. nicht gesichert – bitte Cloud-Sync prüfen und ein Backup exportieren.")}
  return ok;
}
mtStore.onError(e=>{console.error("Speicherfehler",e);if(!window.__storeWarned){window.__storeWarned=true;alert("Lokale Speicherung gestört: "+(e&&e.message||e)+"\nBitte ein Backup exportieren.")}});
function persist(){safeSave();render();queueSync();maybeAutoBackup()}
function go(s){
 document.querySelectorAll('.nav button').forEach(b=>b.classList.remove('active'));
 const navMap={overview:'navOverview',plan:'navPlan',analytics:'navAnalytics',settings:'navSettings'}; const nb=document.getElementById(navMap[s]); if(nb)nb.classList.add('active');
 const enteringPlan=s==="plan"&&screen!=="plan";
 screen=s;
 if(enteringPlan)planInitialScrollKey=null;
 document.querySelectorAll(".nav button").forEach(b=>b.classList.remove("active"));
 if(s==="overview")navOverview.classList.add("active");
 if(s==="plan")navPlan.classList.add("active");
 if(s==="analytics")navAnalytics.classList.add("active");
 if(s==="settings")navSettings.classList.add("active");
 render();
}
function selectEvent(id){db.activeEvent=id;const ps=db.plans.filter(x=>x.eventId===id);if(ps[0])db.activePlan=ps[0].id;db.planAll=ps.length>1;safeSave();screen="plan";go("plan")}
/* Plan-Ansicht: alle Blöcke (Pläne) des aktiven Events oder nur einer */
function planScopeIds(){
 if(db.planAll){const ids=(db.plans||[]).filter(p=>p.eventId===db.activeEvent).map(p=>p.id);if(ids.length>1)return ids}
 return db.activePlan?[db.activePlan]:[];
}
/* Reparatur: Pläne/Events ohne Namen (ältere Coach-Importe) bekommen den Titel als Namen – sonst scheitert der Sync (name NOT NULL) */
function repairNames(){
 let n=0;
 (db.plans||[]).forEach(p=>{if(!p.name||!String(p.name).trim()){p.name=p.title||"Block";n++}});
 (db.events||[]).forEach(e=>{if(!e.name||!String(e.name).trim()){e.name=e.title||"Event";n++}});
 (db.sessions||[]).forEach(x=>{if(!x.desc&&x.description){x.desc=x.description;n++}});
 return n;
}
function selectPlan(id){if(id==="__all__"){db.planAll=true}else{db.activePlan=id;db.planAll=false}planInitialScrollKey=null;safeSave();render()}

function render(){
 try{if(repairNames())safeSave()}catch(_){}
 main.classList.toggle("plan-screen",screen==="plan");
 if(screen==="overview")renderOverview();
 else if(screen==="plan")renderPlan();
 else if(screen==="analytics")renderAnalytics();
 else if(screen==="settings")renderSettings();
 else { screen="overview"; renderOverview(); }
 updateCloud();
}
function head(title){return `<div class="page-head"><div class="page-title">${esc(title)}</div><div class="cloud-wrap"><div id="cloudStatus" class="cloud">☁️ Cloud wird geprüft …</div><div class="app-version">v${APP_VERSION}</div></div></div>`}
