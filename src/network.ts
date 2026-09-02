import Peer, { type DataConnection } from 'peerjs';
import type { ClientMessage, HostMessage } from './types';

const peerId = (code:string) => `secret-number-class-${code.toLowerCase()}`;
const HEARTBEAT_MS = 5_000;
const CONNECTION_TIMEOUT_MS = 15_000;
const ACK_TIMEOUT_MS = 2_500;
const MAX_ACK_ATTEMPTS = 5;

type HostStatus = 'connecting'|'online'|'reconnecting'|'error';
type PendingRequest = { message:ClientMessage; attempts:number; timer?:ReturnType<typeof setTimeout> };

export class HostNetwork {
  private peer:Peer;
  private connections=new Set<DataConnection>();
  private lastSeen=new Map<DataConnection,number>();
  private heartbeatTimer:ReturnType<typeof setInterval>;
  private reconnectTimer?:ReturnType<typeof setTimeout>;
  private destroyed=false;
  onMessage?: (message:ClientMessage, connection:DataConnection)=>void;
  onDisconnect?: (connection:DataConnection)=>void;
  onStatus?: (count:number)=>void;
  onServerStatus?: (status:HostStatus, message?:string)=>void;

  constructor(code:string){
    this.peer=this.createPeer(code);
    this.heartbeatTimer=setInterval(()=>this.removeExpiredConnections(),HEARTBEAT_MS);
  }

  private createPeer(code:string){
    const peer=new Peer(peerId(code));
    this.onServerStatus?.('connecting');
    peer.on('open',()=>this.onServerStatus?.('online'));
    peer.on('connection',conn=>{
      this.connections.add(conn);
      this.lastSeen.set(conn,Date.now());
      this.onStatus?.(this.connections.size);
      conn.on('data',data=>{
        this.lastSeen.set(conn,Date.now());
        this.onMessage?.(data as ClientMessage,conn);
      });
      const remove=()=>this.removeConnection(conn);
      conn.on('close',remove);
      conn.on('error',remove);
    });
    peer.on('disconnected',()=>{
      if(this.destroyed)return;
      this.onServerStatus?.('reconnecting','교사 연결 서버와 다시 연결하고 있습니다.');
      if(this.reconnectTimer)return;
      this.reconnectTimer=setTimeout(()=>{
        this.reconnectTimer=undefined;
        if(this.destroyed||!peer.disconnected)return;
        try{peer.reconnect()}catch(error){this.onServerStatus?.('error',this.errorMessage(error))}
      },1_000);
    });
    peer.on('error',error=>this.onServerStatus?.('error',this.hostErrorMessage(error)));
    return peer;
  }

  private hostErrorMessage(error:unknown){
    const raw=this.errorMessage(error);
    if(/unavailable-id|taken/i.test(raw))return '같은 게임 코드의 교사 페이지가 이미 실행 중입니다. 기존 교사 페이지를 닫거나 게임을 다시 생성해 주세요.';
    if(/network|server|socket|disconnected/i.test(raw))return '교사 연결 서버에 접속할 수 없습니다. 인터넷 연결을 확인하면 자동으로 다시 시도합니다.';
    return `교사 네트워크 오류: ${raw}`;
  }

  private errorMessage(error:unknown){return error instanceof Error?error.message:String(error)}

  private removeExpiredConnections(){
    const now=Date.now();
    for(const connection of this.connections){
      if(now-(this.lastSeen.get(connection)??0)<=CONNECTION_TIMEOUT_MS)continue;
      connection.close();
      this.removeConnection(connection);
    }
  }

  private removeConnection(connection:DataConnection){
    if(!this.connections.delete(connection))return;
    this.lastSeen.delete(connection);
    this.onDisconnect?.(connection);
    this.onStatus?.(this.connections.size);
  }

  send(conn:DataConnection,message:HostMessage){
    if(!conn.open)return;
    try{conn.send(message)}catch{this.removeConnection(conn)}
  }
  broadcast(message:HostMessage){this.connections.forEach(connection=>this.send(connection,message))}
  destroy(){
    this.destroyed=true;
    clearInterval(this.heartbeatTimer);
    if(this.reconnectTimer)clearTimeout(this.reconnectTimer);
    this.connections.forEach(connection=>connection.close());
    this.connections.clear();
    this.lastSeen.clear();
    this.peer.destroy();
  }
}

export class ClientNetwork {
  private peer?:Peer;
  private connection?:DataConnection;
  private attempts=0;
  private stopped=false;
  private generation=0;
  private reconnectTimer?:ReturnType<typeof setTimeout>;
  private heartbeatTimer?:ReturnType<typeof setInterval>;
  private lastPong=0;
  private pending=new Map<string,PendingRequest>();
  onMessage?: (message:HostMessage)=>void;
  onStatus?: (connected:boolean)=>void;
  onDeliveryFailure?: (message:ClientMessage, reason:string)=>void;

  constructor(private code:string, private hello:ClientMessage){this.connect()}

  private connect(){
    if(this.stopped)return;
    const generation=++this.generation;
    const peer=new Peer();
    this.peer=peer;
    peer.on('open',()=>{
      if(this.stopped||generation!==this.generation)return;
      const connection=peer.connect(peerId(this.code),{reliable:true,serialization:'json'});
      this.connection=connection;
      connection.on('open',()=>{
        if(this.stopped||generation!==this.generation)return;
        this.attempts=0;
        this.lastPong=Date.now();
        this.onStatus?.(true);
        connection.send(this.hello);
        this.startHeartbeat(generation);
        for(const requestId of this.pending.keys())this.transmit(requestId);
      });
      connection.on('data',data=>this.receive(data as HostMessage));
      connection.on('close',()=>this.scheduleRetry(generation));
      connection.on('error',()=>this.scheduleRetry(generation));
    });
    peer.on('error',()=>this.scheduleRetry(generation));
    peer.on('disconnected',()=>this.scheduleRetry(generation));
  }

  private receive(message:HostMessage){
    if(message.type==='PONG'){
      this.lastPong=Date.now();
      return;
    }
    if(message.type==='ACK'){
      const pending=this.pending.get(message.requestId);
      if(pending?.timer)clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
    }
    this.onMessage?.(message);
  }

  private startHeartbeat(generation:number){
    if(this.heartbeatTimer)clearInterval(this.heartbeatTimer);
    this.heartbeatTimer=setInterval(()=>{
      if(this.stopped||generation!==this.generation)return;
      if(Date.now()-this.lastPong>CONNECTION_TIMEOUT_MS){
        this.scheduleRetry(generation);
        return;
      }
      if(this.connection?.open)this.connection.send({type:'PING',at:Date.now()} satisfies ClientMessage);
    },HEARTBEAT_MS);
  }

  private scheduleRetry(generation:number){
    if(this.stopped||generation!==this.generation||this.reconnectTimer)return;
    ++this.generation;
    this.onStatus?.(false);
    if(this.heartbeatTimer)clearInterval(this.heartbeatTimer);
    this.heartbeatTimer=undefined;
    for(const pending of this.pending.values())if(pending.timer){clearTimeout(pending.timer);pending.timer=undefined}
    const connection=this.connection;
    const peer=this.peer;
    this.connection=undefined;
    this.peer=undefined;
    try{connection?.close()}catch{}
    try{peer?.destroy()}catch{}
    const delay=Math.min(8_000,500*2**this.attempts++);
    this.reconnectTimer=setTimeout(()=>{
      this.reconnectTimer=undefined;
      this.connect();
    },delay);
  }

  private transmit(requestId:string){
    const pending=this.pending.get(requestId);
    if(!pending||!this.connection?.open)return;
    if(pending.attempts>=MAX_ACK_ATTEMPTS){
      if(pending.timer)clearTimeout(pending.timer);
      this.pending.delete(requestId);
      this.onDeliveryFailure?.(pending.message,'교사 기기의 응답을 받지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.');
      return;
    }
    pending.attempts+=1;
    try{this.connection.send(pending.message)}catch{return}
    if(pending.timer)clearTimeout(pending.timer);
    pending.timer=setTimeout(()=>this.transmit(requestId),ACK_TIMEOUT_MS);
  }

  send(message:ClientMessage){
    if('requestId' in message){
      if(!this.pending.has(message.requestId))this.pending.set(message.requestId,{message,attempts:0});
      this.transmit(message.requestId);
      return;
    }
    if(this.connection?.open)this.connection.send(message);
  }

  destroy(){
    this.stopped=true;
    ++this.generation;
    if(this.reconnectTimer)clearTimeout(this.reconnectTimer);
    if(this.heartbeatTimer)clearInterval(this.heartbeatTimer);
    for(const pending of this.pending.values())if(pending.timer)clearTimeout(pending.timer);
    this.pending.clear();
    this.connection?.close();
    this.peer?.destroy();
  }
}

export const boardChannel = new BroadcastChannel('secret-number-board-v1');
