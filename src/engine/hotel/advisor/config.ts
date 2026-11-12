import type { AdvisorConfig } from './ask';

type Env = Record<string, string | undefined>;

// Leaves room for the advisor function's own 14 s limit (ADVISOR_TIMEOUT_MS) before falling back to a template.
export const ADVISOR_CLIENT_TIMEOUT_MS = 15_000;

/**
 * Where the advisor function lives. `VITE_ADVISOR_URL` wins; otherwise the Lovable Cloud (Supabase) project URL is used with its
 * public (publishable) key. Neither is a secret. With neither set, the advisor runs on template answers only.
 */
export function advisorConfigFromEnv(env: Env): AdvisorConfig {
  const direct = env['VITE_ADVISOR_URL'];
  const base = env['VITE_SUPABASE_URL'];
  const key = env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? env['VITE_SUPABASE_ANON_KEY'];
  if (direct) return { endpoint: direct, timeoutMs: ADVISOR_CLIENT_TIMEOUT_MS, headers: key ? { apikey: key, authorization: `Bearer ${key}` } : {} };
  if (base) {
    return {
      endpoint: `${base.replace(/\/$/, '')}/functions/v1/advisor`,
      timeoutMs: ADVISOR_CLIENT_TIMEOUT_MS,
      headers: key ? { apikey: key, authorization: `Bearer ${key}` } : {},
    };
  }
  return { endpoint: null, headers: {} };
}

let override: AdvisorConfig | null = null;
/** For tests and previews: use this configuration instead of the environment. Pass null to go back. */
export function setAdvisorConfig(config: AdvisorConfig | null): void {
  override = config;
}

export function getAdvisorConfig(): AdvisorConfig {
  if (override) return override;
  return advisorConfigFromEnv(import.meta.env as unknown as Env);
}
