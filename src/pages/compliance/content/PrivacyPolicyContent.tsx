import React from "react";

/**
 * The page body on its own, without the navigation and footer, so the build
 * can prerender it for crawlers (see scripts/prerender-static.mjs). The page
 * component below wraps this in the app chrome for people.
 *
 * Plain categories on purpose: what we keep, why, who else gets it and for how
 * long. Every technical detail written here is one more thing that can stop
 * being true, so cookie names, event types and how features work stay out.
 */
const strong = "text-white font-semibold";
const link = "text-[#ff8ae6] hover:text-white underline underline-offset-4 decoration-white/25 hover:decoration-white/60 transition-colors";
const heading = "text-lg sm:text-xl font-semibold tracking-[-0.015em] text-white";
const list = "list-disc pl-5 space-y-2 marker:text-white/30";

const PrivacyPolicyContent = () => (
  <>
    <div className="max-w-[65ch] text-[15px] sm:text-base leading-[1.7] text-white/75 space-y-9">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.025em] leading-tight text-white">Privacy Policy</h1>
        <p className="text-sm text-white/40">Last updated: 14 November 2026</p>
      </header>

      <section className="space-y-3">
        <p>
          SingSpree is run by Jan Beckschewe, who is responsible for your data here. You can reach us through the{" "}
          <a href="/contact" className={link}>Contact page</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={heading}>The short version</h2>
        <ul className={list}>
          <li>You can sing without an account.</li>
          <li>We keep what you sing: a score and pitch data for every song, and a recording unless you turn &ldquo;Save recordings&rdquo; off.</li>
          <li>There are no ads and no third-party analytics, and we don&apos;t sell your data.</li>
          <li>You can see, change or delete what&apos;s in your account, and ask us about anything else.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={heading}>What we keep</h2>
        <p><strong className={strong}>Your account, if you make one.</strong> Your e-mail address, display name, sign-in details (a passkey&apos;s public key, a hashed password or your link to Google), profile picture and sessions. We use your address to sign you in and to tell you about changes to your account, never for newsletters. Other signed-in users who know your exact address can find your display name.</p>
        <p><strong className={strong}>Your songs.</strong> Each song you sing is saved with its score, date, party code and the name you sang under, along with your achievements and friends. Your name, picture and joining date are public on your profile. Your scores and statistics are too, unless you choose friends-only or private in your profile&apos;s privacy settings. Everyone in a party sees the scores in that party.</p>
        <p>As a guest, this is kept under a random id in your browser. It moves to your account if you sign in on that browser.</p>
        <p><strong className={strong}>Your singing.</strong> To score you, your browser sends us the pitch of your singing many times a second. We keep those numbers with your score, whatever your settings. They&apos;re numbers, not sound: your voice can&apos;t be played back from them.</p>
        <p>While &ldquo;Save recordings&rdquo; is on, the sound from your microphone during each song is uploaded too. It&apos;s on unless you turn it off in the microphone panel. A recording can include the music and people nearby. You can listen to your recordings on your profile, share them and delete them.</p>
        <p>We use both to check and improve our pitch detection and scoring.</p>
        <p><strong className={strong}>Your voice on the speakers.</strong> If you turn on &ldquo;My voice on the speakers&rdquo;, your microphone goes live to the host&apos;s screen, directly or through Cloudflare. That sound isn&apos;t stored. Your device and the host&apos;s screen can see each other&apos;s IP address.</p>
        <p><strong className={strong}>Things you choose to use.</strong> Share videos are made on our server from your recording and score card. Share links carry a code that lets us count how many people they bring in. Camera footage stays in your browser unless you put it in a share video, and it isn&apos;t kept on our server after that. Song recognition listens for at most 12 seconds and stores no sound. If you ask for an AI chart, we store who asked and which video it was for.</p>
        <p><strong className={strong}>How the site is used.</strong> Which songs are played, what&apos;s searched for, how songs were chosen, which links to other sites are clicked, where visitors came from and roughly which country they&apos;re in. Some of this is linked to your account or browser id. We keep your IP address and browser details with these records, and our web server logs requests.</p>
        <p><strong className={strong}>What you send us.</strong> Feedback and reports, with the name you used, your IP address and browser details. If you sign up to test an app or hear about one, your e-mail address.</p>
        <p><strong className={strong}>In your browser.</strong> Your language, settings and recent parties stay on your device.</p>
      </section>

      <section className="space-y-3">
        <h2 className={heading}>Why we use it</h2>
        <ul className={list}>
          <li><strong className={strong}>To give you what you ask for</strong> (Art. 6(1)(b) GDPR): accounts, parties, scores, recordings and sharing.</li>
          <li><strong className={strong}>Our legitimate interests</strong> (Art. 6(1)(f) GDPR): keeping the site running and safe, stopping abuse, seeing how it&apos;s used, and improving scoring.</li>
          <li><strong className={strong}>Your consent</strong> (Art. 6(1)(a) GDPR): optional things you turn on yourself, such as the camera, Google sign-in and app sign-up lists. You can withdraw it at any time.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={heading}>Who else gets data</h2>
        <ul className={list}>
          <li><strong className={strong}>Other people in your party</strong> see your display name, picture and score.</li>
          <li><strong className={strong}>Cloudflare</strong> delivers and protects all traffic, sees your IP address and can relay voices.</li>
          <li>
            <strong className={strong}>Google:</strong> SingSpree uses YouTube API Services for its videos and thumbnails, so Google receives your IP address, and the player keeps some data in your browser&apos;s storage. Google also handles Google sign-in and our Android test list.{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className={link}>Google&apos;s Privacy Policy</a> applies, and by using SingSpree you also agree to the{" "}
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className={link}>YouTube Terms of Service</a>.
          </li>
          <li><strong className={strong}>Resend</strong> delivers our e-mails.</li>
          <li><strong className={strong}>Modal</strong> runs our AI when a chart is made. <strong className={strong}>Last.fm</strong> and <strong className={strong}>SponsorBlock</strong> help with similar songs and skipping non-music parts. These three get song details, nothing about you.</li>
        </ul>
        <p>Some of these companies are outside the EU, mainly in the USA, so your data can be processed there.</p>
      </section>

      <section className="space-y-3">
        <h2 className={heading}>Cookies</h2>
        <p>We set only the cookies the site needs: one tells us which party your browser belongs to, one keeps you signed in, and a short-lived one completes Google sign-in. Your settings are kept in your browser&apos;s local storage, and the embedded YouTube player keeps some data there too. Sometimes, for example when YouTube&apos;s player can&apos;t load through us, YouTube can also set its own cookies.</p>
      </section>

      <section className="space-y-3">
        <h2 className={heading}>How long we keep it</h2>
        <ul className={list}>
          <li><strong className={strong}>Your account, scores, pitch data and recordings:</strong> until you delete them or your account. When you delete your account it&apos;s hidden from everyone at once, and you can sign in within 14 days to keep it. After that, everything we hold about you is deleted, including what you did as a guest in a browser you signed in on.</li>
          <li><strong className={strong}>A guest&apos;s recordings:</strong> 30 days, unless you sign in on that browser first.</li>
          <li><strong className={strong}>A guest&apos;s scores:</strong> under the browser id, so a later account can take them over.</li>
          <li><strong className={strong}>Mixed recordings and share videos:</strong> until they haven&apos;t been used for 7 days, or the recording is deleted.</li>
          <li><strong className={strong}>Usage records:</strong> as long as we need them to run and protect the site and understand how it&apos;s used, or until you delete your account.</li>
          <li><strong className={strong}>Server logs and backups:</strong> these age out by themselves.</li>
          <li><strong className={strong}>App sign-up addresses:</strong> until the test is over or the announcement has gone out.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className={heading}>Your rights</h2>
        <p>
          If you&apos;re in the European Economic Area, you can ask us for a copy of your data, and to correct it, delete it, restrict or object to how we use it, or hand it over in a common machine-readable format. You can withdraw any consent, and you can complain to your data protection authority. To do any of this, write to us through the{" "}
          <a href="/contact" className={link}>Contact page</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className={heading}>Changes</h2>
        <p>When what we do changes, we update this page and its date.</p>
      </section>
    </div>
  </>
);

export default PrivacyPolicyContent;
