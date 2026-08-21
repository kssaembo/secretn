import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const sampleRate=44100;
const duration=.105;
const count=Math.floor(sampleRate*duration);
const data=Buffer.alloc(count*2);
for(let i=0;i<count;i++){
  const t=i/sampleRate;
  const attack=Math.min(1,t/.008);
  const release=Math.pow(1-t/duration,2.8);
  const tone=Math.sin(2*Math.PI*620*t)*.52+Math.sin(2*Math.PI*930*t)*.18;
  const click=(Math.random()*2-1)*Math.exp(-t*85)*.13;
  const value=Math.max(-1,Math.min(1,(tone+click)*attack*release));
  data.writeInt16LE(Math.round(value*32767),i*2);
}
const header=Buffer.alloc(44);
header.write('RIFF',0);header.writeUInt32LE(36+data.length,4);header.write('WAVE',8);
header.write('fmt ',12);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
header.writeUInt32LE(sampleRate,24);header.writeUInt32LE(sampleRate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
header.write('data',36);header.writeUInt32LE(data.length,40);
const output=resolve('public/assets/audio/sfx/sfx-button-default.wav');
mkdirSync(dirname(output),{recursive:true});writeFileSync(output,Buffer.concat([header,data]));
console.log(output);
