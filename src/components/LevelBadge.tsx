import React from 'react';
import { useTranslation } from 'react-i18next';
import { levelFor, levelProgress } from '../logic/level';

/** A thin bar of the way to the next level */
const LevelBar = ({ share, className }: { share: number; className: string }) => (
  <span aria-hidden="true" className={`inline-block rounded-full bg-white/10 overflow-hidden ${className}`}>
    <span className="block h-full rounded-full fill-hot shadow-none" style={{ width: `${Math.round(Math.min(1, Math.max(0, share)) * 100)}%` }} />
  </span>
);

/**
 * An account's level on its profile (logic/level.ts): the number in a pill
 * and a bar to the next. `mine`: the owner's own profile, which also says how
 * much XP the next level needs; others see that on hover.
 */
const LevelBadge = ({ xp, mine = false }: { xp: number; mine?: boolean }) => {
  const { t } = useTranslation();
  const { level, share, toNext } = levelProgress(xp);
  const next = t('level.toNext', { xp: toNext.toLocaleString(), next: level + 1 });
  return (
    <span className="inline-flex items-center gap-2" title={`${t('level.total', { xp: xp.toLocaleString() })} · ${next}`} data-level={level}>
      <span className="text-xs font-semibold text-white fill-hot shadow-none rounded-full px-2.5 py-0.5 whitespace-nowrap">{t('level.badge', { level })}</span>
      <LevelBar share={share} className="w-20 h-1.5" />
      {mine ? <span className="text-xs text-white/60 whitespace-nowrap">{next}</span> : <span className="sr-only">{next}</span>}
    </span>
  );
};

/**
 * The level on a singer's own score card: what the song added, and the new
 * level when it crossed one. `xp`: with the song counted; `gained`: what the
 * song added (0 for a play stopped early).
 */
export const LevelGain = ({ xp, gained }: { xp: number; gained: number }) => {
  const { t } = useTranslation();
  const { level, share } = levelProgress(xp);
  const up = level > levelFor(xp - gained);
  return (
    // (a phone's card leaves the name column some 120 px: the parts wrap rather than cut "Level 2 reached!" short)
    <div data-level={level} className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-tight mt-0.5 ${up ? 'text-[#ff7ade] font-semibold' : 'text-white/55'}`}>
      <span className="min-w-0">{up ? t('level.up', { level }) : t('level.badge', { level })}</span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {gained > 0 && <span className="tabular-nums">{t('level.gained', { xp: gained })}</span>}
        <LevelBar share={share} className="w-12 h-1 flex-shrink-0" />
      </span>
    </div>
  );
};

export default LevelBadge;
