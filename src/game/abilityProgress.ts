import { getElementAbility, type AbilityChannel } from './elementAbilities';

type AbilityProgress = {
  elements: readonly { archived: boolean }[];
  activeAbilities?: number[];
};

export function savedAbilities(progress: AbilityProgress, input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const active = new Set<number>();
  for (const z of input) {
    if (Number.isInteger(z) && progress.elements[z - 1]?.archived && getElementAbility(z)) active.add(z);
  }
  return [...active].sort((a, b) => a - b);
}

export function availableAbilities(progress: AbilityProgress): number[] {
  const active = new Set(progress.activeAbilities);
  return progress.elements.flatMap((element, index) => {
    const z = index + 1;
    return element.archived && getElementAbility(z) && !active.has(z) ? [z] : [];
  });
}

export function activateElementAbility(progress: AbilityProgress, z: number): boolean {
  if (!progress.elements[z - 1]?.archived || !getElementAbility(z) || progress.activeAbilities?.includes(z)) return false;
  (progress.activeAbilities ??= []).push(z);
  return true;
}

export function abilityBonuses(progress: AbilityProgress): Record<AbilityChannel, number> {
  const bonuses = { energy: 0, data: 0, production: 0 };
  for (const z of progress.activeAbilities ?? []) {
    const ability = getElementAbility(z);
    if (ability && progress.elements[z - 1]?.archived) bonuses[ability.channel] += ability.percent;
  }
  return bonuses;
}
