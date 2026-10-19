const APPEARANCE_KEY="mt_appearance";
const systemDarkQuery=window.matchMedia("(prefers-color-scheme: dark)");
function appearanceSetting(){return localStorage.getItem(APPEARANCE_KEY)||"system"}
function resolvedAppearance(){
 const a=appearanceSetting();
 return a==="system"?(systemDarkQuery.matches?"dark":"light"):a;
}
function appearanceLabel(){
 const a=appearanceSetting();
 return a==="light"?"Hell":a==="dark"?"Dunkel":"Systemseitig";
}
function applyAppearance(){
 const mode=resolvedAppearance();
 document.documentElement.dataset.theme=mode;
 document.documentElement.dataset.appearance=appearanceSetting();
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.setAttribute("content",mode==="dark"?"#0b0c0e":"#ffffff");
 const apple=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
 if(apple)apple.setAttribute("content",mode==="dark"?"black-translucent":"default");
 document.querySelectorAll("[data-appearance]").forEach(b=>b.classList.toggle("active",b.dataset.appearance===appearanceSetting()));
 const sub=document.getElementById("appearanceSettingsSub");if(sub)sub.textContent=appearanceLabel();
}
function setAppearance(mode){
 if(!["light","dark","system"].includes(mode))mode="system";
 localStorage.setItem(APPEARANCE_KEY,mode);applyAppearance();
}
try{systemDarkQuery.addEventListener("change",()=>{if(appearanceSetting()==="system")applyAppearance()})}
catch{systemDarkQuery.addListener?.(()=>{if(appearanceSetting()==="system")applyAppearance()})}
applyAppearance();
document.addEventListener("DOMContentLoaded",applyAppearance);
