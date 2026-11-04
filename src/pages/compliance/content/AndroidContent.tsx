import React from "react";
import type en from "../../../i18n/locales/en.json";
import { GooglePlayIcon } from "../../../components/SocialLinks";

/** Where a tester opts in; it leads on to the store page, which only testers can see until the app is released */
const TEST_URL = "https://play.google.com/apps/testing/com.singspree.app";

/** A text of the page by its key under `android` in the locale files */
export type AndroidText = (key: keyof typeof en.android) => string;

/**
 * The page body on its own, without the navigation and footer, so the build
 * can prerender it for crawlers (see src/prerender), which is also what a
 * shared link's preview shows. People get it through AndroidPage.tsx, with the
 * form as `signUp`; the crawler copy has no form, and English `text`.
 */
const AndroidContent = ({ text, signUp }: { text: AndroidText; signUp?: React.ReactNode }) => (
  <div className="max-w-[65ch] text-[15px] sm:text-base leading-[1.7] text-white/75 space-y-9">
    <header className="space-y-3">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] leading-tight text-white">{text('title')}</h1>
      <p>{text('intro')}</p>
    </header>

    <ol className="list-decimal pl-5 space-y-2 marker:text-white/40">
      <li>{text('step1')}</li>
      <li>{text('step2')}</li>
      <li>{text('step3')}</li>
    </ol>

    {signUp}

    <section className="space-y-3">
      <h2 className="text-lg sm:text-xl font-semibold tracking-[-0.015em] text-white">{text('already')}</h2>
      <a href={TEST_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
        <span className="block w-[18px] h-[18px] [&>svg]:w-full [&>svg]:h-full">{GooglePlayIcon}</span>
        <span>{text('open')}</span>
      </a>
    </section>
  </div>
);

export default AndroidContent;
