import { describe, expect, it } from 'vitest';
import { createState } from '../game/engine';
import { particleScale, reactorDisplayPool } from '../game/visuals';

describe('reactor-specific representative samples', () => {
  it('replaces the initial light-element pool with known N/O/F in III and adds Ne only after discovery', () => {
    const s=createState(1);s.elements.forEach((e,i)=>e.discovered=i<9);s.settings.mix=[1,2,3,4,5];s.reactors[2].target=9;
    expect(reactorDisplayPool(s,s.reactors[2])).toEqual([7,8,9]);
    s.elements[9].discovered=true;expect(reactorDisplayPool(s,s.reactors[2])).toEqual([7,8,9,10]);
    expect(s.settings.mix).toEqual([1,2,3,4,5]);
  });
  it('keeps I manual choices and represents an explicitly repeated product on an older device',()=>{
    const s=createState(1);s.elements.forEach((e,i)=>e.discovered=i<9);s.settings.mix=[1,3];s.reactors[1].target=9;
    expect(reactorDisplayPool(s,s.reactors[0])).toEqual([1,3]);
    expect(reactorDisplayPool(s,s.reactors[1])).toEqual([4,5,6,7,9]);
  });
  it('distinguishes progression with restrained sizes without modifying sample counts',()=>{
    expect(particleScale(10)).toBeGreaterThan(particleScale(1));
    expect(particleScale(10)/particleScale(1)).toBeLessThan(1.4);
  });
});
