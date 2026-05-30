/**
 * Right-side visual pane for admin auth pages.
 *
 * Direct port of `zulu-frontend-next/components/auth/AuthVisualPane.tsx` so
 * the admin (Operations console) login / 2FA / forgot-password screens render
 * the same ZULU-purple field + emblem watermark as the customer site. Asset
 * already exists at `/brand/zulu-emblem.svg` in admin's public folder.
 *
 * Figma Zulu_2 (file lCwRIXoOYmjiTPSlAckEhW): each auth screen is 1440×960,
 * with a left 720-pane form area and a right 720-pane visual area. The visual
 * is a solid ZULU-purple field overlaid with the ZULU emblem (two concentric
 * circles) sized 650×650 and offset so it peeks past the top-right corner.
 *
 * Only renders at lg+ (the form pane fills the full viewport on smaller
 * screens).
 */
export function AuthVisualPane() {
  return (
    <aside
      className="relative hidden lg:flex bg-primary-500 overflow-hidden"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative emblem, optimization not worth the extra Next/Image complexity here */}
      <img
        src="/brand/zulu-emblem.svg"
        alt=""
        className="absolute pointer-events-none select-none"
        style={{
          left: "45.42%",
          top: "-89px",
          width: "650px",
          height: "650px",
          filter: "brightness(0) invert(1)",
          opacity: 0.22,
        }}
      />
    </aside>
  );
}
