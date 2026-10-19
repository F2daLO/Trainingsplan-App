function sessionActualDetailV644(id){
 const s=db.sessions.find(x=>x.id===id); if(!s)return;
 let x=s.actualSummary;
 if(!x){
   const a=(importedActivities||[]).find(a=>a.id===s.sourceActivityId||a.training_session_id===s.id);
   if(a)x={duration_s:a.moving_time_seconds||a.elapsed_time_seconds,distance_m:a.distance_m,elevation_gain_m:a.elevation_gain_m,avg_hr:a.average_hr,max_hr:a.max_hr,avg_watts:a.average_watts,normalized_watts:a.normalized_watts,avg_cadence:a.average_cadence,training_load:a.training_load,calories:a.calories,source_device:a.source_device,provider:a.provider};
 }
 closeInfoSheet?.();
 const back=document.createElement("div");back.className="info-sheet-backdrop";back.onclick=()=>closeInfoSheet?.();
 const sheet=document.createElement("div");sheet.className="info-sheet glass";
 const val=(v,u="")=>v!=null&&v!==""?`${v}${u}`:"–";
 const dur=x?.duration_s?`${Math.floor(x.duration_s/3600)}:${String(Math.floor((x.duration_s%3600)/60)).padStart(2,"0")} h`:"–";
 const dist=x?.distance_m?`${(Number(x.distance_m)/1000).toFixed(1)} km`:"–";
 const grid=x?`<div class="actual-detail-grid">
 <div><small>Dauer</small><strong>${dur}</strong></div><div><small>Distanz</small><strong>${dist}</strong></div>
 <div><small>Höhenmeter</small><strong>${val(x.elevation_gain_m," m")}</strong></div><div><small>Ø Herzfrequenz</small><strong>${val(x.avg_hr," bpm")}</strong></div>
 <div><small>Max. Herzfrequenz</small><strong>${val(x.max_hr," bpm")}</strong></div><div><small>Ø Leistung</small><strong>${val(x.avg_watts," W")}</strong></div>
 <div><small>Normalisierte Leistung</small><strong>${val(x.normalized_watts," W")}</strong></div><div><small>Ø Trittfrequenz</small><strong>${val(x.avg_cadence," U/min")}</strong></div>
 <div><small>Trainingsbelastung</small><strong>${val(x.training_load)}</strong></div><div><small>Kalorien</small><strong>${val(x.calories," kcal")}</strong></div>
 <div style="grid-column:1/-1"><small>Aufzeichnungsgerät</small><strong>${esc(x.source_device||"–")}</strong></div></div>`:
 `<div class="info-block">Für diese Planeinheit sind noch keine importierten Ist-Messdaten verknüpft.</div>`;
 sheet.innerHTML=`<h3>${unitEmoji(s)} ${esc(s.title)}</h3><div class="activity-source">${esc(s.date)} · ${esc(s.type||"")}${s.topup?" · On Top":""}</div>${grid}${s.note?`<div class="info-block"><strong>Bemerkung</strong><br>${esc(s.note)}</div>`:""}<button class="pill" style="width:100%" onclick="closeInfoSheet()">Schließen</button>`;
 document.body.append(back,sheet);
}
