import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Briefcase,
  GraduationCap,
  Heart,
  Home,
  Landmark,
  Scale,
  Users,
} from "lucide-react";

export type CategoryPresentation = {
  label: string;
  icon: LucideIcon;
  iconStyle: { background: string; color: string };
};

/** Default NAATI CCL topic slugs — used for guest preview ordering when API is unavailable. */
export const DEFAULT_CATEGORY_ORDER: string[] = [
  "health",
  "legal",
  "housing",
  // "employment",
  // "education",
  // "social-services",
  // "financial-1",
  // "financial-2",
];

// All colours use CSS custom properties so they flip correctly in dark mode.
// --crimson-*, --marigold-*, --teal-*, --indigo-* are back-compat aliases
// defined in globals.css with dark-mode overrides.
const MAP: Record<string, CategoryPresentation> = {
  health: {
    label: "Health",
    icon: Heart,
    iconStyle: { background: "var(--crimson-50)", color: "var(--crimson-600)" },
  },
  legal: {
    label: "Legal",
    icon: Scale,
    iconStyle: { background: "var(--bg-sunken)", color: "var(--fg-subtle)" },
  },
  housing: {
    label: "Housing",
    icon: Home,
    iconStyle: { background: "var(--marigold-50)", color: "var(--marigold-600)" },
  },
  employment: {
    label: "Employment",
    icon: Briefcase,
    iconStyle: { background: "var(--indigo-50)", color: "var(--indigo-500)" },
  },
  education: {
    label: "Education",
    icon: GraduationCap,
    iconStyle: { background: "var(--indigo-50)", color: "var(--indigo-600)" },
  },
  "social-services": {
    label: "Social Services",
    icon: Users,
    iconStyle: { background: "var(--teal-50)", color: "var(--teal-600)" },
  },
  "financial-1": {
    label: "Financial (Set 1)",
    icon: Landmark,
    iconStyle: { background: "var(--teal-50)", color: "var(--teal-700)" },
  },
  "financial-2": {
    label: "Financial (Set 2)",
    icon: Landmark,
    iconStyle: { background: "var(--teal-50)", color: "var(--teal-600)" },
  },
};

export function getCategoryPresentation(slug: string): CategoryPresentation {
  return (
    MAP[slug] ?? {
      label: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: BookOpen,
      iconStyle: { background: "var(--brand-soft)", color: "var(--brand)" },
    }
  );
}
