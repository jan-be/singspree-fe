import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import WrapperPage from "./WrapperPage";
import FireTvContent from "./compliance/content/FireTvContent";
import { amazonStore } from "../logic/amazonStore";

/** /firetv: the Fire TV app, with a link to it in the visitor's own Amazon store */
const FireTvPage = () => {
  const { t } = useTranslation();
  const store = useMemo(amazonStore, []);
  return (
    <WrapperPage>
      <div className="max-w-3xl mx-auto rounded-3xl bg-panel border border-white/10 px-5 py-8 sm:px-12 sm:py-12">
        <FireTvContent text={key => t(`firetv.${key}`)} store={store} />
      </div>
    </WrapperPage>
  );
};

export default FireTvPage;
