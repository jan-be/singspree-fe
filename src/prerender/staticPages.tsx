import ContactContent from '../pages/compliance/content/ContactContent';
import PrivacyPolicyContent from '../pages/compliance/content/PrivacyPolicyContent';
import TermsOfServiceContent from '../pages/compliance/content/TermsOfServiceContent';
import type { ComponentType } from 'react';

/**
 * Pages with no data behind them, rendered to static HTML at build time so a
 * crawler gets the real content instead of the app shell.
 *
 * The backend prerenders everything that depends on the catalogue (the home
 * pages and the 28,000 song pages); these three are the frontend's own, so
 * they are generated here, from the same components people see. Add a page
 * here and nginx needs no change: it serves whatever was generated for the
 * matching URL and 404s a crawler when nothing was.
 *
 * An entry may set `noindex: true` to keep its page out of search results
 * (crawlers still read it and follow its links). The three below are indexable:
 * who runs the site and its terms are what search engines look for on a new
 * domain, and the backend's English home page links them.
 */
export const STATIC_PAGES: { path: string; title: string; description: string; Content: ComponentType; noindex?: boolean }[] = [
  {
    path: '/contact',
    title: 'Contact | SingSpree',
    description: 'How to reach SingSpree about the free online karaoke app, its song catalogue or your account.',
    Content: () => <ContactContent email={false} />,
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | SingSpree',
    description: 'What SingSpree stores when you sing, how long it is kept, and the rights you have over it.',
    Content: PrivacyPolicyContent,
  },
  {
    path: '/tos',
    title: 'Terms of Service | SingSpree',
    description: 'The terms for using SingSpree, the free online karaoke app with synced lyrics and pitch scoring.',
    Content: TermsOfServiceContent,
  },
];
