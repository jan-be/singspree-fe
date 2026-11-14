import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../logic/AuthContext';
import { BONUS_DAILY, PRODUCT_HUNT_URL, bannerDue, claimBonus, remember, useClaimRememberedBonus } from '../logic/productHunt';

/** Product Hunt's cat-less mark: the P in its orange circle (simple-icons' producthunt path) */
export const ProductHuntLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0">
    <circle cx="12" cy="12" r="12" fill="#FF6154" />
    <path fill="#fff" d="M13.604 8.4h-3.405V12h3.405c.995 0 1.801-.806 1.801-1.801 0-.993-.805-1.799-1.801-1.799zm0 6h-3.405V18H7.801V6h5.804c2.319 0 4.2 1.88 4.2 4.199 0 2.321-1.881 4.201-4.201 4.201z" />
  </svg>
);

/**
 * The home page's card for SingSpree's launch on Product Hunt (logic/productHunt.ts): stop by there, and as a
 * thank-you more AI charts a day for a month. The button opens Product Hunt in a new tab and claims the bonus at
 * once; signed out, it is remembered until they sign in. Gone after a click or ✕, and after the launch week.
 */
const ProductHuntBanner = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [shown] = useState(bannerDue);
  const [closed, setClosed] = useState(false);
  /** after the click: the bonus's end, or that they sign in first */
  const [thanks, setThanks] = useState<{ until: string } | 'signIn' | 'sent' | null>(null);
  useClaimRememberedBonus();
  if (!shown || closed) return null;

  // The link itself opens Product Hunt; this only claims the bonus
  const visit = () => {
    if (!user) { remember('pending'); setThanks('signIn'); return; }
    setThanks('sent');
    claimBonus().then(q => { if (q.bonus?.active) setThanks({ until: q.bonus.until }); }).catch(() => {});
  };
  const date = (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { month: 'long', day: 'numeric' });

  return (
    <div data-product-hunt="" data-out="ph-banner" className="relative mt-6 max-w-md mx-auto rounded-2xl bg-panel border border-white/10 pl-4 pr-2 py-3 flex items-center gap-3 text-left">
      <ProductHuntLogo />
      <div className="min-w-0 flex-1">
        <div className="text-white text-sm font-semibold">{t('productHunt.title')}</div>
        <div className="text-white/60 text-xs mt-0.5 text-pretty">
          {thanks === null && t('productHunt.text', { count: BONUS_DAILY })}
          {thanks === 'sent' && t('productHunt.thanksShort')}
          {thanks === 'signIn' && <>
            {t('productHunt.thanksSignIn', { count: BONUS_DAILY })}{' '}
            <Link to={`/login?next=${encodeURIComponent('/')}`} className="text-white underline underline-offset-2">{t('auth.signIn')}</Link>
          </>}
          {typeof thanks === 'object' && thanks !== null && t('productHunt.thanks', { count: BONUS_DAILY, date: date(thanks.until) })}
        </div>
      </div>
      {thanks === null && (
        <a href={PRODUCT_HUNT_URL} target="_blank" rel="noopener" onClick={visit} className="btn btn-sm btn-primary no-underline shadow-none flex-shrink-0">
          {t('productHunt.visit')}
        </a>
      )}
      <button type="button" onClick={() => { if (thanks === null) remember('closed'); setClosed(true); }} className="btn-icon w-8 h-8 text-white/50 flex-shrink-0" aria-label={t('productHunt.close')}>✕</button>
    </div>
  );
};

export default ProductHuntBanner;
