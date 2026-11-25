import React from "react";
import { useTranslation } from "react-i18next";
import WrapperPage from "./WrapperPage";
import AndroidContent from "./compliance/content/AndroidContent";
import AppSignupForm from "../components/AppSignupForm";
import { markAnswered } from "../logic/appTestPrompt";

/** /android: how to join the app's closed test. An admin adds the address in Play Console, which mails the test's link. */
const AndroidPage = () => {
  const { t } = useTranslation();
  const form = (
    <AppSignupForm
      platform="android"
      label={t('android.email')}
      button={t('android.join')}
      done={email => t('android.done', { email })}
      privacy={t('android.privacy')}
      onDone={markAnswered}
    />
  );
  return (
    <WrapperPage>
      <div className="max-w-3xl mx-auto rounded-3xl bg-panel border border-white/10 px-5 py-8 sm:px-12 sm:py-12">
        <AndroidContent text={key => t(`android.${key}`)} signUp={form} />
      </div>
    </WrapperPage>
  );
};

export default AndroidPage;
