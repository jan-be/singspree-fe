import ContactContent from '../pages/compliance/content/ContactContent';
import PrivacyPolicyContent from '../pages/compliance/content/PrivacyPolicyContent';
import TermsOfServiceContent from '../pages/compliance/content/TermsOfServiceContent';

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
 * `noindex`: crawlers may read the page and follow its links, but it is not to
 * be shown in results. The legal pages and the contact page are linked from
 * every page's footer, so they are crawled everywhere, yet nobody searches for
 * them: in results they only take room from the song pages.
 */
export const STATIC_PAGES = [
  {
    path: '/contact',
    title: 'Contact | SingSpree',
    description: 'How to reach SingSpree about the free online karaoke app, its song catalogue or your account.',
    Content: ContactContent,
    noindex: true,
  },
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | SingSpree',
    description: 'What SingSpree stores when you sing, how long it is kept, and the rights you have over it.',
    Content: PrivacyPolicyContent,
    noindex: true,
  },
  {
    path: '/tos',
    title: 'Terms of Service | SingSpree',
    description: 'The terms for using SingSpree, the free online karaoke app with synced lyrics and pitch scoring.',
    Content: TermsOfServiceContent,
    noindex: true,
  },
];
