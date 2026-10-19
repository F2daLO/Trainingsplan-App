const EQUIPMENT_KEY="mt_equipment_v1";
function equipmentAll(){
  try{return JSON.parse(localStorage.getItem(EQUIPMENT_KEY)||"[]")}catch{return[]}
}
function equipmentSaveAll(rows){
  localStorage.setItem(EQUIPMENT_KEY,JSON.stringify(rows));
  renderEquipmentSettings();
  if(cloudUser){
    syncEquipmentNow("push",false).catch?.(()=>{});
  }
}
function inferEquipmentType(session){
  const t=(
    String(session?.training_type||"")+" "+
    String(session?.type||"")+" "+
    String(session?.title||"")
  ).toLowerCase();

  if(/indoor|hometrainer|trainer|zwift|merach/.test(t))return "bike_indoor";
  if(/outdoor|rennrad|road bike|rad outdoor|cycling outdoor/.test(t))return "bike_outdoor";
  if(/rad|bike|cycling/.test(t))return "bike_outdoor";
  if(/lauf|run/.test(t))return "run";
  if(/schwimm|swim/.test(t))return "swim";
  if(/betterme|kraft|strength/.test(t))return "strength";
  if(/ski/.test(t))return "ski";
  return "other";
}
function equipmentForSession(session){
  const type=inferEquipmentType(session);
  const d=String(session?.training_date||session?.date||new Date().toISOString().slice(0,10)).slice(0,10);

  const rows=equipmentAll().filter(e=>
    e.type===type &&
    e.is_default===true &&
    (!e.valid_from || e.valid_from<=d) &&
    (!e.valid_to || e.valid_to>=d)
  );

  rows.sort((a,b)=>String(b.valid_from||"").localeCompare(String(a.valid_from||"")));
  return rows[0]||null;
}
function equipmentDisplay(session){
  const e=equipmentForSession(session);
  return e ? e.name : null;
}
function renderEquipmentSettings(){
  const box=document.getElementById("equipmentList"); if(!box)return;
  const icons={bike_indoor:"🚲",bike_outdoor:"🚴",run:"🏃",swim:"🏊",strength:"💪",ski:"⛷️",other:"⚙️"};
  const names={bike_indoor:"Rad Indoor",bike_outdoor:"Rad Outdoor",run:"Laufen",swim:"Schwimmen",strength:"Kraft / BetterMe",ski:"Ski",other:"Sonstiges"};
  const rows=equipmentAll().sort((a,b)=>(String(a.type||"")+String(a.valid_from||"")).localeCompare(String(b.type||"")+String(b.valid_from||"")));
  box.innerHTML=rows.length?rows.map(e=>`
    <div class="eq-row glass" data-equipment-id="${esc(e.id)}">
      <div class="eq-head">
        <div class="eq-emoji">${icons[e.type]||"⚙️"}</div>
        <div style="min-width:0">
          <div class="eq-title">${escapeHtml(e.name||"Equipment")}</div>
          <div class="eq-small">${escapeHtml(names[e.type]||e.type||"Equipment")}${e.is_default?" · Standard":""}</div>
        </div>
      </div>
      ${(e.note||e.components||e.valid_from||e.valid_to||Number(e.current_km||0)>0||Number(e.maintenance_interval_km||0)>0)
        ? `<button class="eq-note-btn" data-equipment-note="${e.id}" aria-label="Equipment-Info">📝</button>`:""}
    </div>`).join("")
    :'<div class="eq-row glass"><div class="eq-small">Noch kein Equipment hinterlegt.</div></div>';
  bindEquipmentGestures();
}
function openEquipmentEditor(id=""){
  const modal=document.getElementById("equipmentModal");
  const e=equipmentAll().find(x=>x.id===id)||{};

  document.getElementById("eqId").value=e.id||"";
  document.getElementById("eqName").value=e.name||"";
  document.getElementById("eqType").value=e.type||"bike_indoor";
  document.getElementById("eqFrom").value=e.valid_from||new Date().toISOString().slice(0,10);
  document.getElementById("eqTo").value=e.valid_to||"";
  document.getElementById("eqDefault").checked=!!e.is_default;
  document.getElementById("eqStartKm").value=e.start_km??"";
  document.getElementById("eqCurrentKm").value=e.current_km??"";
  document.getElementById("eqMaintInterval").value=e.maintenance_interval_km??"";
  document.getElementById("eqMaintLastKm").value=e.maintenance_last_km??"";
  document.getElementById("eqComponents").value=e.components||"";
  document.getElementById("eqNote").value=e.note||"";

  modal.classList.add("show");
  modal.setAttribute("aria-hidden","false");
  document.body.classList.add("modal-open");

  requestAnimationFrame(()=>{
    document.getElementById("equipmentModalHeading")?.focus({preventScroll:true});
    document.querySelector(".equipment-sheet-body")?.scrollTo({top:0,behavior:"instant"});
  });
}
function closeEquipmentEditor(){
  const modal=document.getElementById("equipmentModal");
  modal?.classList.remove("show");
  modal?.setAttribute("aria-hidden","true");
  document.body.classList.remove("modal-open");
}
function saveEquipment(){
  try{
    const name=document.getElementById("eqName").value.trim();
    const type=document.getElementById("eqType").value;
    const validFrom=document.getElementById("eqFrom").value;

    const missing=[];
    if(!name) missing.push("Bezeichnung");
    if(!type) missing.push("Trainingsart / Funktion");
    if(!validFrom) missing.push("Gültig ab");

    if(missing.length){
      alert("Bitte ausfüllen: "+missing.join(", "));
      return;
    }

    let rows=equipmentAll();
    const id=document.getElementById("eqId").value||crypto.randomUUID();
    const isDefault=document.getElementById("eqDefault").checked;

    if(isDefault){
      rows=rows.map(e=>e.type===type?{...e,is_default:false}:e);
    }

    const numberOrZero=(elementId)=>{
      const raw=document.getElementById(elementId).value.trim();
      if(raw==="") return 0;
      const n=Number(raw.replace(",","."));
      return Number.isFinite(n)?n:0;
    };
    const optionalNumber=(elementId)=>{
      const raw=document.getElementById(elementId).value.trim();
      if(raw==="") return null;
      const n=Number(raw.replace(",","."));
      return Number.isFinite(n)?n:null;
    };

    const row={
      id,
      name,
      type,
      valid_from:validFrom,
      valid_to:document.getElementById("eqTo").value||null,
      is_default:isDefault,
      start_km:numberOrZero("eqStartKm"),
      current_km:numberOrZero("eqCurrentKm"),
      maintenance_interval_km:optionalNumber("eqMaintInterval"),
      maintenance_last_km:numberOrZero("eqMaintLastKm"),
      components:document.getElementById("eqComponents").value.trim(),
      note:document.getElementById("eqNote").value.trim()
    };

    const existing=rows.findIndex(e=>e.id===id);
    if(existing>=0) rows[existing]=row;
    else rows.push(row);

    localStorage.setItem(EQUIPMENT_KEY,JSON.stringify(rows));

    closeEquipmentEditor();
    renderEquipmentSettings();

    if(cloudUser && typeof cloudSaveEquipment==="function"){
      cloudSaveEquipment().catch(err=>{
        console.warn("Equipment Cloud Sync:",err);
        alert("Equipment lokal gespeichert. Cloud-Sync fehlgeschlagen: "+(err?.message||err));
      });
    }
  }catch(err){
    console.error("Equipment speichern:",err);
    alert("Speichern fehlgeschlagen: "+(err?.message||err));
  }
}
function deleteEquipment(id){
  if(confirm("Equipment wirklich löschen?"))equipmentSaveAll(equipmentAll().filter(e=>e.id!==id));
}

function recordEquipmentKm(id){
  const rows=equipmentAll(), e=rows.find(x=>x.id===id); if(!e)return;
  const add=prompt("Zusätzliche Kilometer eintragen:", "0");
  if(add===null)return;
  const km=Number(String(add).replace(",","."));
  if(!Number.isFinite(km)||km<0){alert("Ungültige Kilometerangabe.");return}
  e.current_km=Number(e.current_km||0)+km;
  equipmentSaveAll(rows);
}
function markEquipmentMaintenance(id){
  const rows=equipmentAll(), e=rows.find(x=>x.id===id); if(!e)return;
  e.maintenance_last_km=Number(e.current_km||0);
  equipmentSaveAll(rows);
}
function addDistanceToEquipment(equipmentId,km){
  const rows=equipmentAll(), e=rows.find(x=>x.id===equipmentId); if(!e)return false;
  e.current_km=Number(e.current_km||0)+Number(km||0);
  equipmentSaveAll(rows);
  return true;
}
/* Future Strava hook:
   imported activity -> determine matching equipment -> addDistanceToEquipment(...)
*/
function equipmentForActivity(activity){
  const sessionLike={
    training_type:activity.type||activity.sport_type||"",
    title:activity.name||"",
    training_date:(activity.start_date_local||activity.date||"").slice(0,10)
  };
  return equipmentForSession(sessionLike);
}
async function cloudSaveEquipment(){
  if(!cloudUser||!sb)return {saved:0};

  const rows=equipmentAll().map(e=>({
    id:e.id,
    user_id:cloudUser.id,
    name:e.name||"Equipment",
    type:e.type||"other",
    valid_from:e.valid_from||null,
    valid_to:e.valid_to||null,
    is_default:!!e.is_default,
    note:e.note||"",
    start_km:Number(e.start_km||0),
    current_km:Number(e.current_km||0),
    maintenance_interval_km:e.maintenance_interval_km===null||e.maintenance_interval_km===""?null:Number(e.maintenance_interval_km),
    maintenance_last_km:Number(e.maintenance_last_km||0),
    components:e.components||"",
    updated_at:new Date().toISOString()
  }));

  if(!rows.length)return {saved:0};

  const {error}=await sb.from("equipment_profiles").upsert(rows,{onConflict:"id"});
  if(error)throw error;
  return {saved:rows.length};
}
async function cloudLoadEquipment(){
  if(!cloudUser||!sb)return {loaded:0};

  const {data,error}=await sb.from("equipment_profiles")
    .select("*")
    .eq("user_id",cloudUser.id);

  if(error){
    console.warn("Equipment cloud load failed",error);
    throw error;
  }

  const local=equipmentAll();
  const localMap=new Map(local.map(e=>[String(e.id),e]));

  for(const row of data||[]){
    const cloudRow={
      id:row.id,
      name:row.name||"Equipment",
      type:row.type||"other",
      valid_from:row.valid_from||null,
      valid_to:row.valid_to||null,
      is_default:!!row.is_default,
      note:row.note||"",
      start_km:Number(row.start_km||0),
      current_km:Number(row.current_km||0),
      maintenance_interval_km:row.maintenance_interval_km===null?null:Number(row.maintenance_interval_km||0),
      maintenance_last_km:Number(row.maintenance_last_km||0),
      components:row.components||""
    };
    localMap.set(String(cloudRow.id),cloudRow);
  }

  const merged=[...localMap.values()];
  localStorage.setItem(EQUIPMENT_KEY,JSON.stringify(merged));

  if(screen==="settings")renderEquipmentSettings();
  if(screen==="plan")render();
  return {loaded:(data||[]).length};
}
/* Replace generic training-type wording for presentation only; original plan data stays unchanged. */
function applyEquipmentLabels(){
  document.querySelectorAll("[data-session-id]").forEach(el=>{
    const id=el.getAttribute("data-session-id");
    const s=(typeof sessions!=="undefined"?sessions:[]).find(x=>String(x.id)===String(id));
    const eq=s&&equipmentDisplay(s); if(!eq)return;
    el.querySelectorAll(".training-type,.session-type,[data-role='training-type']").forEach(n=>n.textContent=eq);
  });
}

/* V6.5.3 guaranteed HTML escaping helper */
function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,ch=>({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  })[ch]);
}

/* ===== V6.5.4 equipment card interactions ===== */
function equipmentTypeLabel(type){
  return {bike_indoor:"🚲 Rad Indoor",bike_outdoor:"🚴 Rad Outdoor",run:"🏃 Laufen",swim:"🏊 Schwimmen",strength:"💪 Kraft / BetterMe",ski:"⛷️ Ski",other:"⚙️ Sonstiges"}[type]||"⚙️ Equipment";
}
function closeEquipmentInfo(){
  document.querySelector(".eq-info-backdrop")?.remove();
  document.querySelector(".eq-info-sheet")?.remove();
}
function showEquipmentInfo(id){
  const e=equipmentAll().find(x=>x.id===id); if(!e)return;
  closeEquipmentInfo();

  const current=Number(e.current_km||0);
  const interval=Number(e.maintenance_interval_km||0);
  const last=Number(e.maintenance_last_km||0);
  const since=Math.max(0,current-last);

  const back=document.createElement("div");
  back.className="eq-info-backdrop";
  back.onclick=closeEquipmentInfo;

  const sheet=document.createElement("div");
  sheet.className="eq-info-sheet glass";
  sheet.innerHTML=`<h3>${equipmentTypeLabel(e.type)} · ${escapeHtml(e.name)}</h3>
    ${e.valid_from||e.valid_to?`<div class="eq-info-block"><strong>Gültigkeit</strong><br>${e.valid_from?"ab "+escapeHtml(e.valid_from):""}${e.valid_to?" · bis "+escapeHtml(e.valid_to):""}</div>`:""}
    ${Number.isFinite(current)&&current>0?`<div class="eq-info-block"><strong>Kilometer</strong><br>${current.toFixed(0)} km aktuell${since>0?` · ${since.toFixed(0)} km seit Wartung`:""}</div>`:""}
    ${interval>0?`<div class="eq-info-block"><strong>Wartung</strong><br>Intervall ${interval.toFixed(0)} km${last>0?` · letzte Wartung bei ${last.toFixed(0)} km`:""}</div>`:""}
    ${e.components?`<div class="eq-info-block"><strong>Komponenten / Setup</strong><br>${escapeHtml(e.components)}</div>`:""}
    ${e.note?`<div class="eq-info-block"><strong>Notiz</strong><br>${escapeHtml(e.note)}</div>`:""}
    <button class="pill" style="width:100%" onclick="closeEquipmentInfo()">Schließen</button>`;
  document.body.append(back,sheet);
}
function closeEquipmentActions(){
  document.querySelector(".eq-action-backdrop")?.remove();
  document.querySelector(".eq-action-menu")?.remove();
}
function showEquipmentActions(id){
  const e=equipmentAll().find(x=>x.id===id); if(!e)return;
  closeEquipmentActions();

  const back=document.createElement("div");
  back.className="eq-action-backdrop";
  back.onclick=closeEquipmentActions;

  const menu=document.createElement("div");
  menu.className="eq-action-menu glass";
  menu.innerHTML=`<div style="padding:7px 9px 10px;font-weight:700">${equipmentTypeLabel(e.type)} · ${escapeHtml(e.name)}</div>
    <button onclick="closeEquipmentActions();openEquipmentEditor('${id}')">✏️ Bearbeiten</button>
    <button onclick="closeEquipmentActions();recordEquipmentKm('${id}')">＋ km hinzufügen</button>
    <button onclick="closeEquipmentActions();markEquipmentMaintenance('${id}')">🔧 Wartung erledigt</button>
    <button onclick="closeEquipmentActions();deleteEquipment('${id}')">🗑 Löschen</button>
    <button onclick="closeEquipmentActions()">Abbrechen</button>`;
  document.body.append(back,menu);
}
function bindEquipmentGestures(){
  document.querySelectorAll(".eq-row[data-equipment-id]").forEach(card=>{
    if(card.dataset.eqBound==="1")return;
    card.dataset.eqBound="1";
    const id=card.dataset.equipmentId;
    let startX=0,startY=0;

    card.addEventListener("contextmenu",e=>{
      e.preventDefault();
      showEquipmentActions(id);
    });

    card.addEventListener("touchstart",e=>{
      const t=e.changedTouches[0];
      startX=t.clientX;startY=t.clientY;
    },{passive:true});

    card.addEventListener("touchend",e=>{
      const t=e.changedTouches[0];
      const dx=t.clientX-startX,dy=t.clientY-startY;
      if(dx<-70 && Math.abs(dx)>Math.abs(dy)*1.3){
        e.preventDefault();
        showEquipmentActions(id);
      }
    },{passive:false});
  });

  document.querySelectorAll("[data-equipment-note]").forEach(btn=>{
    if(btn.dataset.eqNoteBound==="1")return;
    btn.dataset.eqNoteBound="1";
    btn.addEventListener("click",e=>{
      e.stopPropagation();
      showEquipmentInfo(btn.dataset.equipmentNote);
    });
  });
}

/* ===== V6.6 settings accordion + backup persistence ===== */
