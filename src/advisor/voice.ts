// Voice for the advisor (docs/23 §10): speech in through the browser's speech recognition, speech out through its speech synthesis. No
// new service and no key. Pure helpers here (tested); the React part is `VoiceControls.tsx`. The spoken reply is the advisor's answer
// exactly as shown on screen, after the number check, only reworded for the ear (symbols and units read out).

/** The browser's speech recognition constructor, if any (Chrome and Edge; prefixed in older Chrome). */
export function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";

/** The subset of the Web Speech API recognition object the controls use. */
export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/**
 * A spoken question as the advisor's parser expects it: "85 percent" → "85%", "50,000 dollars" → "$50,000", "50 thousand dollars" →
 * "$50,000", a trailing question mark for questions. Numbers already written as digits by the recognizer are kept.
 */
export function normalizeSpokenQuestion(raw: string): string {
  let t = raw.trim().replace(/\s+/g, " ");
  t = t.replace(/(\d[\d,.]*)\s*(?:percent|per cent)\b/gi, "$1%");
  t = t.replace(/(\d[\d,.]*)\s*(thousand|k)\s*dollars?\b/gi, (_, n: string) => `$${Math.round(Number(n.replace(/,/g, "")) * 1000).toLocaleString("en-US")}`);
  t = t.replace(/(\d[\d,.]*)\s*(million)\s*dollars?\b/gi, (_, n: string) => `$${Math.round(Number(n.replace(/,/g, "")) * 1_000_000).toLocaleString("en-US")}`);
  t = t.replace(/(\d[\d,.]*)\s*dollars?\b/gi, (_, n: string) => `$${n}`);
  t = t.replace(/(\d+)\s*degrees?(?:\s*fahrenheit)?\b/gi, "$1°F");
  if (t && /^(what|why|how|which|should|can|could|is|are|do|does|will|would|where|when)\b/i.test(t) && !/[?.!]$/.test(t)) t += "?";
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * The answer reworded for the ear: markdown and the follow-ups line dropped, arrows and symbols read out, units spelled. The figures are
 * the same as on screen (digits are left for the voice to read).
 */
export function textForSpeech(text: string): string {
  return text
    .replace(/^FOLLOW_UPS:.*$/gim, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s*(?:→|->)\s*/g, " to ")
    .replace(/\+\$/g, "plus $")
    .replace(/(^|[\s(])\+(\d)/g, "$1plus $2")
    .replace(/(^|[\s(])[-−](\d)/g, "$1minus $2")
    .replace(/kBtu\s*\/\s*ft²(\s*\/\s*yr)?/g, (_, yr) => `kBtu per square foot${yr ? " a year" : ""}`)
    .replace(/ft²/g, "square feet")
    .replace(/\bkWh\b/g, "kilowatt hours")
    .replace(/\bkW\b/g, "kilowatts")
    .replace(/CO₂e|CO2e/g, "C O 2 equivalent")
    .replace(/CO₂|CO2/g, "C O 2")
    .replace(/\bt\b(?= C O 2)/g, "tonnes")
    .replace(/\s*\/\s*yr\b/g, " a year")
    .replace(/°F/g, " degrees")
    .replace(/\s+/g, " ")
    .trim();
}

export const VOICE_STORAGE_KEY = "energy-twin:advisor-voice:v1";
export function readSpeakAnswers(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(VOICE_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}
export function writeSpeakAnswers(on: boolean): void {
  try {
    window.localStorage.setItem(VOICE_STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** A clear voice: an English Google or natural voice when the browser has one, else the default. */
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en(-|_)?/i.test(v.lang));
  return en.find((v) => /Google US English/i.test(v.name)) ?? en.find((v) => /natural|neural|premium|enhanced/i.test(v.name)) ?? en.find((v) => /en-US/i.test(v.lang)) ?? en[0] ?? null;
}

/** Short messages for recognition errors. */
export function micErrorText(error: string): string | null {
  if (error === "not-allowed" || error === "service-not-allowed") return "Microphone blocked: allow it in the browser, or type the question.";
  if (error === "network") return "Voice input needs an internet connection; type the question instead.";
  if (error === "no-speech") return "Didn't catch that. Tap the mic and try again.";
  if (error === "aborted") return null;
  return "Voice input stopped; type the question instead.";
}
