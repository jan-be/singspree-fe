import React from "react";
import { useTranslation } from "react-i18next";
import WrapperPage from "./WrapperPage";
import AppSignupForm from "../components/AppSignupForm";

/**
 * /ios: there is no iOS app, so the page only asks who would want one and
 * keeps their address for one mail the day there is (backend appSignups.ts).
 * It has no crawler page (src/prerender), so crawlers get a 404 and it stays
 * out of search results.
 */
const IosPage = () => {
  const { t } = useTranslation();
  return (
    <WrapperPage>
      <div className="max-w-3xl mx-auto rounded-3xl bg-panel border border-white/10 px-5 py-8 sm:px-12 sm:py-12">
        <div className="max-w-[65ch] text-[15px] sm:text-base leading-[1.7] text-white/75 space-y-6">
          <header className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] leading-tight text-white">{t('ios.title')}</h1>
            <p>{t('ios.intro')}</p>
          </header>
          <AppSignupForm
            platform="ios"
            label={t('auth.email')}
            button={t('ios.interested')}
            done={email => t('ios.done', { email })}
            privacy={t('ios.privacy')}
          />
        </div>
      </div>
    </WrapperPage>
  );
};

export default IosPage;
