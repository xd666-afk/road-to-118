import { getElementAbility, type AbilityChannel } from './elementAbilities';

export function abilityBonuses(progress: { elements: readonly { archived: boolean }[] }): Record<AbilityChannel, number> {
  const bonuses = { energy: 0, data: 0, production: 0 };
  progress.elements.forEach((element, index) => {
    if (!element.archived) return;
    const ability = getElementAbility(index + 1);
    if (ability) bonuses[ability.channel] += ability.percent;
  });
  return bonuses;
}
