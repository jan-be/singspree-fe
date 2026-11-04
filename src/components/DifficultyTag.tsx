import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Difficulty } from '../logic/difficulty';

/**
 * The level a score is at, next to the score (logic/difficulty.ts). Nothing
 * where a score comes without one.
 */
const DifficultyTag = ({ level, className = '' }: { level?: Difficulty | null; className?: string }) => {
  const { t } = useTranslation();
  if (!level) return null;
  return (
    <span data-difficulty={level} className={`text-[10px] font-semibold uppercase whitespace-nowrap text-white/70 bg-white/10 rounded-full px-1.5 py-px ${className}`}>
      {t(`difficulty.${level}`)}
    </span>
  );
};

export default DifficultyTag;
