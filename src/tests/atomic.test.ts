import { describe, expect, it } from 'vitest';
import { ATOMIC_PROFILES } from '../data/atomic';
import { element } from '../data/elements';

describe('sourced neutral atom profiles', () => {
  it('keeps shell populations and orbital occupancies consistent for H through Ne', () => {
    const digits: Record<string, number> = { '¹':1,'²':2,'³':3,'⁴':4,'⁵':5,'⁶':6,'⁷':7,'⁸':8 };
    expect(Object.keys(ATOMIC_PROFILES)).toHaveLength(10);
    for(let z=1;z<=10;z++){
      const atom=ATOMIC_PROFILES[z];
      const orbitals=Array.from(atom.configuration.matchAll(/([12])([sp])([¹²³⁴⁵⁶⁷⁸])/g));
      expect(orbitals.reduce((sum,m)=>sum+digits[m[3]],0)).toBe(z);
      expect(atom.shells.reduce((sum,n)=>sum+n,0)).toBe(z);
      expect(atom.shells).toEqual([1,2].map(layer=>orbitals.filter(m=>+m[1]===layer).reduce((sum,m)=>sum+digits[m[3]],0)).filter(n=>n>0));
      expect(atom.shells[0]).toBeLessThanOrEqual(2);
      expect(atom.shells[1] ?? 0).toBeLessThanOrEqual(8);
    }
  });
  it('uses explicitly named isotopes, with hydrogen-1 having no neutron', () => {
    const referenceNeutrons=[0,2,4,5,6,6,7,8,10,10];
    for(let z=1;z<=10;z++){
      expect(ATOMIC_PROFILES[z].isotope-z).toBe(referenceNeutrons[z-1]);
      expect(Number.isInteger(ATOMIC_PROFILES[z].isotope)).toBe(true);
      expect(element(z).mass).toBeDefined();
    }
    expect(ATOMIC_PROFILES[5].isotopes).toContain('硼-10');
    expect(ATOMIC_PROFILES[5].isotopes).toContain('硼-11');
    expect(ATOMIC_PROFILES[6].isotopes).toContain('碳-14');
  });
  it('preserves exceptional phase conditions instead of inventing ordinary melting points', () => {
    expect(ATOMIC_PROFILES[2].melting).toBe('常压下不凝固');
    expect(ATOMIC_PROFILES[2].extraSource?.url).toBe('https://pubchem.ncbi.nlm.nih.gov/element/2');
    expect(ATOMIC_PROFILES[6].melting).toBe('常压下升华');
    expect(ATOMIC_PROFILES[6].boiling).toContain('升华');
    expect(ATOMIC_PROFILES[10].shells).toEqual([2,8]);
  });
});
