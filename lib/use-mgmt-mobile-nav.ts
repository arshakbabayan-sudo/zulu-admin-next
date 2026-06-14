"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Mobile-aware nav state for the `.mgmt-page` shells (Dashboard / CRM / Settings /
 * Management). Ports the dashboard.html / settings.html mobile JS:
 *  - desktop (>768px): the hamburger collapses the sidebar to the 64px icon rail.
 *  - mobile (≤768px): the sidebar is off-canvas (CSS); the hamburger slides it in
 *    over a backdrop via `.nav-open` and locks page scroll (`body.nav-locked`).
 * A resize listener strips the stray breakpoint class when crossing 768px so a
 * class set on one side doesn't leak to the other.
 *
 * Usage:
 *   const { sidebarCollapsed, onHamburger, closeNav, layoutClass } = useMgmtMobileNav();
 *   <div className={layoutClass}>
 *     <Sidebar collapsed={sidebarCollapsed} … />
 *     <div className="nav-overlay" onClick={closeNav} />
 *     <div className="main"><Header onHamburger={onHamburger} … /> … </div>
 *   </div>
 */
export function useMgmtMobileNav() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const isMobile = () =>
    typeof window !== "undefined" && window.matchMedia("(max-width:768px)").matches;

  const closeNav = useCallback(() => {
    setNavOpen(false);
    if (typeof document !== "undefined") document.body.classList.remove("nav-locked");
  }, []);

  const onHamburger = useCallback(() => {
    if (isMobile()) {
      setSidebarCollapsed(false);
      setNavOpen((open) => {
        const next = !open;
        document.body.classList.toggle("nav-locked", next);
        return next;
      });
    } else {
      setSidebarCollapsed((v) => !v);
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (isMobile()) {
        setSidebarCollapsed(false);
      } else {
        setNavOpen(false);
        document.body.classList.remove("nav-locked");
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (typeof document !== "undefined") document.body.classList.remove("nav-locked");
    };
  }, []);

  const layoutClass = `layout${sidebarCollapsed ? " sidebar-collapsed" : ""}${navOpen ? " nav-open" : ""}`;

  return { sidebarCollapsed, navOpen, onHamburger, closeNav, layoutClass };
}
