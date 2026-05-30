/**
 * Auth-page shared style tokens for the admin app.
 *
 * Mirrors `zulu-frontend-next/components/auth/authPageStyles.ts` so that the
 * Operations console auth screens (login, forgot/reset password, 2FA) use the
 * same Figma layout — two-pane gradient with the ZULU emblem on the right —
 * as the customer site. Arshak's product directive 2026-05-31: «admin.zulu.am
 * մտնելուց էլ այս էջերը լինեն» (Figma Zulu_2 file lCwRIXoOYmjiTPSlAckEhW).
 *
 * Token references resolve through admin's tailwind config (figma-bg-1,
 * border-default, fg-tN, primary-NNN) — same names as the customer app, so
 * the class strings work verbatim without recoloring.
 */
export const AUTH_PAGE_STYLES = {
  pageShell: "min-h-screen bg-home-band-md lg:grid lg:grid-cols-2",
  formPane: "flex items-center justify-center px-4 py-6 sm:px-8 sm:py-8 lg:px-10",
  contentWidth: "w-full max-w-[420px] rounded-[14px] bg-white px-5 py-7 sm:px-8 sm:py-9",
  headingBlock: "mb-6 text-center",
  // Admin headings deliberately smaller than the customer site's: text is
  // longer ("Admin sign in" vs "Log in", "Password reset" vs "Reset", etc.)
  // and Operations console is a utility tool — Arshak feedback 2026-05-31:
  // «ֆոնտերը մեծ ես արել, համապատասխանեցրու չափերը»։
  headingTitle: "text-[22px] leading-7 sm:text-[28px] sm:leading-9 font-bold text-fg-t11 mb-1.5",
  headingTitleSecondary: "text-[20px] leading-7 sm:text-[24px] sm:leading-8 font-bold text-fg-t11 mb-1.5",
  headingSubtitle: "text-fg-t6 text-sm",
  formStack: "space-y-4",
  fieldStack: "space-y-1.5",
  fieldLabel: "block px-2 text-xs font-medium text-fg-t7",
  inputBase: "h-11 w-full rounded-full border border-default bg-white px-4 text-sm text-fg-t11 placeholder:text-fg-t6 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors",
  inputWithIcon: "h-11 w-full rounded-full border border-default bg-white px-4 pr-12 text-sm text-fg-t11 placeholder:text-fg-t6 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors",
  primaryButton:
    "w-full h-11 rounded-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
  alertBox: "mb-5 rounded-xl border border-error-200 bg-error-50 px-4 py-3",
  alertText: "text-sm text-error-700",
  iconToggle: "absolute right-4 top-1/2 -translate-y-1/2 text-fg-t6 hover:text-fg-t7 transition-colors",
  linkPrimary: "font-semibold text-primary-500 hover:text-primary-700 transition-colors",
};
