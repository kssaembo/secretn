export type Phase = 'setup' | 'draw' | 'active' | 'submission' | 'results';
export type Difficulty = 'low' | 'medium' | 'high';
export type TicketType = 'plus' | 'multiply' | 'divide' | 'zero';

export interface Player {
  id: string; name: string; avatar: string; color: string; secretNumber?: number;
  tickets: Record<TicketType, number>; submitted: boolean; score: number;
}
export interface ContactSeat { deviceId?: string; playerId?: string; ticket?: TicketType; ready: boolean }
export interface ContactRoom { id: number; seats: [ContactSeat, ContactSeat]; status: 'waiting'|'choosing'|'processing'|'result'; result?: string; updatedAt: number }
export interface GuessSheet { playerId: string; ownGuess: number; guesses: Record<string, number>; submittedAt: number }
export interface GameLog { id: string; at: number; kind: string; text: string; playerIds?: string[] }
export interface GameState {
  version: number; roomCode: string; phase: Phase; difficulty: Difficulty; durationSeconds: number;
  remainingSeconds: number; timerRunning: boolean; players: Player[]; rooms: ContactRoom[];
  submissions: GuessSheet[]; logs: GameLog[]; createdAt: number;
}
export type PublicPlayer = Omit<Player, 'secretNumber'|'tickets'>;
export interface PublicState extends Omit<GameState, 'players'|'submissions'> { players: PublicPlayer[]; allSubmitted: boolean; revealed?: { players: Player[]; submissions: GuessSheet[] } }

export type ClientRole = 'station' | 'submission';
export type ClientMessage =
  | { type:'HELLO'; role:ClientRole; deviceId:string; roomId?:number }
  | { type:'SELECT_PLAYER'; roomId:number; seat:number; playerId:string; requestId:string }
  | { type:'SELECT_TICKET'; roomId:number; seat:number; ticket:TicketType; requestId:string }
  | { type:'SUBMIT_CONTACT'; roomId:number; requestId:string }
  | { type:'RESET_ROOM'; roomId:number; requestId:string }
  | { type:'SUBMIT_SHEET'; sheet:GuessSheet; requestId:string }
  | { type:'PING'; at:number };
export type HostMessage =
  | { type:'WELCOME'; state:PublicState; seat?:number }
  | { type:'STATE'; state:PublicState }
  | { type:'ROOM'; room:ContactRoom }
  | { type:'ACK'; requestId:string; ok:boolean; message?:string }
  | { type:'ERROR'; message:string }
  | { type:'PONG'; at:number };
