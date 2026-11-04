import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterButtons, Hint, Loading, Section, btn, list, useAgo, type AdminActions } from './AdminParts';
import { adminAppSignupAdded, adminRemoveAppSignup, getAdminAppSignups, type AdminAppSignup, type AppPlatform, type AppSignupStatus } from '../logic/authApi';

type Loaded = { rows: AdminAppSignup[]; counts: Record<AppSignupStatus, number>; status: AppSignupStatus };

const STATUSES: Record<AppPlatform, AppSignupStatus[]> = { android: ['waiting', 'added'], ios: ['waiting'] };

/**
 * /admin's list of the addresses left for an app (backend appSignups.ts).
 *
 * android: a closed test's addresses go into Play Console by hand. Copy
 * addresses, paste them there, then Added on each, which mails them the link
 * they opt in through.
 * ios: they wait for the day there is an app; nothing is sent from here.
 *
 * `count`: the overview's count, read every few seconds; when it differs from
 * the list's, the list is read again, so new addresses show up by themselves.
 */
const AdminAppSignups = ({ platform, count, actions }: { platform: AppPlatform; count: number | undefined; actions: AdminActions }) => {
  const { t } = useTranslation();
  const ago = useAgo();
  const { busy, run, say, fail } = actions;
  const texts = platform === 'android' ? 'admin.testers' : 'admin.ios';
  const [status, setStatus] = useState<AppSignupStatus>('waiting');
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const load = useCallback((s: AppSignupStatus) => getAdminAppSignups(platform, s)
    .then(p => setLoaded({ rows: p.data, counts: p.counts, status: s }))
    .catch(fail), [platform, fail]);
  useEffect(() => { setLoaded(null); load(status); }, [status, load]);
  useEffect(() => {
    if (count == null || !loaded || loaded.counts.waiting === count) return;
    load(status);
  }, [count]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = (rows: AdminAppSignup[]) => navigator.clipboard.writeText(rows.map(r => r.email).join(', '))
    .then(() => say(t('admin.testers.copied', { count: rows.length })), fail);
  const added = (r: AdminAppSignup) => run(async () => {
    const { mailed } = await adminAppSignupAdded(r.id);
    say(t(mailed ? 'admin.testers.mailed' : 'admin.testers.notMailed', { email: r.email }));
    await load(status);
  });
  const remove = (r: AdminAppSignup) => {
    if (!window.confirm(t('admin.testers.removeConfirm', { email: r.email }))) return;
    run(async () => {
      await adminRemoveAppSignup(r.id);
      say(t('admin.testers.removed', { email: r.email }));
      await load(status);
    });
  };

  return (
    <Section
      title={t(`${texts}.title`)}
      aside={(
        <FilterButtons
          options={STATUSES[platform]}
          value={status}
          onChange={setStatus}
          label={s => t(`${texts}.status.${s}`)}
          counts={loaded?.counts}
        />
      )}
    >
      <Hint>{t(`${texts}.hint`)}</Hint>
      {!loaded
        ? <Loading>{t('sections.loading')}</Loading>
        : (
          <>
            <ul className={list}>
              {loaded.rows.length === 0 && <li className="px-4 py-3 text-sm text-white/45">{t('admin.reports.none')}</li>}
              {loaded.rows.map(r => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3" data-testid={`${platform}-signup`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white break-all select-all">{r.email}</div>
                    <div className="text-xs text-white/45">
                      {r.addedAt ? t('admin.testers.wasAdded', { time: ago(r.addedAt) }) : ago(r.createdAt)}{r.lang ? ` · ${r.lang}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {platform === 'android' && !r.addedAt && <button type="button" disabled={busy} onClick={() => added(r)} className={btn.primary}>{t('admin.testers.added')}</button>}
                    <button type="button" disabled={busy} onClick={() => remove(r)} className={btn.quiet}>{t('admin.testers.remove')}</button>
                  </div>
                </li>
              ))}
            </ul>
            {status === 'waiting' && loaded.rows.length > 0 && (
              <button type="button" onClick={() => copy(loaded.rows)} className={`${btn.quiet} mt-3`}>{t('admin.testers.copy')}</button>
            )}
          </>
        )}
    </Section>
  );
};

export default AdminAppSignups;
