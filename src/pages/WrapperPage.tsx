import React from "react";
import Footer from "../components/Footer";
import { Link } from "react-router-dom";
import Wordmark from "../components/Wordmark";
import AccountMenu from "../components/AccountMenu";
import AdminLink from "../components/AdminLink";
import AppMenu from "../components/AppMenu";
import { inOurApp } from "../logic/androidApp";

export interface WrapperPageProps {
  children?: React.ReactNode;
  hideFooter?: boolean;
  /** extra buttons in the top bar, left of the account (the front page's Join Party) */
  navActions?: React.ReactNode;
}

const WrapperPage = (props: WrapperPageProps) => {
  // Our apps keep the footer's links in a menu at the top bar's end (AppMenu)
  const [inApp] = React.useState(inOurApp);
  return (
    <div className="flex flex-col min-h-screen overflow-x-clip">
      <nav className="bg-ink/70 backdrop-blur-md border-b border-white/[0.06] relative z-40">
        <div className="max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" className="flex items-center no-underline transition-colors">
            <Wordmark height={38} className="-my-1.5" />
          </Link>
          {/* relative: the anchor of a navAction's drop-down; flex-1: a navAction can take up the room that is left */}
          <div className="relative flex flex-1 min-w-0 items-center justify-end gap-2 sm:gap-3">
            {props.navActions}
            <AdminLink />
            <AccountMenu />
            {inApp && <AppMenu />}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-3xl xl:max-w-5xl 2xl:max-w-6xl w-full mx-auto px-4 py-10">
        {props.children}
      </main>

      {!props.hideFooter && !inApp && <Footer />}
    </div>
  );
};

export default WrapperPage;
