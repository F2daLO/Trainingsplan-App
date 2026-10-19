function downloadAppExample(file){
 const allowed={import:"IMPORT_BEISPIEL.csv",plan:"PLANPAKET_BEISPIEL.json"};
 const name=allowed[file]; if(!name)return;
 const a=document.createElement("a");a.href="./"+name;a.download=name;
 document.body.appendChild(a);a.click();a.remove();
}

function openIntervalsConnections(){window.open("https://intervals.icu/settings","_blank","noopener")}
