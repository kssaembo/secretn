import { describe,expect,it } from 'vitest';
import { rangeHint,ticketValue } from './game';
describe('game rules',()=>{
  it('calculates all ticket types',()=>{expect(ticketValue('plus',13,42)).toBe(55);expect(ticketValue('multiply',13,42)).toBe(6);expect(ticketValue('divide',42,13)).toBe(3);expect(ticketValue('zero',13,42)).toBe(3)});
  it('makes a one-number range',()=>{expect(rangeHint(83,0)).toBe('83 이상 84 미만');expect(rangeHint(83,1)).toBe('82 초과 83 이하');expect(rangeHint(0,2)).toBe('0 이상 1 미만')});
});
