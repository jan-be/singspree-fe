import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPlaylist, MAX_NAME } from "../logic/playlists";
import type { HistorySongInput } from "../logic/partyHistory";
import { PlaylistIcon } from "./Icons";

const buttonClass = "btn btn-sm h-7 px-2.5 gap-1.5 text-xs font-medium flex-shrink-0 bg-white/[0.07] text-white/80 hover:bg-white/[0.12] hover:text-white disabled:opacity-40";

/**
 * "Save as playlist" in the queue's header, for the host on a desktop: the
 * song on stage and the queue become a list for another party (logic/
 * playlists.ts), under a name that can be changed right here (the date, until
 * then). Songs still being charted have no song yet and are left out.
 */
const SavePlaylistButton = ({ songs }: { songs: readonly (HistorySongInput | null | undefined)[] }) => {
  const { t, i18n } = useTranslation();
  const [naming, setNaming] = useState<string | null>(null);
  const [saved, setSaved] = useState<'saved' | 'full' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const kept = songs.filter((s): s is HistorySongInput => Boolean(s?.songId));

  useEffect(() => { if (naming !== null) inputRef.current?.select(); }, [naming !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(null), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  const startNaming = () => {
    let date = '';
    try { date = new Date().toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }); } catch { /* */ }
    setNaming(t('playlists.partyName', { date }));
  };
  const save = () => {
    if (naming === null) return;
    setSaved(createPlaylist(naming, kept) ? 'saved' : 'full');
    setNaming(null);
  };

  if (naming !== null) {
    return (
      <form className="flex items-center gap-1" onSubmit={e => { e.preventDefault(); save(); }}>
        <input
          ref={inputRef}
          value={naming}
          maxLength={MAX_NAME}
          onChange={e => setNaming(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setNaming(null); } }}
          aria-label={t('playlists.name')}
          className="field h-7 px-2 text-xs w-44"
        />
        <button type="submit" className={buttonClass}>{t('playlists.save')}</button>
        <button type="button" onClick={() => setNaming(null)} className="btn-icon w-7 h-7 text-white/50" aria-label={t('playlists.cancel')} title={t('playlists.cancel')}>✕</button>
      </form>
    );
  }
  return (
    <button type="button" onClick={startNaming} disabled={!kept.length} title={t('playlists.saveQueueHint')} className={buttonClass}>
      <PlaylistIcon size={13} />
      {saved === 'saved' ? t('playlists.saved') : saved === 'full' ? t('playlists.tooMany') : t('playlists.saveQueue')}
    </button>
  );
};

export default SavePlaylistButton;
