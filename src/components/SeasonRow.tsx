import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiUrl } from "../GlobalConsts";
import { useSongNames } from "../logic/useSongNames";
import { trackPick } from "../logic/track";
import { DuetIcon } from "./Icons";
import type { Season } from "../seasons/seasons";
import type { SongNamesSource } from "../logic/lyricsScripts";

/** A song of the row (backend GET /songs/cards) */
interface SeasonSong extends SongNamesSource {
  songId: string;
  videoId: string;
  isDuet?: boolean;
}

/** Wider screens show two lines (4 a line, 6 on wide ones) until "More" opens the rest; phones scroll through all */
const FOLDED = 8;
const FOLDED_WIDE = 12;
const foldClass = (i: number) => (i >= FOLDED_WIDE ? 'sm:hidden' : i >= FOLDED ? 'sm:hidden xl:block' : '');

const SeasonCard = ({ song, position, seasonId, folded }: { song: SeasonSong; position: number; seasonId: string; folded: boolean }) => {
  const names = useSongNames()(song);
  return (
    <Link
      to={`/sing/${song.songId}`}
      onClick={() => trackPick('season', { songId: song.songId, position, season: seasonId })}
      className={`group block w-[180px] sm:w-auto flex-shrink-0 snap-start rounded-xl no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70 ${folded ? foldClass(position) : ''}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.1] transition-[box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_32px_-14px_rgba(var(--hot-glow),0.6)] group-focus-visible:-translate-y-0.5">
        <img
          src={`https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg`}
          alt={`${names.artist} - ${names.title}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {song.isDuet && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1">
            <span className="h-5 px-1 rounded-full bg-black/65 text-white flex items-center"><DuetIcon size={11} strokeWidth={2.2} /></span>
          </div>
        )}
      </div>
      <div className="pt-2 px-0.5" lang={names.lang} title={names.roman}>
        <div className="text-white font-semibold text-[14px] leading-snug truncate">{names.title}</div>
        <div className="text-white/50 text-[12.5px] leading-snug truncate">{names.artist}</div>
      </div>
    </Link>
  );
};

/**
 * The season's songs (src/seasons) at the top of the entry page's grid, while
 * one is on: Halloween's in the last week of October, and so on.
 */
export default function SeasonRow({ season }: { season: Season }) {
  const { t } = useTranslation();
  const [songs, setSongs] = useState<SeasonSong[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let gone = false;
    fetch(`${apiUrl}/songs/cards?ids=${season.songs.join(',')}`)
      .then(r => r.json())
      .then(j => { if (!gone) setSongs(j.data ?? []); })
      .catch(() => {});
    return () => { gone = true; };
  }, [season]);

  if (!songs?.length) return null;
  const more = songs.length > FOLDED;

  return (
    <section className="mb-8 sm:mb-10" aria-labelledby="season-title">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <div className="min-w-0">
          <h2 id="season-title" className="m-0 text-white text-lg sm:text-xl font-semibold tracking-[-0.01em]">{t(`season.${season.id}.title`)}</h2>
          <p className="m-0 mt-0.5 text-white/45 text-[13px]">{t(`season.${season.id}.explain`)}</p>
        </div>
        {more && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className={`max-sm:hidden flex-shrink-0 text-sm text-white/45 hover:text-white underline decoration-white/20 underline-offset-4 transition-colors cursor-pointer ${songs.length <= FOLDED_WIDE ? 'xl:hidden' : ''}`}
          >
            {open ? t('season.less') : t('season.more')}
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-px-4 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:scroll-px-0 sm:pb-0 sm:overflow-visible sm:grid sm:grid-cols-4 xl:grid-cols-6 sm:gap-4 sm:gap-y-5 [scrollbar-width:none]">
        {songs.map((s, i) => <SeasonCard key={s.songId} song={s} position={i} seasonId={season.id} folded={!open} />)}
      </div>
    </section>
  );
}
