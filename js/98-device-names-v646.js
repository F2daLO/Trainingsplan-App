function normalizeDeviceNameV646(v){
 const x=String(v||"").trim();
 return /^IGPSPORT\s*501$/i.test(x)?"iGPSPORT BSC500":x;
}
const __sessionActualDetailV644=sessionActualDetailV644;
sessionActualDetailV644=function(id){
 const s=db.sessions.find(x=>x.id===id);
 if(s?.actualSummary?.source_device)s.actualSummary.source_device=normalizeDeviceNameV646(s.actualSummary.source_device);
 (importedActivities||[]).forEach(a=>{if(a.source_device)a.source_device=normalizeDeviceNameV646(a.source_device)});
 return __sessionActualDetailV644(id);
};
