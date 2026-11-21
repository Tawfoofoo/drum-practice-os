export const categories=['Hands','Feet','Groove','Gospel','Jazz','Independence','Other'] as const;
export type Category=string;
export type Exercise={id:string;name:string;category:Category;description:string;targetBpm:number;minutes:number;priority:number;archived?:boolean};
export type RecordItem={id:string;exerciseId:string;date:string;bpm:number;accuracy:number;errors:number;seconds:number;notes:string};
export type Settings={dailyMinutes:number;practiceDays:number;reminderTime:string};
export const initialExercises:Exercise[]=[
 {id:'single',name:'Single Stroke Control',category:'Hands',description:'Even 16th notes; accents every 4 beats',targetBpm:100,minutes:15,priority:2},
 {id:'double',name:'Double Stroke Control',category:'Hands',description:'Clean rebounds and consistent spacing',targetBpm:90,minutes:15,priority:2},
 {id:'paradiddle',name:'Paradiddle Accents',category:'Hands',description:'RLRR LRLL with shifting accents',targetBpm:85,minutes:15,priority:1},
 {id:'foot',name:'Bass Drum Endurance',category:'Feet',description:'Steady 8th and 16th notes',targetBpm:95,minutes:15,priority:2},
 {id:'groove',name:'Pocket & Subdivision',category:'Groove',description:'Groove against click, focus on backbeat',targetBpm:85,minutes:20,priority:2},
 {id:'gospel',name:'Gospel Chops Phrases',category:'Gospel',description:'4-beat linear fills, start slowly',targetBpm:75,minutes:20,priority:1},
 {id:'jazz',name:'Jazz Comping Dialogue',category:'Jazz',description:'Comp with soloist phrases; record musicality notes',targetBpm:120,minutes:20,priority:1},
 {id:'independence',name:'4-Way Independence',category:'Independence',description:'Ostinato + syncopated snare',targetBpm:80,minutes:15,priority:1}
];
export const initialSettings:Settings={dailyMinutes:60,practiceDays:5,reminderTime:'18:00'};
export function recent(records:RecordItem[],id:string){return records.filter(r=>r.exerciseId===id).sort((a,b)=>b.date.localeCompare(a.date));}
export function nextBpm(ex:Exercise,records:RecordItem[]){const r=recent(records,ex.id);if(r.length>=3&&r.slice(0,3).every(x=>x.accuracy>=95&&x.errors<=2&&x.bpm>=ex.targetBpm))return ex.targetBpm+5;if(r.length>=2&&r.slice(0,2).every(x=>x.accuracy<85))return Math.max(40,ex.targetBpm-5);return ex.targetBpm;}
export function plan(exercises:Exercise[],records:RecordItem[],limit:number){
 const now=Date.now();const ranked=exercises.filter(e=>!e.archived).map(e=>{const r=recent(records,e.id);const last=r[0];const days=last?Math.max(0,(now-new Date(last.date).getTime())/86400000):14;const weakness=last?Math.max(0,95-last.accuracy)/10:1;const overdue=Math.min(days,14)/7;return {e,score:e.priority+weakness+overdue};}).sort((a,b)=>b.score-a.score);
 let remaining=limit;const selected:Exercise[]=[];for(const {e} of ranked){if(remaining<=0)break;selected.push({...e,minutes:Math.min(e.minutes,remaining)});remaining-=e.minutes;}return selected;
}
export function todayKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
