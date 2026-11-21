export class Metronome {
 private ctx:AudioContext|null=null;private timer:number|null=null;private nextTime=0;private beat=0;private bpm=100;private beatsPerBar=4;
 async start(bpm:number,beatsPerBar:number){this.stop();this.ctx=new AudioContext();await this.ctx.resume();this.bpm=bpm;this.beatsPerBar=beatsPerBar;this.nextTime=this.ctx.currentTime+0.08;this.beat=0;this.schedule();this.timer=window.setInterval(()=>this.schedule(),25);}
 private schedule(){if(!this.ctx)return;while(this.nextTime<this.ctx.currentTime+0.12){const accent=this.beat%this.beatsPerBar===0;const osc=this.ctx.createOscillator();const gain=this.ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(accent?1300:880,this.nextTime);gain.gain.setValueAtTime(0.0001,this.nextTime);gain.gain.exponentialRampToValueAtTime(accent?0.24:0.14,this.nextTime+0.002);gain.gain.exponentialRampToValueAtTime(0.0001,this.nextTime+0.035);osc.connect(gain);gain.connect(this.ctx.destination);osc.start(this.nextTime);osc.stop(this.nextTime+0.04);this.nextTime+=60/this.bpm;this.beat++;}}
 stop(){if(this.timer!==null){clearInterval(this.timer);this.timer=null;}if(this.ctx){void this.ctx.close();this.ctx=null;}}
}
