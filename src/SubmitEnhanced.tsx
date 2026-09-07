import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClientNetwork } from './network';
import { avatarPath } from './enhancements';
import type { GuessSheet, PublicState } from './types';

const uid = () => crypto.randomUUID();

type SubmissionDraft = {
  chosen?: string;
  own: string;
  guesses: Record<string, string>;
  gameCreatedAt?: number;
  updatedAt: number;
};

function readDraft(key:string):SubmissionDraft {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') || { own:'', guesses:{}, updatedAt:Date.now() };
  } catch {
    return { own:'', guesses:{}, updatedAt:Date.now() };
  }
}

export default function SubmitEnhanced(){
  const [q] = useSearchParams();
  const code = q.get('code') || '';
  const draftKey = `secret-number-submission-draft-${code}`;
  const deviceKey = `secret-number-submission-device-${code}`;
  const initialDraft = useRef(readDraft(draftKey)).current;
  const deviceId = useRef((()=>{
    try {
      const stored = localStorage.getItem(deviceKey);
      if(stored)return stored;
      const created = uid();
      localStorage.setItem(deviceKey,created);
      return created;
    } catch { return uid(); }
  })()).current;
  const [state,setState] = useState<PublicState|null>(null);
  const [pending,setPending] = useState<string>();
  const [chosen,setChosen] = useState<string|undefined>(initialDraft.chosen);
  const [own,setOwn] = useState(initialDraft.own);
  const [guesses,setGuesses] = useState<Record<string,string>>(initialDraft.guesses);
  const [gameCreatedAt,setGameCreatedAt] = useState(initialDraft.gameCreatedAt);
  const [done,setDone] = useState(false);
  const [connected,setConnected] = useState(false);
  const [notice,setNotice] = useState(initialDraft.chosen?'이전에 작성하던 결과지를 복구했습니다.':'');
  const net = useRef<ClientNetwork|undefined>(undefined);

  useEffect(()=>{
    const n = new ClientNetwork(code,{type:'HELLO',role:'submission',deviceId});
    net.current = n;
    n.onStatus = value=>{
      setConnected(value);
      if(!value)setNotice('연결이 끊어져 자동으로 다시 연결하고 있습니다. 작성 내용은 이 기기에 안전하게 보관됩니다.');
      else setNotice(current=>current.startsWith('연결이 끊어져')?'':current);
    };
    n.onDeliveryFailure = (_,reason)=>setNotice(reason);
    n.onMessage = message=>{
      if(message.type==='WELCOME'||message.type==='STATE')setState(message.state);
      if(message.type==='ERROR')setNotice(message.message);
      if(message.type==='ACK'&&!message.ok)setNotice(message.message||'결과지를 제출할 수 없습니다.');
      if(message.type==='ACK'&&message.ok){
        try{localStorage.removeItem(draftKey)}catch{}
        setDone(true);
        setTimeout(()=>window.close(),3000);
      }
    };
    return()=>n.destroy();
  },[code,deviceId,draftKey]);

  useEffect(()=>{
    if(!state)return;
    if(gameCreatedAt&&gameCreatedAt!==state.createdAt){
      clearDraft(false);
      setNotice('새 게임이 시작되어 이전 게임의 임시 결과지를 삭제했습니다.');
      setGameCreatedAt(state.createdAt);
      return;
    }
    if(!gameCreatedAt)setGameCreatedAt(state.createdAt);
    if(chosen&&state.players.find(player=>player.id===chosen)?.submitted){
      clearDraft(false);
      setNotice('이미 제출이 완료된 플레이어입니다. 재제출이 필요하면 선생님께 요청해 주세요.');
    }
  },[state]);

  useEffect(()=>{
    if(done)return;
    const draft:SubmissionDraft={chosen,own,guesses,gameCreatedAt,updatedAt:Date.now()};
    try{localStorage.setItem(draftKey,JSON.stringify(draft))}catch{}
  },[chosen,own,guesses,gameCreatedAt,done,draftKey]);

  function clearDraft(removeStorage=true){
    setChosen(undefined);
    setPending(undefined);
    setOwn('');
    setGuesses({});
    if(removeStorage)try{localStorage.removeItem(draftKey)}catch{}
  }

  function submit(){
    if(!chosen)return;
    const sheet:GuessSheet={
      playerId:chosen,
      ownGuess:+own,
      guesses:Object.fromEntries(Object.entries(guesses).map(([id,value])=>[id,+value])),
      submittedAt:Date.now(),
    };
    setNotice('결과지를 전송하고 있습니다. 완료 화면이 나타날 때까지 기다려 주세요.');
    net.current?.send({type:'SUBMIT_SHEET',sheet,requestId:uid()});
  }

  if(done)return <main className="submit"><div className="done"><span>✓</span><strong>결과지 제출 완료</strong></div></main>;
  return <main className="submit">
    <header><h1>추리 결과지 제출</h1><span>{connected?'교사 기기와 연결됨':'연결 중'}</span></header>
    {notice&&<div className="notice" onClick={()=>setNotice('')}>{notice}</div>}
    {!chosen?<section>
      <h2>제출자를 선택하세요.</h2>
      <div className="chooser">{state?.players.filter(player=>!player.submitted).map((player,index)=><button key={player.id} onClick={()=>setPending(player.id)}><img src={avatarPath(index)}/>{player.name}</button>)}</div>
    </section>:<section>
      <div className="submission-draft-heading">
        <h2>내 비밀번호와 다른 친구들의 비밀번호</h2>
        <button onClick={()=>{clearDraft();setNotice('임시 작성 내용을 삭제했습니다. 플레이어를 다시 선택해 주세요.')}}>작성 내용 삭제 · 다시 선택</button>
      </div>
      <div className="own-guess"><b>내 비밀 숫자 예상</b><input inputMode="numeric" value={own} onChange={event=>setOwn(event.target.value)}/><small>내 번호를 맞히면 +5점</small></div>
      <div className="guess-grid">{state?.players.filter(player=>player.id!==chosen).map((player,index)=><label key={player.id}><img src={avatarPath(index)}/><b>{player.name}</b><input inputMode="numeric" value={guesses[player.id]||''} onChange={event=>setGuesses(current=>({...current,[player.id]:event.target.value}))}/><small>정답 +3점 · 내 번호 노출 시 -1점</small></label>)}</div>
      <button className="primary next" disabled={!connected} onClick={submit}>결과지 제출</button>
    </section>}
    {pending&&<div className="overlay"><section className="modal submit-confirm"><h2>해당 플레이어가 맞는지 확인해 주세요.</h2><p>다른 플레이어를 선택할 경우 공정한 게임을 할 수 없습니다.</p><div className="pager"><button onClick={()=>setPending(undefined)}>다시 선택</button><button className="primary" onClick={()=>{setChosen(pending);setPending(undefined)}}>확인</button></div></section></div>}
  </main>;
}
