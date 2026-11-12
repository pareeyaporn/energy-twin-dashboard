import type { AdvisorAnswerStore } from "@/engine/hotel/advisor/ask";

/** Where AI advisor answers are kept between visits (task 8.2): a rehearsal fixes the demo's answers on that laptop. */
export const ADVISOR_ANSWERS_KEY = "energy-twin:advisor-answers:v1";
const MAX = 60;

type Saved = { key: string; text: string }[];

function read(): Saved {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(window.localStorage.getItem(ADVISOR_ANSWERS_KEY) ?? "[]") as unknown;
    return Array.isArray(v) ? v.filter((x): x is Saved[number] => !!x && typeof x.key === "string" && typeof x.text === "string") : [];
  } catch {
    return [];
  }
}

/** Local-storage store for validated AI answers (newest kept; at most 60). The engine re-checks every answer before using it. */
export const advisorAnswerStore: AdvisorAnswerStore = {
  read: (key) => read().find((x) => x.key === key)?.text ?? null,
  write: (key, text) => {
    if (typeof window === "undefined") return;
    const next = [{ key, text }, ...read().filter((x) => x.key !== key)].slice(0, MAX);
    window.localStorage.setItem(ADVISOR_ANSWERS_KEY, JSON.stringify(next));
  },
};

/** Forget the saved answers (for example after the storyline's questions change). */
export const clearSavedAdvisorAnswers = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(ADVISOR_ANSWERS_KEY);
};
