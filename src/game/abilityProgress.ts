import { getElementAbility, type AbilityChannel } from './elementAbilities';
import { projectBonus } from './projects';
import type { GameState } from './types';

export function abilityBonuses(progress: { elements: readonly { archived: boolean }[] }): Record<AbilityChannel, number> {
  const bonuses = { energy: 0, data: 0, production: 0 };
  progress.elements.forEach((element, index) => {
    if (!element.archived) return;
    const ability = getElementAbility(index + 1);
    if (ability) bonuses[ability.channel] += ability.percent;
  });
  return bonuses;
}

export function laboratoryBonuses(state: GameState) {
  const bonuses = abilityBonuses(state);
  bonuses.data += projectBonus(state, 'spectroscopy');
  bonuses.production += projectBonus(state, 'separation');
  return bonuses;
}
