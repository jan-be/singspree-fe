import React from "react";
import type en from "../../../i18n/locales/en.json";
import type { AmazonStore } from "../../../logic/amazonStore";
import AmazonAppstoreBadge from "../../../components/AmazonAppstoreBadge";

/** A text of the page by its key under `firetv` in the locale files */
export type FireTvText = (key: keyof typeof en.firetv) => string;

/** The circled "i" before the affiliate note */
const InfoIcon = (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true" className="w-3.5 h-3.5 shrink-0 mt-[3px]">
    <circle cx="8" cy="8" r="6.6" />
    <path d="M8 7.2v4" />
    <circle cx="8" cy="4.9" r="0.4" fill="currentColor" />
  </svg>
);

/**
 * The /firetv page body on its own, without the navigation and footer, so the
 * build can prerender it for crawlers (see src/prerender) like AndroidContent.
 * People get it through FireTvPage.tsx with the Amazon store of their country
 * (logic/amazonStore.ts); the crawler copy has amazon.com and English `text`.
 * Where the link is the affiliate one, the note under it says so.
 *
 * The picture is public/firetv-party-*.webp, real screenshots of one party
 * (claude-generated/firetv-page renders it).
 */
const FireTvContent = ({ text, store }: { text: FireTvText; store: AmazonStore }) => (
  <div className="max-w-[65ch] text-[15px] sm:text-base leading-[1.7] text-white/75 space-y-6">
    <header className="space-y-2">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] leading-tight text-white">{text('title')}</h1>
      <p>{text('intro')}</p>
    </header>

    {/* the store link right under the intro, so it is on the first screen everywhere; the picture and the steps follow */}
    <section className="space-y-2">
      {/* the badge as the main action: .btn for focus and press, a badge's corners and size instead of the pill */}
      <a
        href={store.href}
        target="_blank"
        rel={store.tagged ? "sponsored noopener noreferrer" : "noopener noreferrer"}
        aria-label={text('get')}
        className="btn btn-primary h-14 px-5 rounded-xl"
      >
        <AmazonAppstoreBadge lead={text('badge')} className="block h-10 w-auto" />
      </a>
      {store.tagged && (
        <p className="flex items-start gap-1.5 text-xs leading-normal text-white/45">
          {InfoIcon}
          <span>{text('affiliate')}</span>
        </p>
      )}
    </section>

    <img
      src="/firetv-party-900.webp"
      srcSet="/firetv-party-900.webp 900w, /firetv-party-1800.webp 1800w"
      sizes="(min-width: 640px) 600px, 100vw"
      width={900}
      height={520}
      alt={text('pictureAlt')}
      className="block w-full h-auto"
    />

    <ol className="list-decimal pl-5 space-y-1 leading-normal marker:text-white/40">
      <li>{text('step1')}</li>
      <li>{text('step2')}</li>
      <li>{text('step3')}</li>
    </ol>
  </div>
);

export default FireTvContent;
