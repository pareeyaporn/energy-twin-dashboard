import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { integrationHead } from "@/lib/integration-head";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({ next: oauthReturnPath(search['next']) }),
  head: () => integrationHead("Agent sign-in", "Sign in securely to approve an assistant connection to Energy Twin."),
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const result = signup
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL(`/auth/callback?next=${encodeURIComponent(next)}`, window.location.origin).href } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) window.location.assign(next);
      else setMessage("Check your email to confirm your account and return to this connection.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in could not be completed. Please try again."); }
    finally { setBusy(false); }
  }

  async function social(provider: "google" | "lovable") {
    setBusy(true); setMessage("");
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: new URL(`/auth/callback?next=${encodeURIComponent(next)}`, window.location.origin).href,
      });
      if (result.error) throw result.error;
      if (!result.redirected) {
        const { data } = await supabase.auth.getSession();
        if (data.session) window.location.assign(next);
        else throw new Error("Sign-in has not completed. Please try again.");
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in could not be completed. Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="flex min-h-screen items-start justify-center bg-background px-4 py-16">
    <section className="w-full max-w-md space-y-6">
      <Link to="/" className="text-lg font-semibold text-primary">Energy Twin</Link>
      <div><h1 className="text-2xl font-semibold">{signup ? "Create your account" : "Sign in"}</h1><p className="mt-2 text-sm text-muted-foreground">Connect your assistant securely.</p></div>
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2"><Label htmlFor="auth-email">Email</Label><Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /></div>
        <div className="space-y-2"><Label htmlFor="auth-password">Password</Label><Input id="auth-password" type="password" autoComplete={signup ? "new-password" : "current-password"} required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Please wait…" : signup ? "Create account" : "Sign in"}</Button>
      </form>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <div className="space-y-3">
        <Button variant="outline" className="google-auth-button w-full" disabled={busy} onClick={() => social("google")}>
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>Continue with Google
        </Button>
        <Button variant="outline" className="lovable-auth-button w-full" disabled={busy} onClick={() => social("lovable")}>Continue with Lovable</Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setSignup(!signup); setMessage(""); }}>{signup ? "Already have an account? Sign in" : "Create an account"}</Button>
        <Button asChild variant="ghost" size="sm"><Link to="/forgot-password" search={{ next }}>Forgot password?</Link></Button>
      </div>
    </section>
  </main>;
}