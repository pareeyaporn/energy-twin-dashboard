import { create } from "zustand";

/**
 * View state for the AI assistant's extras (docs/23), kept out of the app store on purpose: whether the portfolio chat is open and
 * whether the Hotel tab's AI briefing is hidden for this browser session. Nothing here holds a number.
 */
export const BRIEFING_HIDDEN_KEY = "energy-twin:briefing-hidden";

function readHidden(): boolean {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(BRIEFING_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

interface AdvisorUi {
  portfolioChatOpen: boolean;
  setPortfolioChatOpen: (open: boolean) => void;
  briefingHidden: boolean;
  setBriefingHidden: (hidden: boolean) => void;
}

export const useAdvisorUi = create<AdvisorUi>((set) => ({
  portfolioChatOpen: false,
  setPortfolioChatOpen: (portfolioChatOpen) => set({ portfolioChatOpen }),
  briefingHidden: readHidden(),
  setBriefingHidden: (briefingHidden) => {
    try {
      if (briefingHidden) sessionStorage.setItem(BRIEFING_HIDDEN_KEY, "1");
      else sessionStorage.removeItem(BRIEFING_HIDDEN_KEY);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
    set({ briefingHidden });
  },
}));

/** Suggested questions for the portfolio chat: each one makes the AI chain portfolio tools (docs/23). */
export const PORTFOLIO_SUGGESTED_QUESTIONS = [
  "Which hotel should we invest in first, and why?",
  "How would you split $250,000 across the chain?",
  "Which hotels get nothing if we split $100,000?",
] as const;
