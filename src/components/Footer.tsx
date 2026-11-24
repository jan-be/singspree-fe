import { Link } from "react-router-dom";
import React from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";
import SocialLinks from "./SocialLinks";
import { CupIcon, SUPPORT_URL, supportShown } from "./SupportLink";

const Footer = () => {
  const { t } = useTranslation();
  const [support] = React.useState(supportShown);

  return (
    // (a phone-sized screen has it in the side menu: SideMenu)
    <footer data-out="footer" className="hidden sm:block mt-auto py-6 px-4 border-t border-white/[0.06] bg-ink/60">
      <div className="max-w-xl mx-auto flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm">
          <Link to="/privacy-policy" className="text-white/50 hover:text-white transition-colors">
            {t('footer.privacyPolicy')}
          </Link>
          <Link to="/tos" className="text-white/50 hover:text-white transition-colors">
            {t('footer.termsOfService')}
          </Link>
          <Link to="/contact" className="text-white/50 hover:text-white transition-colors">
            {t('footer.contact')}
          </Link>
          {support && (
            <a href={SUPPORT_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-white/50 hover:text-white transition-colors no-underline">
              <CupIcon className="w-4 h-4" />
              {t('footer.support')}
            </a>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <SocialLinks />
          <span className="w-px h-4 bg-white/15" aria-hidden="true" />
          <LanguageSwitcher />
        </div>
      </div>
    </footer>
  );
};

export default Footer;
