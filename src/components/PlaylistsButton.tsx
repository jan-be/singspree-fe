import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { savePendingQueue } from "../logic/partyHistory";
import {
  usePlaylists, createPlaylist, renamePlaylist, setPlaylistSongs, duplicatePlaylist, deletePlaylist, restorePlaylist,
  shuffled, playlistUrl, cleanName, MAX_NAME, MAX_PLAYLIST_SONGS, type Playlist,
} from "../logic/playlists";
import { trackPick } from "../logic/track";
import { PlaylistIcon } from "./Icons";
import SongThumb from "./SongThumb";
import SongPicker from "./SongPicker";
import { useStayPut } from "../logic/useStayPut";
import { useDragReorder, DragHandle, DRAG_OVER_CLASS } from "./DragReorder";

/** How long a deleted list can still be put back */
const UNDO_MS = 8000;

const smallButton = "btn btn-sm h-8 px-3 text-[13px] bg-white/[0.07] text-white/85 hover:bg-white/[0.12] hover:text-white";

/** The list's first song opens, the others wait for the party's queue (as Start again does) */
function useStart(onStarted: () => void) {
  const navigate = useNavigate();
  return (list: Playlist) => {
    const [first, ...rest] = list.songs;
    if (!first) return;
    savePendingQueue(rest);
    trackPick('playlist', { songId: first.songId, position: 0 });
    onStarted();
    navigate(`/sing/${first.songId}`);
  };
}

/**
 * One list: its name, its songs in order (dragged into place as in the queue:
 * useDragReorder), more songs (SongPicker: the songs that fit the list, newest
 * songs counting most, and the entry page's search), and what can be done
 * with it.
 */
const PlaylistEditor = ({ list, onBack, onStart, onDeleted }: { list: Playlist; onBack: () => void; onStart: (list: Playlist) => void; onDeleted: (gone: { playlist: Playlist; index: number }) => void }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(list.name);
  const [copied, setCopied] = useState(false);
  useEffect(() => setName(list.name), [list.name]);
  const songs = list.songs;
  const inList = useMemo(() => new Set(songs.map(s => s.songId)), [songs]);
  const newestFirst = useMemo(() => songs.map(s => s.songId).reverse(), [songs]);
  // "Add songs" does not move while someone adds (each add makes the list above it a row longer)
  const { listRef, addRef } = useStayPut<HTMLDivElement, HTMLDivElement>();
  const { dragOverIndex, itemProps } = useDragReorder(songs.length, (from, to) => {
    const next = [...songs];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setPlaylistSongs(list.id, next);
  }, { handleOnly: true }); // (the list scrolls: a swipe elsewhere on a row is a scroll)
  const commitName = () => {
    const clean = cleanName(name);
    if (clean && clean !== list.name) renamePlaylist(list.id, clean);
    else setName(list.name);
  };
  const share = async () => {
    try {
      await navigator.clipboard.writeText(playlistUrl(window.location.origin, list));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* no clipboard: nothing to say */ }
  };
  const full = songs.length >= MAX_PLAYLIST_SONGS;
  return (
    <div className="flex flex-col gap-3.5 min-h-0">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onBack} className="btn btn-sm btn-ghost h-8 px-2 -ml-2 text-white/60">← {t('playlists.back')}</button>
      </div>
      <input
        value={name}
        maxLength={MAX_NAME}
        onChange={e => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setName(list.name); e.stopPropagation(); } }}
        aria-label={t('playlists.name')}
        className="field w-full h-10 px-3 text-base font-semibold"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" disabled={!songs.length} onClick={() => onStart(list)} className="btn btn-sm btn-primary h-8 px-3.5 text-[13px] disabled:opacity-40" title={t('playlists.startHint')}>
          ▶ {t('playlists.start')}
        </button>
        <button type="button" disabled={songs.length < 2} onClick={() => setPlaylistSongs(list.id, shuffled(songs))} className={`${smallButton} disabled:opacity-40`}>{t('playlists.shuffle')}</button>
        <button type="button" disabled={!songs.length} onClick={share} className={`${smallButton} disabled:opacity-40`}>{copied ? t('playlists.linkCopied') : t('playlists.share')}</button>
        <button type="button" onClick={() => duplicatePlaylist(list.id, t('playlists.copyName', { name: list.name }))} className={smallButton}>{t('playlists.duplicate')}</button>
        <button
          type="button"
          onClick={() => { const gone = deletePlaylist(list.id); if (gone) onDeleted(gone); }}
          className={`${smallButton} hover:text-red-300 hover:bg-red-500/10`}
        >
          {t('playlists.delete')}
        </button>
      </div>

      <div className="text-white/45 text-xs">{t('again.songs', { count: songs.length })}</div>
      <div ref={listRef}>
        {songs.length === 0 ? (
          <div className="text-white/55 text-sm py-2">{t('playlists.noSongs')}</div>
        ) : (
          <ol className="max-h-[38vh] overflow-y-auto overscroll-contain -mx-1.5 px-1.5 divide-y divide-white/[0.06]" aria-label={t('playlists.title')}>
            {songs.map((s, i) => (
              <li key={s.songId} className={`flex items-center gap-2.5 px-1.5 py-1.5 transition-colors ${dragOverIndex === i ? DRAG_OVER_CLASS : ''}`} {...itemProps(i)}>
                <DragHandle enabled position={i + 1} />
                <SongThumb videoId={s.videoId} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="text-white truncate">{s.title}</div>
                  <div className="text-white/50 text-xs truncate">{s.artist}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setPlaylistSongs(list.id, songs.filter(x => x.songId !== s.songId))}
                  className="btn-icon w-8 h-8 -mr-1 text-white/45 hover:text-red-300 text-xs"
                  aria-label={`${t('playlists.remove')}: ${s.title}`}
                  title={t('playlists.remove')}
                >
                  &#10005;
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <div ref={addRef} className="border-t border-white/[0.07] pt-3">
        <div className="text-white/70 text-xs font-semibold mb-1.5">{t('playlists.addSongs')}</div>
        <SongPicker
          onPick={song => setPlaylistSongs(list.id, [...songs, song])}
          picked={inList}
          full={full}
          addLabel={t('playlists.add')}
          pickedLabel={t('playlists.inList')}
          suggestFrom={newestFirst}
          suggestionsLabel={t('playlists.suggestions')}
          placeholder={t('playlists.searchPlaceholder')}
        />
        {full && <div className="text-white/45 text-xs mt-1.5">{t('playlists.full', { count: MAX_PLAYLIST_SONGS })}</div>}
      </div>
    </div>
  );
};

/** Every list: start one, open one, make one */
export const PlaylistsDialog = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const lists = usePlaylists();
  const [openId, setOpenId] = useState<string | null>(null);
  const [gone, setGone] = useState<{ playlist: Playlist; index: number } | null>(null);
  const [noRoom, setNoRoom] = useState(false);
  const start = useStart(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = lists.find(p => p.id === openId) ?? null;

  useEffect(() => { panelRef.current?.focus(); }, []);
  useEffect(() => {
    // (Escape in a box with text in it empties the box first: SearchBar)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement && e.target.value)) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (!gone) return undefined;
    const timer = setTimeout(() => setGone(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [gone]);

  const make = () => {
    const list = createPlaylist(t('playlists.newName'), []);
    if (list) setOpenId(list.id);
    else setNoRoom(true);
  };
  const deleted = (g: { playlist: Playlist; index: number }) => { setGone(g); setOpenId(null); };

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlists-title"
        className="pop fixed z-[61] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[560px] max-w-[92vw] max-h-[86vh] overflow-y-auto overscroll-contain p-5 outline-none"
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 id="playlists-title" className="text-white font-semibold text-lg tracking-[-0.01em] m-0 flex items-center gap-2">
              <PlaylistIcon size={18} />{t('playlists.title')}
            </h2>
            {!open && <p className="text-white/55 text-xs mt-1 mb-0 text-pretty">{t('playlists.hint')}</p>}
          </div>
          <button type="button" onClick={onClose} className="btn-icon w-8 h-8 text-white/50 -mr-1.5 -mt-1" aria-label={t('playlists.close')} title={t('playlists.close')}>✕</button>
        </div>

        {gone && (
          <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] pl-3 pr-1 py-1 text-sm text-white/75">
            <span className="truncate">{t('playlists.deleted', { name: gone.playlist.name })}</span>
            <button type="button" onClick={() => { restorePlaylist(gone); setGone(null); }} className="btn btn-sm btn-ghost h-8 px-3 text-white">{t('playlists.undo')}</button>
          </div>
        )}

        {open ? (
          <PlaylistEditor list={open} onBack={() => setOpenId(null)} onStart={start} onDeleted={deleted} />
        ) : (
          <>
            {lists.length === 0 ? (
              <div className="text-white/55 text-sm py-3">{t('playlists.empty')}</div>
            ) : (
              <ul className="space-y-1 mb-3">
                {lists.map(list => (
                  <li key={list.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/[0.04]">
                    <button type="button" onClick={() => setOpenId(list.id)} className="min-w-0 flex-1 text-left cursor-pointer" title={t('playlists.edit')}>
                      <div className="text-white text-sm font-semibold truncate">{list.name}</div>
                      <div className="text-white/45 text-xs">{t('again.songs', { count: list.songs.length })}</div>
                    </button>
                    <button type="button" onClick={() => setOpenId(list.id)} className={smallButton}>{t('playlists.edit')}</button>
                    <button
                      type="button"
                      disabled={!list.songs.length}
                      onClick={() => start(list)}
                      title={t('playlists.startHint')}
                      className="btn btn-sm btn-primary h-8 px-3.5 text-[13px] disabled:opacity-40"
                    >
                      ▶ {t('playlists.start')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={make} className={smallButton}>+ {t('playlists.new')}</button>
            {noRoom && <div className="text-white/45 text-xs mt-2">{t('playlists.tooMany')}</div>}
          </>
        )}
      </div>
    </>,
    document.body,
  );
};

/**
 * "Playlists" in the home page's top bar, next to Join Party: for the power
 * users who plan their nights (logic/playlists.ts). From sm on; a phone has
 * them in its side menu (SideMenu).
 */
const PlaylistsButton = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-sm btn-ghost hidden sm:inline-flex" aria-haspopup="dialog">
        <PlaylistIcon size={16} />
        {t('playlists.title')}
      </button>
      {open && <PlaylistsDialog onClose={() => setOpen(false)} />}
    </>
  );
};

export default PlaylistsButton;
