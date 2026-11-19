import { describe, expect, it } from 'vitest';
import { ATOMIC_PROFILES } from '../data/atomic';
import { element } from '../data/elements';

const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 } as Record<string, number>;
const superscript = (text: string) => Number([...text].map(char => SUP[char]).join(''));

describe('sourced neutral atom profiles', () => {
  it('keeps shell populations and orbital occupancies consistent for H through Xe', () => {
    expect(Object.keys(ATOMIC_PROFILES)).toHaveLength(54);
    for (let z = 1; z <= 54; z++) {
      const atom = ATOMIC_PROFILES[z];
      const orbitals = Array.from(atom.configuration.matchAll(/([1-5])([spd])([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g));
      expect(orbitals.reduce((sum, match) => sum + superscript(match[3]), 0)).toBe(z);
      expect(atom.shells.reduce((sum, n) => sum + n, 0)).toBe(z);
      expect(atom.shells).toEqual([1, 2, 3, 4, 5].map(layer => orbitals.filter(match => +match[1] === layer).reduce((sum, match) => sum + superscript(match[3]), 0)).filter(n => n > 0));
      expect(atom.shells[0]).toBeLessThanOrEqual(2);
      expect(atom.shells[1] ?? 0).toBeLessThanOrEqual(8);
      expect(atom.isotope - z).toBeGreaterThanOrEqual(0);
    }
  });
  it('uses explicitly named isotopes, with hydrogen-1 having no neutron', () => {
    const referenceNeutrons = [
      0, 2, 4, 5, 6, 6, 7, 8, 10, 10, 12, 12, 14, 14, 16, 16, 18, 22, 20, 20,
      24, 26, 28, 28, 30, 30, 32, 30, 34, 34, 38, 42, 42, 46, 44, 48, 48, 50, 50, 50, 52, 56, 56, 58, 58, 60, 60, 66, 66, 70, 70, 78, 74, 78,
    ];
    for (let z = 1; z <= 54; z++) {
      expect(ATOMIC_PROFILES[z].isotope - z).toBe(referenceNeutrons[z - 1]);
      expect(Number.isInteger(ATOMIC_PROFILES[z].isotope)).toBe(true);
      expect(element(z).mass).toBeDefined();
    }
    expect(ATOMIC_PROFILES[5].isotopes).toContain('硼-10');
    expect(ATOMIC_PROFILES[35].state).toBe('液态');
    expect(ATOMIC_PROFILES[43].isotopes).toContain('锝-99m');
    expect(ATOMIC_PROFILES[54].isotopes).toContain('氙-132');
  });
  it('preserves exceptional phase conditions instead of inventing ordinary melting points', () => {
    expect(ATOMIC_PROFILES[2].melting).toBe('常压下不凝固');
    expect(ATOMIC_PROFILES[2].extraSource?.url).toBe('https://pubchem.ncbi.nlm.nih.gov/element/2');
    expect(ATOMIC_PROFILES[6].melting).toBe('常压下升华');
    expect(ATOMIC_PROFILES[6].boiling).toContain('升华');
    expect(ATOMIC_PROFILES[10].shells).toEqual([2, 8]);
    expect(ATOMIC_PROFILES[33].boiling).toContain('升华');
    expect(ATOMIC_PROFILES[54].shells).toEqual([2, 8, 18, 18, 8]);
  });
});
