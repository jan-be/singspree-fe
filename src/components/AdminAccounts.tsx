import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Avatar from './Avatar';
import { btn, Section, Badge, Loading, list, useAgo, type AdminActions } from './AdminParts';
import { deviceLabel } from '../logic/deviceLabel';
import { getAdminUsers, adminSetAdmin, adminRevokeSessions, adminDeleteUser, adminRemoveAvatar } from '../logic/authApi';
import type { AdminUser } from '../logic/authApi';

/**
 * /admin's accounts: the newest ones, or those a search finds, each with its
 * numbers and the buttons that go with it (admin or not, sign out
 * everywhere, take the picture down, delete).
 */

/** What the buttons on an account in the list do */
type UserAction = 'admin' | 'signout' | 'avatar' | 'delete';

const PAGE = 20;

/** One account with its numbers and its buttons (none on yourself); a picture can be taken down (moderation). */
const UserRow = ({ u, isMe, busy, onAct }: { u: AdminUser; isMe: boolean; busy: boolean; onAct: (what: UserAction, u: AdminUser) => void }) => {
  const { t } = useTranslation();
  const ago = useAgo();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {/* Larger than elsewhere, so a picture can be judged from here */}
        <Avatar username={u.username} src={u.avatar} size={40} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/u/${encodeURIComponent(u.username)}`} className="text-white hover:text-white hover:underline decoration-white/30 underline-offset-4 font-semibold truncate">{u.username}</Link>
            {u.isAdmin && <Badge tone="magenta">{t('admin.users.admin')}</Badge>}
            {isMe && <Badge>{t('admin.users.you')}</Badge>}
            {!u.verified && <Badge tone="yellow">{t('admin.users.unverified')}</Badge>}
          </div>
          <div className="text-xs text-white/60 truncate">{u.email ?? '—'} · #{u.id}</div>
          <div className="text-xs text-white/40">
            {t('admin.users.joined', { time: ago(u.createdAt) })}
            {' · '}{u.lastLoginAt ? t('admin.users.lastLogin', { time: ago(u.lastLoginAt) }) : t('admin.users.neverSignedIn')}
            {' · '}{t('admin.users.scores', { count: u.scores ?? 0 })}
            {' · '}{t('admin.users.playsAsName', { count: u.playsAsName ?? 0 })}
            {' · '}{t('admin.users.passkeys', { count: u.passkeys })}
            {u.hasPassword ? ` · ${t('admin.users.password')}` : ''}
            {u.userAgent ? ` · ${deviceLabel(u.userAgent, u.os)}` : ''}
          </div>
        </div>
      </div>
      {!isMe && (
        <div className="flex items-center gap-1.5 sm:gap-2 max-w-full sm:flex-shrink-0 flex-wrap">
          <button type="button" disabled={busy} onClick={() => onAct('admin', u)} className={btn.quiet}>{u.isAdmin ? t('admin.users.removeAdmin') : t('admin.users.makeAdmin')}</button>
          <button type="button" disabled={busy} onClick={() => onAct('signout', u)} className={btn.quiet}>{t('admin.users.signOut')}</button>
          {u.avatar && <button type="button" disabled={busy} onClick={() => onAct('avatar', u)} className={btn.danger}>{t('admin.users.removeAvatar')}</button>}
          <button type="button" disabled={busy} onClick={() => onAct('delete', u)} className={btn.danger}>{t('admin.users.delete')}</button>
        </div>
      )}
    </li>
  );
};

/** `myId`: the signed-in admin's account (its row has no buttons) */
const AdminAccounts = ({ myId, actions }: { myId: number; actions: AdminActions }) => {
  const { t } = useTranslation();
  const { busy, run, say, fail } = actions;
  const [users, setUsers] = useState<{ rows: AdminUser[]; hasMore: boolean; q: string } | null>(null); // { rows, hasMore, q }
  const [q, setQ] = useState('');

  const findUsers = useCallback((term: string) => getAdminUsers(term, 0, PAGE)
    .then(p => setUsers({ rows: p.data, hasMore: p.hasMore, q: term }))
    .catch(fail), [fail]);

  // (a newer term clears the older one's timer: the effect's cleanup)
  useEffect(() => {
    const term = q.trim();
    const timer = setTimeout(() => findUsers(term), term ? 250 : 0);
    return () => clearTimeout(timer);
  }, [q, findUsers]);

  // (the "more" button is under a loaded list: it passes it)
  const moreUsers = (loaded: { rows: AdminUser[]; q: string }) => run(async () => {
    const p = await getAdminUsers(loaded.q, loaded.rows.length, PAGE);
    setUsers(s => s && { ...s, rows: [...s.rows, ...p.data], hasMore: p.hasMore });
  });

  // (the accounts' buttons are in the loaded list)
  const act = (what: UserAction, u: AdminUser) => {
    const replace = (next: AdminUser) => setUsers(s => s && { ...s, rows: s.rows.map(r => (r.id === u.id ? next : r)) });
    if (what === 'admin') {
      if (!window.confirm(t(u.isAdmin ? 'admin.users.removeAdminConfirm' : 'admin.users.makeAdminConfirm', { username: u.username }))) return;
      run(async () => {
        replace((await adminSetAdmin(u.id, !u.isAdmin)) ?? { ...u, isAdmin: !u.isAdmin });
        say(t(u.isAdmin ? 'admin.users.adminRemoved' : 'admin.users.adminMade', { username: u.username }));
      });
    } else if (what === 'signout') {
      run(async () => {
        await adminRevokeSessions(u.id);
        say(t('admin.users.signedOut', { username: u.username }));
      });
    } else if (what === 'avatar') {
      if (!window.confirm(t('admin.users.removeAvatarConfirm', { username: u.username }))) return;
      run(async () => {
        await adminRemoveAvatar(u.id);
        replace({ ...u, avatar: null });
        say(t('admin.users.avatarRemoved', { username: u.username }));
      });
    } else if (what === 'delete') {
      if (!window.confirm(t('admin.users.deleteConfirm', { username: u.username }))) return;
      run(async () => {
        await adminDeleteUser(u.id);
        setUsers(s => s && { ...s, rows: s.rows.filter(r => r.id !== u.id) });
        say(t('admin.users.deleted', { username: u.username }));
      });
    }
  };

  return (
    <Section title={t('admin.users.title')} aside={<span className="text-xs text-white/40">{users?.q ? '' : t('admin.users.newest')}</span>}>
      <input
        type="search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={t('admin.users.search')}
        className="field h-11 px-4 text-sm"
        autoComplete="off"
      />
      {!users
        ? <Loading>{t('sections.loading')}</Loading>
        : (
          <ul className={`mt-3 ${list}`}>
            {users.rows.length === 0 && <li className="px-4 py-3 text-sm text-white/45">{t('admin.users.none')}</li>}
            {users.rows.map(u => <UserRow key={u.id} u={u} isMe={u.id === myId} busy={busy} onAct={act} />)}
          </ul>
        )}
      {users?.hasMore && <button type="button" disabled={busy} onClick={() => moreUsers(users)} className={`${btn.quiet} mt-3`}>{t('admin.showMore')}</button>}
    </Section>
  );
};

export default AdminAccounts;
