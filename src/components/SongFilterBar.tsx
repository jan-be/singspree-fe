import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Dropdown, { DropdownChevron, type DropdownOption } from "./Dropdown";
import VoiceFilter from "./VoiceFilter";
import { DuetIcon } from "./Icons";
import { hasTagFilters, loadLanguages, LOCALE_TO_LANGUAGE, type CatalogueLanguage, type Sort, type SongFilters } from "../logic/songFilters";

/** The chips' sizes: the entry page's (a little smaller on phones, where the pinned band must stay short), and the
 * pickers' in the queue and a playlist */
const CHIP_SIZES = {
  page: 'h-8 px-3 text-[13px] sm:h-9 sm:px-[0.9rem] sm:text-sm',
  compact: 'h-7 px-2.5 text-xs',
};

type Size = keyof typeof CHIP_SIZES;

// A combinable filter: quiet when off, lit pink when on
const CategoryPill = ({ label, icon, active, onClick, size }: { label: string; icon?: React.ReactNode; active: boolean; onClick: () => void; size: string }) => (
  <button type="button" onClick={onClick} aria-pressed={active} className={`chip ${size}`}>
    {icon}
    {label}
  </button>
);

// The user's own language has its own pill; this holds the rest. `active`: the language chosen (null: all)
const LanguageDropdown = ({ languages, active, onSelect, userLang, size }: {
  languages: CatalogueLanguage[]; active: string | null; onSelect: (name: string | null) => void; userLang: string; size: string;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    // (its own document: it can sit in the queue's window, QueueWindow)
    const doc = ref.current?.ownerDocument;
    if (!open || !doc) return undefined;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node | null)) setOpen(false); };
    doc.addEventListener('mousedown', handler);
    return () => doc.removeEventListener('mousedown', handler);
  }, [open]);

  const isLangActive = languages.some(l => l.name === active);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`chip ${size} ${isLangActive ? 'is-on' : ''}`}
      >
        {isLangActive ? active : t('sections.moreLanguages')}
        <DropdownChevron open={open} className="-mr-0.5" />
      </button>

      {open && (
        <div className="pop absolute top-full mt-2 left-0 z-50 p-1.5 max-h-72 overflow-y-auto min-w-52">
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className={`menu-item ${!active ? 'bg-white/10 text-white' : ''}`}
          >
            {t('sections.allLanguages')}
          </button>
          <div className="my-1 h-px bg-white/8" aria-hidden="true" />
          {languages.map(lang => (
            <button
              type="button"
              key={lang.name}
              onClick={() => { onSelect(lang.name === active ? null : lang.name); setOpen(false); }}
              className={`menu-item justify-between gap-4 ${lang.name === active ? 'bg-white/10 text-white' : ''} ${lang.name === userLang ? 'font-semibold' : ''}`}
            >
              <span>{lang.name}</span>
              <span className="text-xs text-white/40 tabular-nums">{lang.count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * The song search's filters, wherever songs are looked for (logic/
 * songFilters.ts): duets, the user's language and the others, the voice
 * slider and "clear filters". `onChange` gets what changed.
 *
 * size 'page': the entry page's band, which also holds the order (off while
 * searching: the results are ranked by relevance then; on phones a round
 * button, so the pinned band keeps to two rows in every language).
 * 'compact': the queue's and a playlist's pickers, always in the recommended
 * order: there are enough buttons there already, and the songs worth adding
 * next are the recommended ones anyway.
 */
const SongFilterBar = ({ filters, onChange, size = 'page' }: { filters: SongFilters; onChange: (patch: Partial<SongFilters>) => void; size?: Size }) => {
  const { t, i18n } = useTranslation();
  const [languages, setLanguages] = useState<CatalogueLanguage[]>([]);
  useEffect(() => {
    let gone = false;
    loadLanguages().then(l => { if (!gone) setLanguages(l); });
    return () => { gone = true; };
  }, []);
  const chip = CHIP_SIZES[size];
  const page = size === 'page';

  const userLang = LOCALE_TO_LANGUAGE[i18n.language?.substring(0, 2)];
  const userLangEntry = languages.find(l => l.name === userLang);
  const otherLanguages = languages.filter(l => l.name !== userLang);
  const sortOptions: DropdownOption<Sort>[] = [
    { value: 'recommended', label: t('sections.recommended') },
    { value: 'popular', label: t('sections.popularAtParties') },
    { value: 'new', label: t('sections.newest') },
  ];
  const sortLabel = sortOptions.find(o => o.value === filters.sort)?.label;

  return (
    <div className={`flex flex-wrap items-center ${page ? 'gap-1.5 sm:gap-2' : 'gap-1.5'}`}>
      <CategoryPill
        label={t('sections.duets')}
        icon={<DuetIcon />}
        active={filters.duet}
        onClick={() => onChange({ duet: !filters.duet })}
        size={chip}
      />
      {userLangEntry && (
        <CategoryPill
          label={t('sections.songsInYourLanguage')}
          active={filters.language === userLang}
          onClick={() => onChange({ language: filters.language === userLang ? null : userLang })}
          size={chip}
        />
      )}
      {otherLanguages.length > 0 && (
        <LanguageDropdown languages={otherLanguages} active={filters.language} onSelect={language => onChange({ language })} userLang={userLang} size={chip} />
      )}
      <VoiceFilter value={filters.voice} onChange={voice => onChange({ voice })} chipClass={`chip ${chip}`} />
      {hasTagFilters(filters) && (
        <button
          type="button"
          onClick={() => onChange({ duet: false, language: null, voice: null })}
          className={`ml-1 ${page ? 'text-sm' : 'text-xs'} text-white/45 hover:text-white underline decoration-white/20 underline-offset-4 transition-colors cursor-pointer`}
        >
          {t('sections.clearFilters')}
        </button>
      )}

      {/* The order (the entry page's only): relevance takes over while searching, so it is off then */}
      {page && (
        <div
          className={`ml-auto flex items-center gap-2 text-sm text-white/45 ${filters.q ? 'opacity-40' : ''}`}
          title={filters.q ? t('sections.sortedByRelevance') : undefined}
        >
          <span className="hidden sm:inline" aria-hidden="true">{t('sections.sortBy')}</span>
          <Dropdown
            value={filters.sort}
            options={sortOptions}
            onChange={(sort) => onChange({ sort })}
            disabled={Boolean(filters.q)}
            label={t('sections.sortBy')}
            title={filters.q ? undefined : sortLabel}
            align="end"
            className={`chip ${chip} disabled:cursor-not-allowed max-sm:w-8 max-sm:px-0! max-sm:justify-center`}
          >
            {(open) => <>
              <span className="max-sm:hidden">{sortLabel}</span>
              <DropdownChevron open={open} className="max-sm:hidden -mr-0.5" />
              <svg className="sm:hidden w-4 h-4 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
              </svg>
            </>}
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default SongFilterBar;
