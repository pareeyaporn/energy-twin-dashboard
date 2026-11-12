import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { integrationHead } from "@/lib/integration-head";
export const Route = createFileRoute("/forgot-password")({
  validateSearch: (s: Record<string, unknown>) => ({ next: oauthReturnPath(s['next']) }),
  head: () => integrationHead("Reset your password", "Request a secure password reset for your Energy Twin account."),
  component: ForgotPassword,
});
function ForgotPassword() {
  const { next } = Route.useSearch();
  const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  return <main className="mx-auto max-w-md space-y-6 px-4 py-16"><h1 className="text-2xl font-semibold">Reset your password</h1><form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: new URL(`/reset-password?next=${encodeURIComponent(next)}`, window.location.origin).href }); if (error) throw error; setMessage("Check your email for a password reset link."); } catch (error) { setMessage(error instanceof Error ? error.message : "Could not send the reset link. Try again."); } finally { setBusy(false); } }}><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} /><Button disabled={busy}>Send reset link</Button></form>{message && <p role="status">{message}</p>}<Button asChild variant="ghost"><Link to="/login" search={{ next }}>Back to sign in</Link></Button></main>;
}