export interface UniversityCardDTO {
  name: string;
  slug: string;
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

export interface University {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  type: string;
  officialWebsite: string;
  qsWorldRanking2026: string;
  schoolIntro: string;
  cityIntro: string;
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
  display: string;
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
  criteriaMatch: string | null;
  sourceUrl: string | null;
  lastChecked: string | null;
}

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
  deadlines: { bachelor: Deadline; master: Deadline };
  germanCourse: IntensiveGermanCourse;
}

export interface FilterOptions {
  state: Array<{ value: string; label: Record<"tr" | "de" | "en", string> }>;
  type: Array<{ value: string; label: Record<"tr" | "de" | "en", string> }>;
  germanCourse: Array<{ value: string; label: Record<"tr" | "de" | "en", string> }>;
  level: Array<{ value: string; label: Record<"tr" | "de" | "en", string> }>;
  uniAssist: Array<{ value: string; label: Record<"tr" | "de" | "en", string> }>;
}
