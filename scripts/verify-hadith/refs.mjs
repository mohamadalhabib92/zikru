import { imp } from './load.mjs'; import { writeFileSync } from 'node:fs';
const D=await imp('duas'), K=await imp('knowledge'), S=await imp('salawat'), T=await imp('tijani'), N=await imp('names');
const items=[...D.DUAS_LIST.map(d=>({set:'duas',id:d.id,ar:d.ar,ref:d.ref})),...K.HADITHS.map(d=>({set:'hadiths',id:d.id,ar:d.ar,ref:d.ref})),...S.SALAWAT.map(d=>({set:'salawat',id:d.id,ar:d.ar,ref:d.ref})),...T.ADILLA.map((d,i)=>({set:'adilla',id:String(i),ar:'',ref:d.ref})),{set:'names',id:'ref',ar:'',ref:N.NAMES_REF}];
const RX=[[/(?:Sahih al-Bukhari|al-Bukhārī|Bukhari)\s+(\d+)/g,'bukhari'],[/(?:Sahih Muslim|Muslim)\s+(\d+)/g,'muslim'],[/Sunan Abi Dawud\s+(\d+)/g,'abudawud'],[/(?:Jami‘ at-Tirmidhi|at-Tirmidhī)\s+(\d+)/g,'tirmidhi'],[/Sunan Ibn Majah\s+(\d+)/g,'ibnmajah'],[/Musnad Ahmad\s+(\d+)/g,'ahmad']];
const keys=new Set();
for(const it of items){ it.hadith=[]; for(const part of it.ref.split(/[;·]/)){ for(const [rx,c] of RX){ rx.lastIndex=0; let m; while((m=rx.exec(part))){ it.hadith.push(c+':'+m[1]); keys.add(c+':'+m[1]); } } } }
writeFileSync('items.json',JSON.stringify(items,null,1)); writeFileSync('keys.txt',[...keys].join('\n'));
console.log(items.length,'items',keys.size,'keys', items.filter(i=>!i.hadith.length).map(i=>i.set+':'+i.id+' '+i.ref).join('\n'));
