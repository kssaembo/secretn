import type { ContactRoom, TicketType } from './types';

export function chooseTicket(room:ContactRoom,seatIndex:number,ticket:TicketType):ContactRoom{
  const seats=[...room.seats] as ContactRoom['seats'];
  seats[seatIndex]={...seats[seatIndex],ticket,ready:false};
  return {...room,seats,status:seats.some(seat=>seat.playerId)?'choosing':'waiting',updatedAt:Date.now()};
}
export function submitSeat(room:ContactRoom,seatIndex:number):ContactRoom{
  const seats=[...room.seats] as ContactRoom['seats'];
  seats[seatIndex]={...seats[seatIndex],ready:true};
  return {...room,seats,status:'processing',updatedAt:Date.now()};
}
export function canSubmitSeat(room:ContactRoom,seatIndex:number):boolean{
  const seat=room.seats[seatIndex];return Boolean(seat.ticket)&&!seat.ready;
}
export function isRoomInUse(room:ContactRoom):boolean{
  return room.seats.some(seat=>Boolean(seat.playerId))||room.status==='processing'||room.status==='result';
}
