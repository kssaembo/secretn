import type { ContactRoom, Difficulty, GameState, GuessSheet, Player, PublicState, TicketType } from './types';

export const AVATARS = ['lion','tiger','eagle','wolf','bear','fox','owl','dragon','shark','panther','rabbit','deer','falcon','whale','horse'];
const COLORS = ['#f59e0b','#3b82f6','#a855f7','#ef4444','#10b981','#06b6d4','#ec4899','#84cc16'];
const LIMIT: Record<Difficulty, number> = { low:30, medium:60, high:100 };
const ticketSet = (): Player['tickets'] => ({ plus:3, multiply:3, divide:3, zero:3 });
const id = () => crypto.randomUUID();

export function createGame(names:string[], durationMinutes:number, difficulty:Difficulty, roomCount:number):GameState {
  const roomCode = Math.random().toString(36).slice(2,8).toUpperCase();
  const players = names.slice(0,30).map((name,i):Player => ({ id:id(), name:name.trim(), avatar:AVATARS[i%AVATARS.length], color:COLORS[i%COLORS.length], tickets:ticketSet(), submitted:false, score:0 }));
  const rooms:ContactRoom[] = Array.from({length:roomCount},(_,i)=>({ id:i+1, seats:[{ready:false},{ready:false}], status:'waiting', updatedAt:Date.now() }));
  return { version:1, roomCode, phase:'draw', difficulty, durationSeconds:durationMinutes*60, remainingSeconds:durationMinutes*60, timerRunning:false, players, rooms, submissions:[], logs:[], createdAt:Date.now() };
}
export function assignNumbers(state:GameState):GameState {
  const pool=Array.from({length:LIMIT[state.difficulty]},(_,i)=>i+1);
  for(let i=pool.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
  return bump(state,{ players:state.players.map((p,i)=>({...p,secretNumber:pool[i]})), logs:addLog(state,'assign',`${state.players.length}명의 비밀 숫자를 배정했습니다.`) });
}
export function ticketValue(type:TicketType,a:number,b:number):number {
  if(type==='plus') return a+b;
  if(type==='multiply') return (a*b)%10;
  if(type==='divide') return Math.floor(Math.max(a,b)/Math.min(a,b));
  const [lo,hi]=[Math.min(a,b),Math.max(a,b)]; let count=0;
  for(let n=lo+1;n<hi;n++) count+=(String(n).match(/0/g)||[]).length;
  return count;
}
export function rangeHint(n:number, variant=Math.floor(Math.random()*3)):string {
  if(n<=0) return '0 이상 1 미만';
  return [`${n} 이상 ${n+1} 미만`,`${n-1} 초과 ${n} 이하`,`${n-1} 초과 ${n+1} 미만`][variant%3];
}
export function scoreSheets(state:GameState):GameState {
  const submissions=new Map(state.submissions.map(s=>[s.playerId,s]));
  const players=state.players.map(p=>{
    const sheet=submissions.get(p.id); let score=0;
    if(sheet?.ownGuess===p.secretNumber) score+=5;
    for(const target of state.players){ if(target.id!==p.id && sheet?.guesses[target.id]===target.secretNumber) score+=3; }
    for(const other of state.submissions){ if(other.playerId!==p.id && other.guesses[p.id]===p.secretNumber) score-=1; }
    return {...p,score};
  });
  return bump(state,{phase:'results',players,timerRunning:false,logs:addLog(state,'results','최종 점수 집계를 완료했습니다.')});
}
export function publicState(s:GameState):PublicState {
  const {submissions,...rest}=s;
  return {...rest,players:s.players.map(({secretNumber:_,tickets:__,...p})=>p),allSubmitted:s.players.length>0&&submissions.length===s.players.length};
}
export function addSheet(state:GameState,sheet:GuessSheet):GameState {
  if(state.submissions.some(s=>s.playerId===sheet.playerId)) return state;
  return bump(state,{submissions:[...state.submissions,sheet],players:state.players.map(p=>p.id===sheet.playerId?{...p,submitted:true}:p),logs:addLog(state,'submission',`${state.players.find(p=>p.id===sheet.playerId)?.name} 결과지 제출 완료`,[sheet.playerId])});
}
export function bump(state:GameState, patch:Partial<GameState>):GameState { return {...state,...patch,version:state.version+1}; }
export function addLog(state:GameState,kind:string,text:string,playerIds?:string[]){ return [...state.logs,{id:id(),at:Date.now(),kind,text,playerIds}]; }
