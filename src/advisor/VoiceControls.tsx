import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, Volume2, VolumeX } from "lucide-react";
import { useTwin } from "@/store/useTwin";
import { Button } from "@/components/ui/button";
import { canSpeak, micErrorText, normalizeSpokenQuestion, pickVoice, readSpeakAnswers, recognitionCtor, textForSpeech, writeSpeakAnswers } from "./voice";
import type { SpeechRecognitionLike } from "./voice";
import { fetchSpeech } from "./ttsClient";

/**
 * Voice for the Ask tab (docs/23 §10): a mic button (tap, speak, it sends when you stop; the words appear in the box as you talk) and a
 * speaker toggle that reads each new answer aloud after the number check (the text on screen, reworded for the ear), in a human voice
 * (OpenAI text-to-speech via the tts function) with the browser's voice as the fallback. Hidden parts when
 * the browser lacks them; typing always works. Nothing is sent anywhere new: the recognition is the browser's own.
 */
export function VoiceControls({ disabled, onTranscript }: { disabled?: boolean; onTranscript: (text: string, final: boolean) => void }) {
  const Rec = recognitionCtor();
  const speakable = canSpeak();
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakOn, setSpeakOn] = useState(readSpeakAnswers);
  const [note, setNote] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const finalText = useRef("");
  const messages = useTwin((s) => s.advisorMessages);
  // Answers already on screen when the panel opens are not read out; only new ones.
  const lastSpoken = useRef<string | null>(messages.at(-1)?.id ?? null);

  const audio = useRef<HTMLAudioElement | null>(null);
  const pending = useRef<AbortController | null>(null);
  const stopSpeaking = () => {
    pending.current?.abort();
    pending.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current = null;
    }
    if (speakable) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  /** The browser's own voice (offline fallback). */
  const speakWithBrowser = (text: string) => {
    if (!speakable) return setSpeaking(false);
    const u = new window.SpeechSynthesisUtterance(text);
    const voice = pickVoice(window.speechSynthesis.getVoices());
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-US";
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  /** A human voice (OpenAI text-to-speech through the tts function) when available, else the browser's voice. */
  const speak = async (text: string) => {
    stopSpeaking();
    setSpeaking(true);
    const ctrl = new AbortController();
    pending.current = ctrl;
    const blob = await fetchSpeech(text, { signal: ctrl.signal });
    if (ctrl.signal.aborted) return;
    pending.current = null;
    if (blob && typeof Audio !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      audio.current = a;
      const end = () => {
        URL.revokeObjectURL(url);
        if (audio.current === a) audio.current = null;
        setSpeaking(false);
      };
      a.onended = end;
      a.onerror = () => {
        end();
        speakWithBrowser(text);
      };
      try {
        await a.play();
        return;
      } catch {
        end();
      }
    }
    speakWithBrowser(text);
  };

  useEffect(() => {
    const last = messages.at(-1);
    if (!last || last.id === lastSpoken.current) return;
    lastSpoken.current = last.id;
    if (last.role !== "advisor" || !speakOn || !last.text) return;
    void speak(textForSpeech(last.text));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, speakOn]);

  // Stop listening and speaking when the panel goes away (tab switch, page change).
  useEffect(
    () => () => {
      rec.current?.abort();
      pending.current?.abort();
      audio.current?.pause();
      if (canSpeak()) window.speechSynthesis.cancel();
    },
    [],
  );

  const startListening = () => {
    if (!Rec || disabled) return;
    stopSpeaking();
    setNote(null);
    finalText.current = "";
    const r = new Rec();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) finalText.current += t;
        else interim += t;
      }
      onTranscript(normalizeSpokenQuestion(finalText.current + interim), false);
    };
    r.onerror = (e) => setNote(micErrorText(e.error));
    r.onend = () => {
      setListening(false);
      rec.current = null;
      const q = normalizeSpokenQuestion(finalText.current);
      if (q) onTranscript(q, true);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setNote("Voice input could not start; type the question instead.");
    }
  };
  const stopListening = () => rec.current?.stop();

  const toggleSpeak = () => {
    const on = !speakOn;
    setSpeakOn(on);
    writeSpeakAnswers(on);
    if (!on) stopSpeaking();
  };

  const canPlay = speakable || typeof Audio !== "undefined";
  if (!Rec && !canPlay) return null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1" data-testid="voice-controls">
      {Rec ? (
        <Button
          type="button"
          size="icon"
          variant={listening ? "default" : "ghost"}
          className={`size-8 ${listening ? "animate-pulse motion-reduce:animate-none" : ""}`}
          onClick={listening ? stopListening : startListening}
          disabled={disabled && !listening}
          aria-pressed={listening}
          aria-label={listening ? "Stop listening" : "Ask by voice"}
          title={listening ? "Listening… tap to stop" : "Ask by voice (Chrome or Edge; needs a connection)"}
          data-testid="voice-mic"
        >
          {listening ? <MicOff /> : <Mic />}
        </Button>
      ) : null}
      {canPlay && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={toggleSpeak}
          aria-pressed={speakOn}
          aria-label={speakOn ? "Stop reading answers aloud" : "Read answers aloud"}
          title={speakOn ? "Answers are read aloud" : "Read answers aloud"}
          data-testid="voice-speak"
        >
          {speakOn ? <Volume2 className="text-primary" /> : <VolumeX />}
        </Button>
      )}
      {speaking && (
        <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={stopSpeaking} data-testid="voice-stop">
          <Square className="size-3" /> Stop
        </Button>
      )}
      <span className="min-w-0 truncate text-[11px] text-muted-foreground" aria-live="polite" data-testid="voice-status">
        {listening ? "Listening…" : note ?? ""}
      </span>
    </div>
  );
}
