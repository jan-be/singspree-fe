import { inOurApp } from '../logic/androidApp';

/**
 * "Support us": SingSpree's page on Ko-fi, where anyone may chip in.
 *
 * A plain link, not Ko-fi's button script: nothing of theirs loads here (no
 * script, no cookies, nothing for the content security policy) until someone
 * clicks it. Nothing comes in return and nothing is unlocked by it: everything
 * stays free for everyone. Keep it that way: no perks for supporters.
 *
 * Not in our apps (supportShown(), like the store pages in SocialLinks): Google Play and
 * Amazon want tips to the developer to go through their own billing, and on a
 * TV a link could only say "open it on your phone".
 */
export const SUPPORT_URL = 'https://ko-fi.com/singspree';

/** Whether this page shows the link: everywhere but in our apps */
export const supportShown = () => !inOurApp();

/** A cup with steam, in the colour of the text around it */
export const CupIcon = ({ className = '' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 10h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5z" />
    <path d="M16 12h1.5a2.5 2.5 0 0 1 0 5H15.5" />
    <path d="M8 3.5c0 1.2 1 1.6 1 3M12 3.5c0 1.2 1 1.6 1 3" />
  </svg>
);
