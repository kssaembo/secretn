import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
const rate=44100,duration=.14,count=Math.floor(rate*duration),data=Buffer.alloc(count*2);
for(let i=0;i<count;i++){const t=i/rate;const envelope=Math.min(1,t/.006)*Math.pow(1-t/duration,2.2);const tone=Math.sin(2*Math.PI*520*t)*.5+Math.sin(2*Math.PI*1040*t)*.08;data.writeInt16LE(Math.round(tone*envelope*32767),i*2)}
const h=Buffer.alloc(44);h.write('RIFF',0);h.writeUInt32LE(36+data.length,4);h.write('WAVE',8);h.write('fmt ',12);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);
const output=resolve('public/assets/audio/sfx/sfx-countdown.wav');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,Buffer.concat([h,data]));console.log(output);
