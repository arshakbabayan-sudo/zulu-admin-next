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
  formPane: "flex items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:px-12",
  contentWidth: "w-full max-w-[480px] rounded-[14px] bg-white px-5 py-8 sm:px-10 sm:py-10",
  headingBlock: "mb-8 text-center",
  // Primary heading — login. Bold, dark, large.
  headingTitle: "text-[30px] leading-10 sm:text-5xl sm:leading-[56px] font-bold text-fg-t11 mb-2",
  // Secondary heading — recovery screens (forgot/reset password, 2FA). Smaller
  // to signal "mid-flow" vs top-level entry.
  headingTitleSecondary: "text-[24px] leading-8 sm:text-[32px] sm:leading-10 font-bold text-fg-t11 mb-2",
  headingSubtitle: "text-fg-t6 text-base",
  formStack: "space-y-5",
  fieldStack: "space-y-1.5",
  fieldLabel: "block px-2 text-xs font-medium text-fg-t7",
  inputBase: "h-12 w-full rounded-full border border-default bg-white px-4 text-sm text-fg-t11 placeholder:text-fg-t6 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors",
  inputWithIcon: "h-12 w-full rounded-full border border-default bg-white px-4 pr-12 text-sm text-fg-t11 placeholder:text-fg-t6 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30 transition-colors",
  primaryButton:
    "w-full h-12 rounded-full bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white font-medium text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
  alertBox: "mb-5 rounded-xl border border-error-200 bg-error-50 px-4 py-3",
  alertText: "text-sm text-error-700",
  iconToggle: "absolute right-4 top-1/2 -translate-y-1/2 text-fg-t6 hover:text-fg-t7 transition-colors",
  linkPrimary: "font-semibold text-primary-500 hover:text-primary-700 transition-colors",
};
