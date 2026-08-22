import Peer, { type DataConnection } from 'peerjs';
import type { ClientMessage, HostMessage } from './types';

const peerId = (code:string) => `secret-number-class-${code.toLowerCase()}`;

export class HostNetwork {
  private peer:Peer; private connections=new Set<DataConnection>();
  onMessage?: (message:ClientMessage, connection:DataConnection)=>void;
  onDisconnect?: (connection:DataConnection)=>void;
  onStatus?: (count:number)=>void;
  constructor(code:string){
    this.peer=new Peer(peerId(code));
    this.peer.on('connection',conn=>{
      this.connections.add(conn); this.onStatus?.(this.connections.size);
      conn.on('data',data=>this.onMessage?.(data as ClientMessage,conn));
      const remove=()=>{if(!this.connections.delete(conn))return;this.onDisconnect?.(conn);this.onStatus?.(this.connections.size)};
      conn.on('close',remove);
      conn.on('error',remove);
    });
  }
  send(conn:DataConnection,message:HostMessage){if(conn.open) conn.send(message)}
  broadcast(message:HostMessage){this.connections.forEach(c=>this.send(c,message))}
  destroy(){this.connections.forEach(c=>c.close());this.peer.destroy()}
}

export class ClientNetwork {
  private peer?:Peer; private connection?:DataConnection; private attempts=0; private stopped=false;
  onMessage?: (message:HostMessage)=>void; onStatus?: (connected:boolean)=>void;
  constructor(private code:string, private hello:ClientMessage){this.connect()}
  private connect(){
    if(this.stopped)return; this.peer=new Peer();
    this.peer.on('open',()=>{
      const conn=this.peer!.connect(peerId(this.code),{reliable:true,serialization:'json'});this.connection=conn;
      conn.on('open',()=>{this.attempts=0;this.onStatus?.(true);conn.send(this.hello)});
      conn.on('data',d=>this.onMessage?.(d as HostMessage));
      conn.on('close',()=>this.retry()); conn.on('error',()=>this.retry());
    });
    this.peer.on('error',()=>this.retry());
  }
  private retry(){if(this.stopped)return;this.onStatus?.(false);this.connection?.close();this.peer?.destroy();const delay=Math.min(8000,500*2**this.attempts++);setTimeout(()=>this.connect(),delay)}
  send(message:ClientMessage){if(this.connection?.open)this.connection.send(message)}
  destroy(){this.stopped=true;this.connection?.close();this.peer?.destroy()}
}

export const boardChannel = new BroadcastChannel('secret-number-board-v1');
