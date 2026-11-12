import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { integrationHead } from "@/lib/integration-head";
export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ next: oauthReturnPath(s['next']) }),
  head: () => integrationHead("Choose a new password", "Set a new password for your Energy Twin account after secure email verification."),
  component: ResetPassword,
});
function ResetPassword() {
  const { next } = Route.useSearch();
  const [ready, setReady] = useState(false); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  useEffect(() => { let active = true; const check = (session: unknown) => { if (active) setReady(Boolean(session)); }; const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => check(session)); void supabase.auth.getSession().then(({ data }) => check(data.session)); return () => { active = false; subscription.unsubscribe(); }; }, []);
  return <main className="mx-auto max-w-md space-y-6 px-4 py-16"><h1 className="text-2xl font-semibold">Choose a new password</h1>{!ready ? <p className="text-muted-foreground">Open the password reset link from your email to continue.</p> : <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; window.location.assign(next); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not update the password. Try again."); } finally { setBusy(false); } }}><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} /><Button disabled={busy}>Update password</Button></form>}{message && <p role="alert">{message}</p>}<Button asChild variant="ghost"><Link to="/login" search={{ next }}>Back to sign in</Link></Button></main>;
}