import{describe,expect,it}from'vitest';import{canSubmitSeat,chooseTicket,isRoomInUse,submitSeat}from'./contactState';import type{ContactRoom}from'./types';
const room=():ContactRoom=>({id:1,seats:[{deviceId:'A',playerId:'p1',ready:false},{deviceId:'B',playerId:'p2',ready:false}],status:'choosing',updatedAt:1});
describe('two-tablet contact isolation',()=>{
  it('changes only the tablet that selected a ticket',()=>{const next=chooseTicket(room(),0,'plus');expect(next.seats[0].ticket).toBe('plus');expect(next.seats[1].ticket).toBeUndefined()});
  it('keeps the opposite tablet enabled when one tablet submits',()=>{let next=chooseTicket(room(),0,'plus');next=submitSeat(next,0);expect(canSubmitSeat(next,0)).toBe(false);next=chooseTicket(next,1,'plus');expect(canSubmitSeat(next,0)).toBe(false);expect(canSubmitSeat(next,1)).toBe(true)});
  it('stays available until a player is selected',()=>{const empty:ContactRoom={id:1,seats:[{deviceId:'A',ready:false},{deviceId:'B',ready:false}],status:'waiting',updatedAt:1};expect(isRoomInUse(empty)).toBe(false);empty.seats[0].playerId='p1';expect(isRoomInUse(empty)).toBe(true)});
});
