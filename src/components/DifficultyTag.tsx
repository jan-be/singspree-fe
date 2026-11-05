import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Difficulty } from '../logic/difficulty';

/**
 * The level a score is at, next to the score (logic/difficulty.ts). Nothing
 * where a score comes without one. `large`: in a page's own text sizes (the
 * profile), not squeezed in beside a live score.
 */
const DifficultyTag = ({ level, large = false, className = '' }: { level?: Difficulty | null; large?: boolean; className?: string }) => {
  const { t } = useTranslation();
  if (!level) return null;
  return (
    <span data-difficulty={level} className={`${large ? 'text-xs font-medium' : 'text-[10px] font-semibold uppercase'} whitespace-nowrap text-white/70 bg-white/10 rounded-full px-1.5 py-px ${className}`}>
      {t(`difficulty.${level}`)}
    </span>
  );
};

export default DifficultyTag;
