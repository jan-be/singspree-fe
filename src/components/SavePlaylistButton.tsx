import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPlaylist, setPlaylistSongs, usePlaylists, cleanName, MAX_NAME } from "../logic/playlists";
import type { HistorySong, HistorySongInput } from "../logic/partyHistory";
import { PlaylistIcon } from "./Icons";

const buttonClass = "btn btn-sm h-7 px-2.5 gap-1.5 text-xs font-medium flex-shrink-0 bg-white/[0.07] text-white/80 hover:bg-white/[0.12] hover:text-white disabled:opacity-40";
const primaryClass = "btn btn-sm btn-primary h-7 px-2.5 text-xs font-medium flex-shrink-0";

/** Two names are the same list's when they differ only in case and spaces */
const sameName = (a: string, b: string) => cleanName(a).toLocaleLowerCase() === cleanName(b).toLocaleLowerCase();

/**
 * "Save as playlist" in the queue's header, for the host on a desktop: the
 * songs that played (`played`, while the box under the name is ticked), the
 * song on stage and the queue become a list for another party (logic/
 * playlists.ts), under a name that can be changed right here. Songs still
 * being charted have no song yet and are left out.
 *
 * The name starts as the playlist the party started from (`sourceId`), else
 * the date. A name a list already has asks what to do with that list: update
 * it (its songs become these), add these to it (the ones it does not have, at
 * its end), or save a new list next to it.
 */
const SavePlaylistButton = ({ songs, played = [], sourceId }: {
  songs: readonly (HistorySongInput | null | undefined)[];
  played?: readonly HistorySong[];
  sourceId?: string;
}) => {
  const { t, i18n } = useTranslation();
  const lists = usePlaylists();
  const [naming, setNaming] = useState<string | null>(null);
  const [withPlayed, setWithPlayed] = useState(true);
  const [saved, setSaved] = useState<'saved' | 'updated' | 'full' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateRef = useRef<HTMLButtonElement>(null);
  const ahead = songs.filter((s): s is HistorySongInput => Boolean(s?.songId));
  const kept = withPlayed ? [...played, ...ahead] : ahead;
  const source = sourceId ? lists.find(p => p.id === sourceId) ?? null : null;
  const taken = naming === null ? null : lists.find(p => sameName(p.name, naming)) ?? null;

  useEffect(() => { if (naming !== null) inputRef.current?.select(); }, [naming !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  const startNaming = () => {
    if (source) { setNaming(source.name); return; }
    let date = '';
    try { date = new Date().toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }); } catch { /* */ }
    setNaming(t('playlists.partyName', { date }));
  };
  const saveNew = () => {
    if (naming === null) return;
    setSaved(createPlaylist(naming, kept) ? 'saved' : 'full');
    setNaming(null);
  };
  /** The list with that name: its songs become these (update), or these join it (add) */
  const saveInto = (add: boolean) => {
    if (!taken) return;
    setPlaylistSongs(taken.id, add ? [...taken.songs, ...kept] : kept);
    setSaved('updated');
    setNaming(null);
  };

  if (naming !== null) {
    return (
      // (Enter on a name a list has: to the choice, which is the user's to make)
      <form className="flex flex-col gap-1.5 w-[18rem] max-w-full" onSubmit={e => { e.preventDefault(); if (taken) updateRef.current?.focus(); else saveNew(); }}>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef}
            value={naming}
            maxLength={MAX_NAME}
            onChange={e => setNaming(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setNaming(null); } }}
            aria-label={t('playlists.name')}
            className="field h-7 px-2 text-xs flex-1 min-w-0"
          />
          {!taken && <button type="submit" disabled={!kept.length} className={buttonClass}>{t('playlists.save')}</button>}
          <button type="button" onClick={() => setNaming(null)} className="btn-icon w-7 h-7 text-white/50" aria-label={t('playlists.cancel')} title={t('playlists.cancel')}>✕</button>
        </div>
        {played.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer select-none">
            <input type="checkbox" checked={withPlayed} onChange={e => setWithPlayed(e.target.checked)} className="accent-hot" />
            {t('playlists.withPlayed', { count: played.length })}
          </label>
        )}
        {taken && (
          <div role="group" aria-label={t('playlists.nameTaken', { name: taken.name })} className="flex flex-col gap-1">
            <div className="text-xs text-white/70 truncate">{t('playlists.nameTaken', { name: taken.name })}</div>
            <div className="flex flex-wrap gap-1">
              <button ref={updateRef} type="button" disabled={!kept.length} onClick={() => saveInto(false)} title={t('playlists.updateHint')} className={`${primaryClass} disabled:opacity-40`}>{t('playlists.update')}</button>
              <button type="button" disabled={!kept.length} onClick={() => saveInto(true)} title={t('playlists.addToHint')} className={buttonClass}>{t('playlists.addTo')}</button>
              <button type="button" disabled={!kept.length} onClick={saveNew} title={t('playlists.saveNewHint')} className={buttonClass}>{t('playlists.saveNew')}</button>
            </div>
          </div>
        )}
      </form>
    );
  }
  return (
    <button type="button" onClick={startNaming} disabled={!ahead.length && !played.length} title={t('playlists.saveQueueHint')} className={buttonClass}>
      <PlaylistIcon size={13} />
      {saved === 'saved' ? t('playlists.saved') : saved === 'updated' ? t('playlists.updated') : saved === 'full' ? t('playlists.tooMany') : t('playlists.saveQueue')}
    </button>
  );
};

export default SavePlaylistButton;
