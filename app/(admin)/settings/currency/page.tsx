"use client";

/**
 * /settings/currency — B2b (2026-06-21).
 *
 * Seller FX-rate settings (operator bank rate + absolute margin), rendered in
 * the unified Settings surface with the "Currency / FX rate" pane active. Same
 * form for every role, wired to different backend endpoints by role inside
 * SellerFxPane (super → platform-admin; operator/agent → operator-self). 1:1
 * with settings/exchange-rates/page.tsx.
 */
import { SettingsPage } from "../SettingsPage";

export default function CurrencyFxSettingsPage() {
  return <SettingsPage initialPage="seller-fx" />;
}
