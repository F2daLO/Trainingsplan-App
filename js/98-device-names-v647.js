function normalizeDeviceNameV647(v){
 const x=String(v||"").trim();
 if(/^(?:i?g?psport|igpsport)\s*501$/i.test(x) || /^IGSPORT\s*501$/i.test(x)) return "iGPSPORT BSC500";
 if(/^iGPSPORT\s+BSC500$/i.test(x)) return "iGPSPORT BSC500";
 return x;
}
function normalizeAllDeviceNamesV647(){
 (importedActivities||[]).forEach(a=>{
   if(a.source_device)a.source_device=normalizeDeviceNameV647(a.source_device);
   if(a.raw_summary&&typeof a.raw_summary==="object"){
     ["source_device","device","device_name","deviceName","product_name","productName"].forEach(k=>{
       if(a.raw_summary[k])a.raw_summary[k]=normalizeDeviceNameV647(a.raw_summary[k]);
     });
   }
 });
 (db?.sessions||[]).forEach(x=>{if(x.actualSummary?.source_device)x.actualSummary.source_device=normalizeDeviceNameV647(x.actualSummary.source_device)});
}
const __v647Render=render;
render=function(){normalizeAllDeviceNamesV647();const r=__v647Render.apply(this,arguments);requestAnimationFrame(normalizeAllDeviceNamesV647);return r};
