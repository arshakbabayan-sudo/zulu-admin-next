import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Tell tailwind-merge that our custom `text-ds-*` utilities are font-size tokens,
 * NOT text-color tokens. Otherwise twMerge collapses pairs like
 * `text-white` (color) + `text-ds-button-m` (size) and one gets dropped.
 *
 * Token list mirrors `tailwind.config.ts > theme.extend.fontSize`.
 */
const customTwMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "ds-display-h1",
            "ds-h1",
            "ds-h2",
            "ds-h3",
            "ds-h4",
            "ds-h5",
            "ds-h6",
            "ds-subtitle-1",
            "ds-subtitle-2",
            "ds-body-1",
            "ds-body-2",
            "ds-body-3",
            "ds-button-l",
            "ds-button-m",
            "ds-button-s",
            "ds-caption",
            "ds-input-label",
            "ds-input-text",
            "ds-helper-text",
            "ds-body-14",
            "ds-caption-12",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}
