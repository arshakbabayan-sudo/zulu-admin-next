"use client";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ApiRequestError } from "@/lib/api-client";
import {
  apiUploadAdminPageImage,
  type AdminWidgetContentRow,
} from "@/lib/pages-api";
import { useEffect, useState } from "react";

type Props = {
  widget: AdminWidgetContentRow;
  activeLanguage?: string;
  saving?: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
};

type SearchOptions = {
  flights: boolean;
  hotels: boolean;
  cars: boolean;
  transfers: boolean;
  excursions: boolean;
  packages: boolean;
};

type SlideItem = {
  title: string;
  description: string;
  button_text: string;
  button_url: string;
  img: string;
  location: string;
  rating: number;
};

type AboutTabItem = {
  tab_name: string;
  tab_icon: string;
  tab_description: string;
};

type AboutUsContent = {
  widget_title: string;
  main_title: string;
  description: string;
  about_image: string;
  customer_count: number;
  button_text: string;
  button_url: string;
  tabs: AboutTabItem[];
};

type FeatureItem = {
  icon: string;
  title: string;
  description: string;
};

type FunFactItem = {
  icon: string;
  number: string;
  label: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type TestimonialItem = {
  author_name: string;
  profile_image: string;
  rating: number;
  review_text: string;
  date: string;
};

type LatestContent = {
  widget_title: string;
  show_count: number;
  category_filter: string;
};

type ContactUsContent = {
  widget_title: string;
  address: string;
  map_embed_url: string;
  phones: string[];
  emails: string[];
};

type CtaContent = {
  title: string;
  subtitle: string;
  button_text: string;
  button_url: string;
  background_image: string;
};

type HomeHeroContent = {
  headline: string;
  subheadline: string;
  background_image: string;
  button_text: string;
  button_url: string;
};

type HomeSpecialOfferItem = {
  image: string;
  title: string;
  price: string;
  link: string;
};

type HomeSpecialOffersContent = {
  section_title: string;
  section_subtitle: string;
  items: HomeSpecialOfferItem[];
};

type HomePopularDestinationItem = {
  image: string;
  title: string;
  label: string;
  link: string;
};

type HomePopularDestinationsContent = {
  section_title: string;
  items: HomePopularDestinationItem[];
};

type HomePartnerItem = {
  logo_image: string;
  partner_name: string;
  link: string;
};

type HomePartnersContent = {
  items: HomePartnerItem[];
};

type HomeNewsletterContent = {
  title: string;
  subtitle: string;
  bg_image: string;
  button_text: string;
};

const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  flights: true,
  hotels: true,
  cars: true,
  transfers: true,
  excursions: true,
  packages: true,
};

const DEFAULT_SLIDE: SlideItem = {
  title: "",
  description: "",
  button_text: "",
  button_url: "",
  img: "",
  location: "",
  rating: 5,
};

const DEFAULT_ABOUT_TAB: AboutTabItem = {
  tab_name: "",
  tab_icon: "",
  tab_description: "",
};

const DEFAULT_ABOUT_US: AboutUsContent = {
  widget_title: "",
  main_title: "",
  description: "",
  about_image: "",
  customer_count: 0,
  button_text: "",
  button_url: "",
  tabs: [],
};

const DEFAULT_FEATURE_ITEM: FeatureItem = { icon: "", title: "", description: "" };
const DEFAULT_FUN_FACT_ITEM: FunFactItem = { icon: "", number: "", label: "" };
const DEFAULT_FAQ_ITEM: FaqItem = { question: "", answer: "" };
const DEFAULT_TESTIMONIAL_ITEM: TestimonialItem = {
  author_name: "",
  profile_image: "",
  rating: 5,
  review_text: "",
  date: "",
};
const DEFAULT_LATEST_CONTENT: LatestContent = {
  widget_title: "",
  show_count: 6,
  category_filter: "",
};
const DEFAULT_CONTACT_US: ContactUsContent = {
  widget_title: "",
  address: "",
  map_embed_url: "",
  phones: [],
  emails: [],
};
const DEFAULT_CTA: CtaContent = {
  title: "",
  subtitle: "",
  button_text: "",
  button_url: "",
  background_image: "",
};

const DEFAULT_HOME_HERO: HomeHeroContent = {
  headline: "",
  subheadline: "",
  background_image: "",
  button_text: "",
  button_url: "",
};

const DEFAULT_HOME_SPECIAL_OFFER_ITEM: HomeSpecialOfferItem = {
  image: "",
  title: "",
  price: "",
  link: "",
};

const DEFAULT_HOME_SPECIAL_OFFERS: HomeSpecialOffersContent = {
  section_title: "",
  section_subtitle: "",
  items: [],
};

const DEFAULT_HOME_POPULAR_DESTINATION_ITEM: HomePopularDestinationItem = {
  image: "",
  title: "",
  label: "",
  link: "",
};

const DEFAULT_HOME_POPULAR_DESTINATIONS: HomePopularDestinationsContent = {
  section_title: "",
  items: [],
};

const DEFAULT_HOME_PARTNER_ITEM: HomePartnerItem = {
  logo_image: "",
  partner_name: "",
  link: "",
};

const DEFAULT_HOME_PARTNERS: HomePartnersContent = {
  items: [],
};

const DEFAULT_HOME_NEWSLETTER: HomeNewsletterContent = {
  title: "",
  subtitle: "",
  bg_image: "",
  button_text: "",
};

function normalizeObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function normalizeBoolean(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function normalizeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalizeRating(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function normalizeCount(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function extractFileName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

async function uploadWidgetImage(token: string | null, file: File): Promise<string> {
  if (!token) {
    // Helper function (not a React component) — keep an English fallback.
    // Callers display localized messages via their own useLanguage scope.
    throw new Error("Missing auth token");
  }
  const res = await apiUploadAdminPageImage(token, file);
  return extractFileName(res.data.path ?? "");
}

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const fieldErrors = error.body?.errors;
    if (fieldErrors) {
      const firstField = Object.keys(fieldErrors)[0];
      const firstFieldError = firstField ? fieldErrors[firstField]?.[0] : null;
      if (firstFieldError) {
        return `${firstField}: ${firstFieldError}`;
      }
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  // Helper function (not a React component) — English fallback.
  return "Image upload failed";
}

function normalizeSlides(v: unknown): SlideItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => normalizeObject(item))
    .map((item): SlideItem => ({
      title: normalizeString(item.title),
      description: normalizeString(item.description),
      button_text: normalizeString(item.button_text),
      button_url: normalizeString(item.button_url),
      img: normalizeString(item.img),
      location: normalizeString(item.location),
      rating: normalizeRating(item.rating),
    }));
}

function normalizeAboutTabs(v: unknown): AboutTabItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => normalizeObject(item))
    .map((item): AboutTabItem => ({
      tab_name: normalizeString(item.tab_name),
      tab_icon: normalizeString(item.tab_icon),
      tab_description: normalizeString(item.tab_description),
    }));
}

function normalizeAboutUs(v: unknown): AboutUsContent {
  const obj = normalizeObject(v);
  return {
    widget_title: normalizeString(obj.widget_title),
    main_title: normalizeString(obj.main_title),
    description: normalizeString(obj.description),
    about_image: normalizeString(obj.about_image),
    customer_count: normalizeCount(obj.customer_count),
    button_text: normalizeString(obj.button_text),
    button_url: normalizeString(obj.button_url),
    tabs: normalizeAboutTabs(obj.tabs),
  };
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => normalizeString(x)).filter((x) => x !== "");
}

function normalizeFeatureItems(v: unknown): FeatureItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => normalizeObject(item)).map((item) => ({
    icon: normalizeString(item.icon),
    title: normalizeString(item.title),
    description: normalizeString(item.description),
  }));
}

function normalizeFunFactItems(v: unknown): FunFactItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => normalizeObject(item)).map((item) => ({
    icon: normalizeString(item.icon),
    number: normalizeString(item.number),
    label: normalizeString(item.label),
  }));
}

function normalizeFaqItems(v: unknown): FaqItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => normalizeObject(item)).map((item) => ({
    question: normalizeString(item.question),
    answer: normalizeString(item.answer),
  }));
}

function normalizeTestimonialItems(v: unknown): TestimonialItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => normalizeObject(item)).map((item) => ({
    author_name: normalizeString(item.author_name),
    profile_image: normalizeString(item.profile_image),
    rating: normalizeRating(item.rating),
    review_text: normalizeString(item.review_text),
    date: normalizeString(item.date),
  }));
}

function normalizeLatest(v: unknown): LatestContent {
  const obj = normalizeObject(v);
  return {
    widget_title: normalizeString(obj.widget_title),
    show_count: Math.max(1, normalizeCount(obj.show_count || 6)),
    category_filter: normalizeString(obj.category_filter),
  };
}

function normalizeContactUs(v: unknown): ContactUsContent {
  const obj = normalizeObject(v);
  return {
    widget_title: normalizeString(obj.widget_title),
    address: normalizeString(obj.address),
    map_embed_url: normalizeString(obj.map_embed_url),
    phones: normalizeStringArray(obj.phones),
    emails: normalizeStringArray(obj.emails),
  };
}

function normalizeCta(v: unknown): CtaContent {
  const obj = normalizeObject(v);
  return {
    title: normalizeString(obj.title),
    subtitle: normalizeString(obj.subtitle),
    button_text: normalizeString(obj.button_text),
    button_url: normalizeString(obj.button_url),
    background_image: normalizeString(obj.background_image),
  };
}

function normalizeHomeSpecialOfferItems(v: unknown): HomeSpecialOfferItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => normalizeObject(item)).map((item) => ({
    image: normalizeString(item.image),
    title: normalizeString(item.title),
    price: normalizeString(item.price),
    link: normalizeString(item.link),
  }));
}

function normalizeHomeSpecialOffers(v: unknown): HomeSpecialOffersContent {
  const obj = normalizeObject(v);
  return {
    section_title: normalizeString(obj.section_title),
    section_subtitle: normalizeString(obj.section_subtitle),
    items: normalizeHomeSpecialOfferItems(obj.items),
  };
}

function normalizeHomeHero(v: unknown): HomeHeroContent {
  const obj = normalizeObject(v);
  return {
    headline: normalizeString(obj.headline),
    subheadline: normalizeString(obj.subheadline),
    background_image: normalizeString(obj.background_image),
    button_text: normalizeString(obj.button_text),
    button_url: normalizeString(obj.button_url),
  };
}

function normalizeHomePopularDestinationItems(v: unknown): HomePopularDestinationItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => normalizeObject(item)).map((item) => ({
    image: normalizeString(item.image),
    title: normalizeString(item.title),
    label: normalizeString(item.label),
    link: normalizeString(item.link),
  }));
}

function normalizeHomePopularDestinations(v: unknown): HomePopularDestinationsContent {
  const obj = normalizeObject(v);
  return {
    section_title: normalizeString(obj.section_title),
    items: normalizeHomePopularDestinationItems(obj.items),
  };
}

function normalizeHomePartnerItems(v: unknown): HomePartnerItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => normalizeObject(item)).map((item) => ({
    logo_image: normalizeString(item.logo_image),
    partner_name: normalizeString(item.partner_name),
    link: normalizeString(item.link),
  }));
}

function normalizeHomePartners(v: unknown): HomePartnersContent {
  const obj = normalizeObject(v);
  return {
    items: normalizeHomePartnerItems(obj.items),
  };
}

function normalizeHomeNewsletter(v: unknown): HomeNewsletterContent {
  const obj = normalizeObject(v);
  return {
    title: normalizeString(obj.title),
    subtitle: normalizeString(obj.subtitle),
    bg_image: normalizeString(obj.bg_image),
    button_text: normalizeString(obj.button_text),
  };
}

function SliderWidgetForm({
  slides,
  saving,
  onSlidesChange,
  onSave,
}: {
  slides: SlideItem[];
  saving: boolean;
  onSlidesChange: (slides: SlideItem[]) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  function updateSlide(index: number, patch: Partial<SlideItem>) {
    onSlidesChange(
      slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide))
    );
  }

  function addSlide() {
    onSlidesChange([...slides, { ...DEFAULT_SLIDE }]);
  }

  function removeSlide(index: number) {
    onSlidesChange(slides.filter((_, i) => i !== index));
  }

  async function uploadImage(index: number, file: File) {
    if (!token) {
      setUploadErr(t("admin.widget_form.missing_auth_token"));
      return;
    }
    setUploadErr(null);
    setUploadingIndex(index);
    try {
      const res = await apiUploadAdminPageImage(token, file);
      const fileName = extractFileName(res.data.path ?? "");
      updateSlide(index, { img: fileName });
    } catch (e) {
      setUploadErr(uploadErrorMessage(e));
    } finally {
      setUploadingIndex(null);
    }
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-t7">{t("admin.widget_form.hero_slides")}</p>
        <button
          type="button"
          onClick={addSlide}
          className="rounded border border-default bg-white px-2.5 py-1 text-xs"
        >
          {t("admin.widget_form.add_new_slide")}
        </button>
      </div>

      {uploadErr ? <p className="mt-2 text-xs text-error-600">{uploadErr}</p> : null}

      <div className="mt-3 space-y-3">
        {slides.length === 0 ? (
          <p className="rounded border border-dashed border-default px-3 py-4 text-center text-xs text-fg-t6">
            {t("admin.widget_form.no_slides")}
          </p>
        ) : (
          slides.map((slide, index) => (
            <div key={`slide-${index}`} className="rounded border border-default bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-fg-t11">{`${t("admin.widget_form.slide")} #${index + 1}`}</p>
                <button
                  type="button"
                  onClick={() => removeSlide(index)}
                  className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700"
                >
                  {t("admin.widget_form.remove_slide")}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <label className="text-xs text-fg-t7">
                  {t("admin.widget_form.title")}
                  <input
                    value={slide.title}
                    onChange={(e) => updateSlide(index, { title: e.target.value })}
                    className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-fg-t7">
                  {t("admin.widget_form.location")}
                  <input
                    value={slide.location}
                    onChange={(e) => updateSlide(index, { location: e.target.value })}
                    placeholder={t("admin.widget_form.location_placeholder")}
                    className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-fg-t7">
                  {t("admin.widget_form.button_text")}
                  <input
                    value={slide.button_text}
                    onChange={(e) => updateSlide(index, { button_text: e.target.value })}
                    className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-fg-t7">
                  {t("admin.widget_form.button_url")}
                  <input
                    value={slide.button_url}
                    onChange={(e) => updateSlide(index, { button_url: e.target.value })}
                    className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-fg-t7">
                  {t("admin.widget_form.rating")}
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={slide.rating}
                    onChange={(e) =>
                      updateSlide(index, { rating: normalizeRating(e.target.value) })
                    }
                    className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-fg-t7">
                  {t("admin.widget_form.background_image")}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      void uploadImage(index, file);
                      e.currentTarget.value = "";
                    }}
                    className="mt-1 block w-full text-xs"
                  />
                  {uploadingIndex === index ? (
                    <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span>
                  ) : null}
                  {slide.img ? (
                    <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {slide.img}</span>
                  ) : null}
                </label>
              </div>

              <label className="mt-2 block text-xs text-fg-t7">
                {t("admin.widget_form.description")}
                <textarea
                  value={slide.description}
                  onChange={(e) => updateSlide(index, { description: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}
        </button>
      </div>
    </div>
  );
}

function SwitchField({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  const { t } = useLanguage();
  return (
    <label className="flex items-center justify-between gap-3 rounded border border-default bg-white px-3 py-2 text-sm text-fg-t7">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-violet-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function SearchWidgetForm({
  searchOptions,
  saving,
  onSearchOptionsChange,
  onSave,
}: {
  searchOptions: SearchOptions;
  saving: boolean;
  onSearchOptionsChange: (options: SearchOptions) => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useLanguage();

  function setOption(key: keyof SearchOptions, value: boolean) {
    onSearchOptionsChange({ ...searchOptions, [key]: value });
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <p className="text-xs font-medium text-fg-t7">{t("admin.widget_form.search_modules")}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <SwitchField
          checked={searchOptions.flights}
          onChange={(v) => setOption("flights", v)}
          label={t("admin.widget_form.enable_flight_search")}
        />
        <SwitchField
          checked={searchOptions.hotels}
          onChange={(v) => setOption("hotels", v)}
          label={t("admin.widget_form.enable_hotel_search")}
        />
        <SwitchField
          checked={searchOptions.cars}
          onChange={(v) => setOption("cars", v)}
          label={t("admin.widget_form.enable_car_search")}
        />
        <SwitchField
          checked={searchOptions.excursions}
          onChange={(v) => setOption("excursions", v)}
          label={t("admin.widget_form.enable_excursion_search")}
        />
        <SwitchField
          checked={searchOptions.transfers}
          onChange={(v) => setOption("transfers", v)}
          label={t("admin.widget_form.enable_transfer_search")}
        />
        <SwitchField
          checked={searchOptions.packages}
          onChange={(v) => setOption("packages", v)}
          label={t("admin.widget_form.enable_package_search")}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}
        </button>
      </div>
    </div>
  );
}

function AboutUsWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: AboutUsContent;
  saving: boolean;
  onChange: (next: AboutUsContent) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  function patch(p: Partial<AboutUsContent>) {
    onChange({ ...value, ...p });
  }

  function updateTab(index: number, tabPatch: Partial<AboutTabItem>) {
    const nextTabs = value.tabs.map((tab, i) =>
      i === index ? { ...tab, ...tabPatch } : tab
    );
    patch({ tabs: nextTabs });
  }

  function addTab() {
    patch({ tabs: [...value.tabs, { ...DEFAULT_ABOUT_TAB }] });
  }

  function removeTab(index: number) {
    patch({ tabs: value.tabs.filter((_, i) => i !== index) });
  }

  async function uploadAboutImage(file: File) {
    if (!token) {
      setUploadErr(t("admin.widget_form.missing_auth_token"));
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      const res = await apiUploadAdminPageImage(token, file);
      const fileName = extractFileName(res.data.path ?? "");
      patch({ about_image: fileName });
    } catch (e) {
      setUploadErr(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-xs text-fg-t7">
          {t("admin.widget_form.widget_title")}
          <input
            value={value.widget_title}
            onChange={(e) => patch({ widget_title: e.target.value })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t7">
          {t("admin.widget_form.main_title")}
          <input
            value={value.main_title}
            onChange={(e) => patch({ main_title: e.target.value })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t7">
          {t("admin.widget_form.customer_count")}
          <input
            type="number"
            min={0}
            value={value.customer_count}
            onChange={(e) => patch({ customer_count: normalizeCount(e.target.value) })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t7">
          {t("admin.widget_form.about_image")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void uploadAboutImage(file);
              e.currentTarget.value = "";
            }}
            className="mt-1 block w-full text-xs"
          />
          {uploading ? <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span> : null}
          {value.about_image ? (
            <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {value.about_image}</span>
          ) : null}
          {uploadErr ? <span className="mt-1 block text-xs text-error-600">{uploadErr}</span> : null}
        </label>
        <label className="text-xs text-fg-t7">
          {t("admin.widget_form.button_text")}
          <input
            value={value.button_text}
            onChange={(e) => patch({ button_text: e.target.value })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-fg-t7">
          {t("admin.widget_form.button_url")}
          <input
            value={value.button_url}
            onChange={(e) => patch({ button_url: e.target.value })}
            className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <label className="mt-2 block text-xs text-fg-t7">
        {t("admin.widget_form.description")}
        <textarea
          value={value.description}
          onChange={(e) => patch({ description: e.target.value })}
          rows={4}
          className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
        />
      </label>

      <div className="mt-3 rounded border border-default bg-white p-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-fg-t11">{t("admin.widget_form.tabs")}</p>
          <button
            type="button"
            onClick={addTab}
            className="rounded border border-default bg-white px-2.5 py-1 text-xs"
          >
            Add Tab
          </button>
        </div>

        <div className="mt-2 space-y-2">
          {value.tabs.length === 0 ? (
            <p className="text-xs text-fg-t6">{t("admin.widget_form.no_tabs")}</p>
          ) : (
            value.tabs.map((tab, index) => (
              <div key={`about-tab-${index}`} className="rounded border border-default p-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-fg-t7">{`${t("admin.widget_form.tab")} #${index + 1}`}</p>
                  <button
                    type="button"
                    onClick={() => removeTab(index)}
                    className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <label className="text-xs text-fg-t7">
                    {t("admin.widget_form.tab_name")}
                    <input
                      value={tab.tab_name}
                      onChange={(e) => updateTab(index, { tab_name: e.target.value })}
                      className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-fg-t7">
                    {t("admin.widget_form.tab_icon")}
                    <input
                      value={tab.tab_icon}
                      onChange={(e) => updateTab(index, { tab_icon: e.target.value })}
                      className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                <label className="mt-2 block text-xs text-fg-t7">
                  {t("admin.widget_form.tab_description")}
                  <textarea
                    value={tab.tab_description}
                    onChange={(e) =>
                      updateTab(index, { tab_description: e.target.value })
                    }
                    rows={3}
                    className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}
        </button>
      </div>
    </div>
  );
}

function FeaturesWidgetForm({
  title,
  items,
  saving,
  onItemsChange,
  onSave,
}: {
  title: string;
  items: FeatureItem[];
  saving: boolean;
  onItemsChange: (items: FeatureItem[]) => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useLanguage();
  function updateItem(index: number, patch: Partial<FeatureItem>) {
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-t7">{title}</p>
        <button type="button" onClick={() => onItemsChange([...items, { ...DEFAULT_FEATURE_ITEM }])} className="rounded border border-default bg-white px-2.5 py-1 text-xs">
          Add
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={`feature-${index}`} className="rounded border border-default bg-white p-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="text-xs text-fg-t7">{t("admin.widget_form.icon")}
                <input value={item.icon} onChange={(e) => updateItem(index, { icon: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.title")}
                <input value={item.title} onChange={(e) => updateItem(index, { title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
            </div>
            <label className="mt-2 block text-xs text-fg-t7">{t("admin.widget_form.description")}
              <textarea value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} rows={3} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
            </label>
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={() => onItemsChange(items.filter((_, i) => i !== index))} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button>
      </div>
    </div>
  );
}

function FunFactsWidgetForm({
  items,
  saving,
  onItemsChange,
  onSave,
}: {
  items: FunFactItem[];
  saving: boolean;
  onItemsChange: (items: FunFactItem[]) => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useLanguage();
  function updateItem(index: number, patch: Partial<FunFactItem>) {
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-t7">{t("admin.widget_form.fun_facts")}</p>
        <button type="button" onClick={() => onItemsChange([...items, { ...DEFAULT_FUN_FACT_ITEM }])} className="rounded border border-default bg-white px-2.5 py-1 text-xs">{t("common.add")}</button>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={`fun-${index}`} className="rounded border border-default bg-white p-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <label className="text-xs text-fg-t7">{t("admin.widget_form.icon")}
                <input value={item.icon} onChange={(e) => updateItem(index, { icon: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.number")}
                <input value={item.number} onChange={(e) => updateItem(index, { number: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.label")}
                <input value={item.label} onChange={(e) => updateItem(index, { label: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
            </div>
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={() => onItemsChange(items.filter((_, i) => i !== index))} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function FaqWidgetForm({
  items,
  saving,
  onItemsChange,
  onSave,
}: {
  items: FaqItem[];
  saving: boolean;
  onItemsChange: (items: FaqItem[]) => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useLanguage();
  function updateItem(index: number, patch: Partial<FaqItem>) {
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-t7">{t("admin.widget_form.faq")}</p>
        <button type="button" onClick={() => onItemsChange([...items, { ...DEFAULT_FAQ_ITEM }])} className="rounded border border-default bg-white px-2.5 py-1 text-xs">{t("common.add")}</button>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={`faq-${index}`} className="rounded border border-default bg-white p-2">
            <label className="block text-xs text-fg-t7">{t("admin.widget_form.question")}
              <input value={item.question} onChange={(e) => updateItem(index, { question: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
            </label>
            <label className="mt-2 block text-xs text-fg-t7">{t("admin.widget_form.answer")}
              <textarea value={item.answer} onChange={(e) => updateItem(index, { answer: e.target.value })} rows={3} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
            </label>
            <div className="mt-2 flex justify-end"><button type="button" onClick={() => onItemsChange(items.filter((_, i) => i !== index))} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function TestimonialsWidgetForm({
  items,
  saving,
  onItemsChange,
  onSave,
}: {
  items: TestimonialItem[];
  saving: boolean;
  onItemsChange: (items: TestimonialItem[]) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  function updateItem(index: number, patch: Partial<TestimonialItem>) {
    onItemsChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function uploadProfileImage(index: number, file: File) {
    if (!token) return;
    setUploadingIndex(index);
    try {
      const res = await apiUploadAdminPageImage(token, file);
      updateItem(index, { profile_image: extractFileName(res.data.path ?? "") });
    } finally {
      setUploadingIndex(null);
    }
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-t7">{t("admin.widget_form.testimonials")}</p>
        <button type="button" onClick={() => onItemsChange([...items, { ...DEFAULT_TESTIMONIAL_ITEM }])} className="rounded border border-default bg-white px-2.5 py-1 text-xs">{t("common.add")}</button>
      </div>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={`testimonial-${index}`} className="rounded border border-default bg-white p-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="text-xs text-fg-t7">{t("admin.widget_form.author_name")}
                <input value={item.author_name} onChange={(e) => updateItem(index, { author_name: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.date")}
                <input value={item.date} onChange={(e) => updateItem(index, { date: e.target.value })} placeholder={t("admin.widget_form.date_placeholder")} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.rating")}
                <input type="number" min={1} max={5} value={item.rating} onChange={(e) => updateItem(index, { rating: normalizeRating(e.target.value) })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.profile_image")}
                <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void uploadProfileImage(index, file); e.currentTarget.value = ""; }} className="mt-1 block w-full text-xs" />
                {uploadingIndex === index ? <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span> : null}
                {item.profile_image ? <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {item.profile_image}</span> : null}
              </label>
            </div>
            <label className="mt-2 block text-xs text-fg-t7">{t("admin.widget_form.review_text")}
              <textarea value={item.review_text} onChange={(e) => updateItem(index, { review_text: e.target.value })} rows={3} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
            </label>
            <div className="mt-2 flex justify-end"><button type="button" onClick={() => onItemsChange(items.filter((_, i) => i !== index))} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function LatestOffersWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: LatestContent;
  saving: boolean;
  onChange: (next: LatestContent) => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useLanguage();
  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <label className="text-xs text-fg-t7">{t("admin.widget_form.widget_title")}
          <input value={value.widget_title} onChange={(e) => onChange({ ...value, widget_title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.show_count")}
          <input type="number" min={1} value={value.show_count} onChange={(e) => onChange({ ...value, show_count: Math.max(1, normalizeCount(e.target.value)) })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.filter_by_category")}
          <input value={value.category_filter} onChange={(e) => onChange({ ...value, category_filter: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function ContactUsWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: ContactUsContent;
  saving: boolean;
  onChange: (next: ContactUsContent) => void;
  onSave: () => Promise<void>;
}) {
  const { t } = useLanguage();
  function patch(p: Partial<ContactUsContent>) {
    onChange({ ...value, ...p });
  }
  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-xs text-fg-t7">{t("admin.widget_form.widget_title")}
          <input value={value.widget_title} onChange={(e) => patch({ widget_title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.map_embed_url")}
          <input value={value.map_embed_url} onChange={(e) => patch({ map_embed_url: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
      </div>
      <label className="mt-2 block text-xs text-fg-t7">{t("admin.widget_form.address")}
        <textarea value={value.address} onChange={(e) => patch({ address: e.target.value })} rows={2} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
      </label>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded border border-default bg-white p-2">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold">{t("admin.widget_form.phones")}</p><button type="button" onClick={() => patch({ phones: [...value.phones, ""] })} className="rounded border border-default bg-white px-2 py-1 text-xs">{t("common.add")}</button></div>
          <div className="mt-2 space-y-2">
            {value.phones.map((phone, idx) => (
              <div key={`phone-${idx}`} className="flex items-center gap-2">
                <input value={phone} onChange={(e) => patch({ phones: value.phones.map((p, i) => i === idx ? e.target.value : p) })} className="w-full rounded border border-default px-2 py-1.5 text-sm" />
                <button type="button" onClick={() => patch({ phones: value.phones.filter((_, i) => i !== idx) })} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded border border-default bg-white p-2">
          <div className="flex items-center justify-between"><p className="text-xs font-semibold">{t("admin.widget_form.emails")}</p><button type="button" onClick={() => patch({ emails: [...value.emails, ""] })} className="rounded border border-default bg-white px-2 py-1 text-xs">{t("common.add")}</button></div>
          <div className="mt-2 space-y-2">
            {value.emails.map((email, idx) => (
              <div key={`email-${idx}`} className="flex items-center gap-2">
                <input value={email} onChange={(e) => patch({ emails: value.emails.map((m, i) => i === idx ? e.target.value : m) })} className="w-full rounded border border-default px-2 py-1.5 text-sm" />
                <button type="button" onClick={() => patch({ emails: value.emails.filter((_, i) => i !== idx) })} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function CtaWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: CtaContent;
  saving: boolean;
  onChange: (next: CtaContent) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  async function uploadBackground(file: File) {
    if (!token) return;
    setUploading(true);
    try {
      const res = await apiUploadAdminPageImage(token, file);
      onChange({ ...value, background_image: extractFileName(res.data.path ?? "") });
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-xs text-fg-t7">{t("admin.widget_form.title")}
          <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.subtitle")}
          <input value={value.subtitle} onChange={(e) => onChange({ ...value, subtitle: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.button_text")}
          <input value={value.button_text} onChange={(e) => onChange({ ...value, button_text: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.button_url")}
          <input value={value.button_url} onChange={(e) => onChange({ ...value, button_url: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.background_image")}
          <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void uploadBackground(file); e.currentTarget.value = ""; }} className="mt-1 block w-full text-xs" />
          {uploading ? <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span> : null}
          {value.background_image ? <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {value.background_image}</span> : null}
        </label>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function HomeHeroWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: HomeHeroContent;
  saving: boolean;
  onChange: (next: HomeHeroContent) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function uploadBackground(file: File) {
    setUploading(true);
    setUploadErr(null);
    try {
      const filename = await uploadWidgetImage(token, file);
      onChange({ ...value, background_image: filename });
    } catch (e) {
      setUploadErr(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-xs text-fg-t7">{t("admin.widget_form.headline")}
          <input value={value.headline} onChange={(e) => onChange({ ...value, headline: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.subheadline")}
          <input value={value.subheadline} onChange={(e) => onChange({ ...value, subheadline: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.button_text")}
          <input value={value.button_text} onChange={(e) => onChange({ ...value, button_text: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.button_url")}
          <input value={value.button_url} onChange={(e) => onChange({ ...value, button_url: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.background_image")}
          <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void uploadBackground(file); e.currentTarget.value = ""; }} className="mt-1 block w-full text-xs" />
          {uploading ? <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span> : null}
          {value.background_image ? <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {value.background_image}</span> : null}
          {uploadErr ? <span className="mt-1 block text-xs text-error-600">{uploadErr}</span> : null}
        </label>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function HomeSpecialOffersWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: HomeSpecialOffersContent;
  saving: boolean;
  onChange: (next: HomeSpecialOffersContent) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  function updateItem(index: number, patch: Partial<HomeSpecialOfferItem>) {
    onChange({ ...value, items: value.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  async function uploadItemImage(index: number, file: File) {
    setUploadingIndex(index);
    setUploadErr(null);
    try {
      const filename = await uploadWidgetImage(token, file);
      updateItem(index, { image: filename });
    } catch (e) {
      setUploadErr(uploadErrorMessage(e));
    } finally {
      setUploadingIndex(null);
    }
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-xs text-fg-t7">{t("admin.widget_form.section_title")}
          <input value={value.section_title} onChange={(e) => onChange({ ...value, section_title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.section_subtitle")}
          <input value={value.section_subtitle} onChange={(e) => onChange({ ...value, section_subtitle: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs font-medium text-fg-t7">{t("admin.widget_form.offers")}</p>
        <button type="button" onClick={() => onChange({ ...value, items: [...value.items, { ...DEFAULT_HOME_SPECIAL_OFFER_ITEM }] })} className="rounded border border-default bg-white px-2.5 py-1 text-xs">{t("common.add")}</button>
      </div>
      <div className="mt-2 space-y-2">
        {uploadErr ? <p className="text-xs text-error-600">{uploadErr}</p> : null}
        {value.items.map((item, index) => (
          <div key={`home-special-${index}`} className="rounded border border-default bg-white p-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="text-xs text-fg-t7">{t("admin.widget_form.title")}
                <input value={item.title} onChange={(e) => updateItem(index, { title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.price")}
                <input value={item.price} onChange={(e) => updateItem(index, { price: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.link")}
                <input value={item.link} onChange={(e) => updateItem(index, { link: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.image")}
                <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void uploadItemImage(index, file); e.currentTarget.value = ""; }} className="mt-1 block w-full text-xs" />
                {uploadingIndex === index ? <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span> : null}
                {item.image ? <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {item.image}</span> : null}
              </label>
            </div>
            <div className="mt-2 flex justify-end"><button type="button" onClick={() => onChange({ ...value, items: value.items.filter((_, i) => i !== index) })} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function HomePopularDestinationsWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: HomePopularDestinationsContent;
  saving: boolean;
  onChange: (next: HomePopularDestinationsContent) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  function updateItem(index: number, patch: Partial<HomePopularDestinationItem>) {
    onChange({ ...value, items: value.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  async function uploadItemImage(index: number, file: File) {
    setUploadingIndex(index);
    setUploadErr(null);
    try {
      const filename = await uploadWidgetImage(token, file);
      updateItem(index, { image: filename });
    } catch (e) {
      setUploadErr(uploadErrorMessage(e));
    } finally {
      setUploadingIndex(null);
    }
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <label className="text-xs text-fg-t7">{t("admin.widget_form.section_title")}
        <input value={value.section_title} onChange={(e) => onChange({ ...value, section_title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
      </label>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs font-medium text-fg-t7">{t("admin.widget_form.destinations")}</p>
        <button type="button" onClick={() => onChange({ ...value, items: [...value.items, { ...DEFAULT_HOME_POPULAR_DESTINATION_ITEM }] })} className="rounded border border-default bg-white px-2.5 py-1 text-xs">{t("common.add")}</button>
      </div>
      <div className="mt-2 space-y-2">
        {uploadErr ? <p className="text-xs text-error-600">{uploadErr}</p> : null}
        {value.items.map((item, index) => (
          <div key={`home-destination-${index}`} className="rounded border border-default bg-white p-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="text-xs text-fg-t7">{t("admin.widget_form.title")}
                <input value={item.title} onChange={(e) => updateItem(index, { title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.label")}
                <input value={item.label} onChange={(e) => updateItem(index, { label: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.link")}
                <input value={item.link} onChange={(e) => updateItem(index, { link: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.image")}
                <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void uploadItemImage(index, file); e.currentTarget.value = ""; }} className="mt-1 block w-full text-xs" />
                {uploadingIndex === index ? <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span> : null}
                {item.image ? <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {item.image}</span> : null}
              </label>
            </div>
            <div className="mt-2 flex justify-end"><button type="button" onClick={() => onChange({ ...value, items: value.items.filter((_, i) => i !== index) })} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function HomePartnersWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: HomePartnersContent;
  saving: boolean;
  onChange: (next: HomePartnersContent) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  function updateItem(index: number, patch: Partial<HomePartnerItem>) {
    onChange({ ...value, items: value.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) });
  }

  async function uploadLogo(index: number, file: File) {
    setUploadingIndex(index);
    setUploadErr(null);
    try {
      const filename = await uploadWidgetImage(token, file);
      updateItem(index, { logo_image: filename });
    } catch (e) {
      setUploadErr(uploadErrorMessage(e));
    } finally {
      setUploadingIndex(null);
    }
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg-t7">{t("admin.widget_form.partners")}</p>
        <button type="button" onClick={() => onChange({ ...value, items: [...value.items, { ...DEFAULT_HOME_PARTNER_ITEM }] })} className="rounded border border-default bg-white px-2.5 py-1 text-xs">{t("common.add")}</button>
      </div>
      <div className="mt-2 space-y-2">
        {uploadErr ? <p className="text-xs text-error-600">{uploadErr}</p> : null}
        {value.items.map((item, index) => (
          <div key={`home-partner-${index}`} className="rounded border border-default bg-white p-2">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="text-xs text-fg-t7">{t("admin.widget_form.partner_name")}
                <input value={item.partner_name} onChange={(e) => updateItem(index, { partner_name: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7">{t("admin.widget_form.link")}
                <input value={item.link} onChange={(e) => updateItem(index, { link: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
              </label>
              <label className="text-xs text-fg-t7 md:col-span-2">{t("admin.widget_form.logo_image")}
                <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void uploadLogo(index, file); e.currentTarget.value = ""; }} className="mt-1 block w-full text-xs" />
                {uploadingIndex === index ? <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span> : null}
                {item.logo_image ? <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {item.logo_image}</span> : null}
              </label>
            </div>
            <div className="mt-2 flex justify-end"><button type="button" onClick={() => onChange({ ...value, items: value.items.filter((_, i) => i !== index) })} className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-error-700">{t("admin.widget_form.remove")}</button></div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

function HomeNewsletterWidgetForm({
  value,
  saving,
  onChange,
  onSave,
}: {
  value: HomeNewsletterContent;
  saving: boolean;
  onChange: (next: HomeNewsletterContent) => void;
  onSave: () => Promise<void>;
}) {
  const { token } = useAdminAuth();
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  async function uploadBackground(file: File) {
    setUploading(true);
    setUploadErr(null);
    try {
      const filename = await uploadWidgetImage(token, file);
      onChange({ ...value, bg_image: filename });
    } catch (e) {
      setUploadErr(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="text-xs text-fg-t7">{t("admin.widget_form.title")}
          <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.subtitle")}
          <input value={value.subtitle} onChange={(e) => onChange({ ...value, subtitle: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.button_text")}
          <input value={value.button_text} onChange={(e) => onChange({ ...value, button_text: e.target.value })} className="mt-1 w-full rounded border border-default px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-fg-t7">{t("admin.widget_form.background_image")}
          <input type="file" accept="image/jpeg,image/png,image/jpg,image/webp,image/gif,image/svg+xml" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void uploadBackground(file); e.currentTarget.value = ""; }} className="mt-1 block w-full text-xs" />
          {uploading ? <span className="mt-1 block text-xs text-fg-t6">{t("admin.widget_form.uploading")}</span> : null}
          {value.bg_image ? <span className="mt-1 block text-[11px] text-fg-t6">{t("admin.widget_form.saved_file")}: {value.bg_image}</span> : null}
          {uploadErr ? <span className="mt-1 block text-xs text-error-600">{uploadErr}</span> : null}
        </label>
      </div>
      <div className="mt-3 flex justify-end"><button type="button" disabled={saving} onClick={() => void onSave()} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">{saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}</button></div>
    </div>
  );
}

export function WidgetForm({ widget, activeLanguage, saving = false, onSave }: Props) {
  void activeLanguage;
  const { t } = useLanguage();
  const [textValue, setTextValue] = useState("");
  const [codeValue, setCodeValue] = useState("");
  const [sliderSlides, setSliderSlides] = useState<SlideItem[]>([]);
  const [aboutUsValue, setAboutUsValue] = useState<AboutUsContent>(DEFAULT_ABOUT_US);
  const [featuresItems, setFeaturesItems] = useState<FeatureItem[]>([]);
  const [funFactsItems, setFunFactsItems] = useState<FunFactItem[]>([]);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [testimonialsItems, setTestimonialsItems] = useState<TestimonialItem[]>([]);
  const [latestContent, setLatestContent] = useState<LatestContent>(DEFAULT_LATEST_CONTENT);
  const [contactUsContent, setContactUsContent] = useState<ContactUsContent>(DEFAULT_CONTACT_US);
  const [ctaContent, setCtaContent] = useState<CtaContent>(DEFAULT_CTA);
  const [homeHeroContent, setHomeHeroContent] = useState<HomeHeroContent>(DEFAULT_HOME_HERO);
  const [homeSpecialOffersContent, setHomeSpecialOffersContent] = useState<HomeSpecialOffersContent>(DEFAULT_HOME_SPECIAL_OFFERS);
  const [homePopularDestinationsContent, setHomePopularDestinationsContent] = useState<HomePopularDestinationsContent>(DEFAULT_HOME_POPULAR_DESTINATIONS);
  const [homePartnersContent, setHomePartnersContent] = useState<HomePartnersContent>(DEFAULT_HOME_PARTNERS);
  const [homeNewsletterContent, setHomeNewsletterContent] = useState<HomeNewsletterContent>(DEFAULT_HOME_NEWSLETTER);
  const [searchOptions, setSearchOptions] = useState<SearchOptions>(DEFAULT_SEARCH_OPTIONS);
  const [rawJson, setRawJson] = useState("{}");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const data = normalizeObject(widget.widget_content);
    setTextValue(typeof data.text === "string" ? data.text : "");
    setCodeValue(typeof data.code === "string" ? data.code : "");
    setSliderSlides(normalizeSlides(data.slides));
    setAboutUsValue(normalizeAboutUs(data.about_us));
    setFeaturesItems(normalizeFeatureItems(data.items ?? data.features ?? data.why_choose_us));
    setFunFactsItems(normalizeFunFactItems(data.items ?? data.fun_facts));
    setFaqItems(normalizeFaqItems(data.items ?? data.faq));
    setTestimonialsItems(normalizeTestimonialItems(data.items ?? data.testimonials));
    setLatestContent(normalizeLatest(data.latest ?? data.blogs ?? data));
    setContactUsContent(normalizeContactUs(data.contact_us ?? data));
    setCtaContent(normalizeCta(data.cta ?? data));
    setHomeHeroContent(normalizeHomeHero(data.home_hero ?? data));
    setHomeSpecialOffersContent(normalizeHomeSpecialOffers(data.home_special_offers ?? data));
    setHomePopularDestinationsContent(normalizeHomePopularDestinations(data.home_popular_destinations ?? data));
    setHomePartnersContent(normalizeHomePartners(data.home_partners ?? data));
    setHomeNewsletterContent(normalizeHomeNewsletter(data.home_newsletter ?? data));

    const search = normalizeObject(
      data.search ?? data.search_options
    );
    setSearchOptions({
      flights: normalizeBoolean(search.flights, DEFAULT_SEARCH_OPTIONS.flights),
      hotels: normalizeBoolean(search.hotels, DEFAULT_SEARCH_OPTIONS.hotels),
      cars: normalizeBoolean(search.cars, DEFAULT_SEARCH_OPTIONS.cars),
      transfers: normalizeBoolean(search.transfers, DEFAULT_SEARCH_OPTIONS.transfers),
      excursions: normalizeBoolean(search.excursions, DEFAULT_SEARCH_OPTIONS.excursions),
      packages: normalizeBoolean(search.packages, DEFAULT_SEARCH_OPTIONS.packages),
    });

    setRawJson(JSON.stringify(data, null, 2));
    setErr(null);
  }, [widget.id, widget.widget_content]);

  async function handleSaveTextEditor() {
    setErr(null);
    await onSave({ text: textValue });
  }

  async function handleSaveCodeEditor() {
    setErr(null);
    await onSave({ code: codeValue });
  }

  async function handleSaveSearch() {
    setErr(null);
    await onSave({ search: searchOptions });
  }

  async function handleSaveSliders() {
    setErr(null);
    await onSave({ slides: sliderSlides });
  }

  async function handleSaveAboutUs() {
    setErr(null);
    await onSave({ about_us: aboutUsValue });
  }

  async function handleSaveFeatures() {
    setErr(null);
    await onSave({ items: featuresItems });
  }

  async function handleSaveFunFacts() {
    setErr(null);
    await onSave({ items: funFactsItems });
  }

  async function handleSaveFaq() {
    setErr(null);
    await onSave({ items: faqItems });
  }

  async function handleSaveTestimonials() {
    setErr(null);
    await onSave({ items: testimonialsItems });
  }

  async function handleSaveLatest() {
    setErr(null);
    await onSave({
      widget_title: latestContent.widget_title,
      show_count: latestContent.show_count,
      category_filter: latestContent.category_filter,
    });
  }

  async function handleSaveContactUs() {
    setErr(null);
    await onSave({
      widget_title: contactUsContent.widget_title,
      address: contactUsContent.address,
      map_embed_url: contactUsContent.map_embed_url,
      phones: contactUsContent.phones,
      emails: contactUsContent.emails,
    });
  }

  async function handleSaveCta() {
    setErr(null);
    await onSave({
      title: ctaContent.title,
      subtitle: ctaContent.subtitle,
      button_text: ctaContent.button_text,
      button_url: ctaContent.button_url,
      background_image: ctaContent.background_image,
    });
  }

  async function handleSaveHomeHero() {
    setErr(null);
    await onSave(homeHeroContent as unknown as Record<string, unknown>);
  }

  async function handleSaveHomeSpecialOffers() {
    setErr(null);
    await onSave({
      section_title: homeSpecialOffersContent.section_title,
      section_subtitle: homeSpecialOffersContent.section_subtitle,
      items: homeSpecialOffersContent.items,
    });
  }

  async function handleSaveHomePopularDestinations() {
    setErr(null);
    await onSave({
      section_title: homePopularDestinationsContent.section_title,
      items: homePopularDestinationsContent.items,
    });
  }

  async function handleSaveHomePartners() {
    setErr(null);
    await onSave({
      items: homePartnersContent.items,
    });
  }

  async function handleSaveHomeNewsletter() {
    setErr(null);
    await onSave(homeNewsletterContent as unknown as Record<string, unknown>);
  }

  async function handleSaveFallbackJson() {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setErr(t("admin.widget_form.json_object_required"));
        return;
      }
      setErr(null);
      await onSave(parsed as Record<string, unknown>);
    } catch {
      setErr(t("admin.widget_form.invalid_json"));
    }
  }

  if (widget.widget_slug === "sliders") {
    return (
      <SliderWidgetForm
        slides={sliderSlides}
        saving={saving}
        onSlidesChange={setSliderSlides}
        onSave={handleSaveSliders}
      />
    );
  }

  if (widget.widget_slug === "text-editor") {
    return (
      <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
        <label className="block text-xs font-medium text-fg-t7">{t("admin.widget_form.text_content")}</label>
        <textarea
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          rows={7}
          className="mt-1 w-full rounded border border-default px-2 py-2 text-sm"
          placeholder={t("admin.widget_form.enter_text_content")}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveTextEditor()}
            className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}
          </button>
        </div>
      </div>
    );
  }

  if (widget.widget_slug === "about-us") {
    return (
      <AboutUsWidgetForm
        value={aboutUsValue}
        saving={saving}
        onChange={setAboutUsValue}
        onSave={handleSaveAboutUs}
      />
    );
  }

  if (widget.widget_slug === "features" || widget.widget_slug === "why-choose-us") {
    return (
      <FeaturesWidgetForm
        title={widget.widget_slug === "why-choose-us" ? t("admin.widget_form.why_choose_us") : t("admin.widget_form.features")}
        items={featuresItems}
        saving={saving}
        onItemsChange={setFeaturesItems}
        onSave={handleSaveFeatures}
      />
    );
  }

  if (widget.widget_slug === "fun-facts") {
    return (
      <FunFactsWidgetForm
        items={funFactsItems}
        saving={saving}
        onItemsChange={setFunFactsItems}
        onSave={handleSaveFunFacts}
      />
    );
  }

  if (widget.widget_slug === "faq") {
    return (
      <FaqWidgetForm
        items={faqItems}
        saving={saving}
        onItemsChange={setFaqItems}
        onSave={handleSaveFaq}
      />
    );
  }

  if (widget.widget_slug === "testimonials") {
    return (
      <TestimonialsWidgetForm
        items={testimonialsItems}
        saving={saving}
        onItemsChange={setTestimonialsItems}
        onSave={handleSaveTestimonials}
      />
    );
  }

  if (
    widget.widget_slug === "blogs" ||
    widget.widget_slug === "latest-packages" ||
    widget.widget_slug === "latest-offers"
  ) {
    return (
      <LatestOffersWidgetForm
        value={latestContent}
        saving={saving}
        onChange={setLatestContent}
        onSave={handleSaveLatest}
      />
    );
  }

  if (widget.widget_slug === "contact-us") {
    return (
      <ContactUsWidgetForm
        value={contactUsContent}
        saving={saving}
        onChange={setContactUsContent}
        onSave={handleSaveContactUs}
      />
    );
  }

  if (widget.widget_slug === "cta") {
    return (
      <CtaWidgetForm
        value={ctaContent}
        saving={saving}
        onChange={setCtaContent}
        onSave={handleSaveCta}
      />
    );
  }

  if (widget.widget_slug === "home-hero") {
    return (
      <HomeHeroWidgetForm
        value={homeHeroContent}
        saving={saving}
        onChange={setHomeHeroContent}
        onSave={handleSaveHomeHero}
      />
    );
  }

  if (widget.widget_slug === "home-special-offers") {
    return (
      <HomeSpecialOffersWidgetForm
        value={homeSpecialOffersContent}
        saving={saving}
        onChange={setHomeSpecialOffersContent}
        onSave={handleSaveHomeSpecialOffers}
      />
    );
  }

  if (widget.widget_slug === "home-popular-destinations") {
    return (
      <HomePopularDestinationsWidgetForm
        value={homePopularDestinationsContent}
        saving={saving}
        onChange={setHomePopularDestinationsContent}
        onSave={handleSaveHomePopularDestinations}
      />
    );
  }

  if (widget.widget_slug === "home-partners") {
    return (
      <HomePartnersWidgetForm
        value={homePartnersContent}
        saving={saving}
        onChange={setHomePartnersContent}
        onSave={handleSaveHomePartners}
      />
    );
  }

  if (widget.widget_slug === "home-newsletter") {
    return (
      <HomeNewsletterWidgetForm
        value={homeNewsletterContent}
        saving={saving}
        onChange={setHomeNewsletterContent}
        onSave={handleSaveHomeNewsletter}
      />
    );
  }

  if (widget.widget_slug === "code-editor") {
    return (
      <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
        <label className="block text-xs font-medium text-fg-t7">{t("admin.widget_form.html_code")}</label>
        <textarea
          value={codeValue}
          onChange={(e) => setCodeValue(e.target.value)}
          rows={9}
          className="mt-1 w-full rounded border border-default px-2 py-2 font-mono text-sm"
          placeholder="<section>...</section>"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSaveCodeEditor()}
            className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
          >
            {saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}
          </button>
        </div>
      </div>
    );
  }

  if (widget.widget_slug === "search") {
    return (
      <SearchWidgetForm
        searchOptions={searchOptions}
        saving={saving}
        onSearchOptionsChange={setSearchOptions}
        onSave={handleSaveSearch}
      />
    );
  }

  return (
    <div className="mt-3 rounded border border-default bg-figma-bg-1 p-3">
      <p className="text-xs text-fg-t6">
        {t("admin.widget_form.no_dedicated_form")} <span className="font-mono">{widget.widget_slug}</span>.{" "}
        {t("admin.widget_form.use_raw_json_editor")}.
      </p>
      {err ? <p className="mt-2 text-xs text-error-600">{err}</p> : null}
      <textarea
        value={rawJson}
        onChange={(e) => setRawJson(e.target.value)}
        rows={10}
        className="mt-2 w-full rounded border border-default px-2 py-2 font-mono text-xs"
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSaveFallbackJson()}
          className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
        >
          {saving ? t("admin.widget_form.saving") : t("admin.widget_form.save_widget")}
        </button>
      </div>
    </div>
  );
}
