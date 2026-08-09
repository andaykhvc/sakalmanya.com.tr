export type Language = "tr" | "de" | "en";

/**
 * A dataset text field. The build emits a {tr,de,en} object once a `_de`/`_en` column is
 * filled in the xlsx, and leaves the plain Turkish string in place until then. The API
 * resolves both shapes before responding, so every DTO field below is already a string.
 */
export type LocalizedText = string | Record<Language, string>;

export interface UniversityCardDTO {
  name: string;
  slug: string;
  logoPath: string | null;
  city: string;
  state: string;
  type: string;
  qsWorldRanking2026: string;
  schoolIntro: string;
  cityIntro: string;
  bachelorDeadline: string;
  masterDeadline: string;
  germanPrepStatus: string;
  uniAssistStatus: string;
  lastChecked: string;
  sourceUrl: string;
  detailUrl: string;
}

/** Raw dataset record as compiled into api/universities.js. */
export interface University {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  type: string;
  officialWebsite: string;
  qsWorldRanking2026: string;
  schoolIntro: LocalizedText;
  cityIntro: LocalizedText;
  lastChecked: string;
  filters: {
    state: string;
    type: string;
    germanCourse: string;
    level: string;
    uniAssist: string;
  };
  deadlines: { bachelor: Deadline; master: Deadline };
  germanCourse: IntensiveGermanCourse;
}

export interface Deadline {
  display: LocalizedText;
  date: string | null;
  portal: string | null;
  portalCategory: string | null;
  sourceUrl: string | null;
  lastChecked: string | null;
}

export interface IntensiveGermanCourse {
  status: string;
  label: string;
  name: string | null;
  type: string | null;
  duration: string | null;
  weeklyHours: string | null;
  targetExam: string | null;
  targetDegreeLevel: string | null;
  requiredLevel: string | null;
  residenceRelevance: string | null;
  criteriaMatch: LocalizedText | null;
  sourceUrl: string | null;
  lastChecked: string | null;
}

/** DTO variants: the API has already resolved every localisable field to a string. */
export type ResolvedDeadline = Omit<Deadline, "display"> & { display: string };
export type ResolvedGermanCourse = Omit<IntensiveGermanCourse, "criteriaMatch"> & { criteriaMatch: string | null };

export interface UniversityDetailDTO {
  name: string;
  slug: string;
  city: string;
  state: string;
  type: string;
  officialWebsite: string;
  qsWorldRanking2026: string;
  schoolIntro: string;
  cityIntro: string;
  universityLongIntro?: string | null;
  whyChoose?: string | null;
  cityStudentLife?: string | null;
  cityTransport?: string | null;
  cityCostOfLiving?: string | null;
  cityHistory?: string | null;
  cityHistoricalNote?: string | null;
  cityEconomy?: string | null;
  cityIndustries?: string | null;
  studentJobsNote?: string | null;
  turkishStudentsNote?: string | null;
  applicationPortal: string;
  uniAssistStatus: string;
  lastChecked: string;
  deadlines: { bachelor: ResolvedDeadline; master: ResolvedDeadline };
  germanCourse: ResolvedGermanCourse;
  related: Array<{ name: string; city: string; state: string; detailUrl: string }>;
  trustNotice: string;
  detailUrl: string;
  lang: Language;
}

/** `value` is always the raw dataset value and is what the API expects back as a filter. */
export interface FilterOption {
  value: string;
  label: Record<Language, string>;
}

export interface FilterOptions {
  state: FilterOption[];
  type: FilterOption[];
  germanCourse: FilterOption[];
  level: FilterOption[];
  uniAssist: FilterOption[];
}

export interface UniversityListResponse {
  items: UniversityCardDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number; hasMore: boolean };
  filters: FilterOptions;
  lang: Language;
}
