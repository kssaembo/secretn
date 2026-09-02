import { describe,expect,it } from 'vitest';
import { createGame,publicState,rangeHint,ticketValue } from './game';
describe('game rules',()=>{
  it('calculates all ticket types',()=>{expect(ticketValue('plus',13,42)).toBe(55);expect(ticketValue('multiply',13,42)).toBe(6);expect(ticketValue('divide',42,13)).toBe(3);expect(ticketValue('zero',13,42)).toBe(3)});
  it('makes a one-number range',()=>{expect(rangeHint(83,0)).toBe('83 이상 84 미만');expect(rangeHint(83,1)).toBe('82 초과 83 이하');expect(rangeHint(0,2)).toBe('0 이상 1 미만')});
  it('gives each player two of every ticket and exposes only ticket stock publicly',()=>{const game=createGame(['고양이','강아지'],60,'medium',1);expect(game.players[0].tickets).toEqual({plus:2,multiply:2,divide:2,zero:2});const visible=publicState(game).players[0];expect(visible.tickets).toEqual({plus:2,multiply:2,divide:2,zero:2});expect('secretNumber' in visible).toBe(false)});
});
