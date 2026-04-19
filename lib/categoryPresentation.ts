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
  iconWrapClass: string;
};

/** Default NAATI CCL topic slugs — used for guest preview ordering when API is unavailable. */
export const DEFAULT_CATEGORY_ORDER: string[] = [
  "health",
  "legal",
  "housing",
  "employment",
  "education",
  "social-services",
  "financial-1",
  "financial-2",
];

const MAP: Record<string, CategoryPresentation> = {
  health: {
    label: "Health",
    icon: Heart,
    iconWrapClass: "bg-rose-500/15 text-rose-700",
  },
  legal: {
    label: "Legal",
    icon: Scale,
    iconWrapClass: "bg-slate-500/15 text-slate-700",
  },
  housing: {
    label: "Housing",
    icon: Home,
    iconWrapClass: "bg-amber-500/15 text-amber-800",
  },
  employment: {
    label: "Employment",
    icon: Briefcase,
    iconWrapClass: "bg-blue-500/15 text-blue-700",
  },
  education: {
    label: "Education",
    icon: GraduationCap,
    iconWrapClass: "bg-violet-500/15 text-violet-700",
  },
  "social-services": {
    label: "Social Services",
    icon: Users,
    iconWrapClass: "bg-teal-500/15 text-teal-800",
  },
  "financial-1": {
    label: "Financial (Set 1)",
    icon: Landmark,
    iconWrapClass: "bg-emerald-500/15 text-emerald-800",
  },
  "financial-2": {
    label: "Financial (Set 2)",
    icon: Landmark,
    iconWrapClass: "bg-emerald-500/15 text-emerald-700",
  },
};

export function getCategoryPresentation(slug: string): CategoryPresentation {
  return (
    MAP[slug] ?? {
      label: slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: BookOpen,
      iconWrapClass: "bg-primary/15 text-primary",
    }
  );
}
