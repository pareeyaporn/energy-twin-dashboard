export function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <path d="M5 15 16 6l11 9v11H5z" fill="none" stroke="var(--foreground)" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="16" cy="19" r="2.6" fill="var(--primary)" style={{ filter: "drop-shadow(0 0 4px var(--primary))" }} />
    </svg>
  );
}
