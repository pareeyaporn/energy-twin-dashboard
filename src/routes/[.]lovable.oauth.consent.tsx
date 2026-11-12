import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { integrationHead } from "@/lib/integration-head";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({ authorization_id: typeof search['authorization_id'] === "string" ? search['authorization_id'] : "" }),
  head: () => integrationHead("Approve agent connection", "Review and approve or cancel an assistant's secure connection to Energy Twin."),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("This connection request is missing or expired. Start the connection again from your assistant.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw redirect({ to: "/login", search: { next: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id");
    if (!id) throw new Error("Missing connection request. Start again from your assistant.");
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (error) throw error;
    if (!data) throw new Error("This connection request is unavailable. Start again from your assistant.");
    if ("redirect_url" in data) throw redirect({ href: data.redirect_url });
    return data;
  },
  errorComponent: ({ error }) => <main className="mx-auto max-w-lg space-y-4 px-4 py-16"><h1 className="text-2xl font-semibold">Connection unavailable</h1><p role="alert" className="text-muted-foreground">{error instanceof Error ? error.message : "Could not load the connection request. Start again from your assistant."}</p><Button asChild variant="outline"><Link to="/">Back to Energy Twin</Link></Button></main>,
  pendingComponent: () => <main className="px-4 py-16 text-center">Loading connection request…</main>,
  component: Consent,
});
function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = approve ? await supabase.auth.oauth.approveAuthorization(authorization_id) : await supabase.auth.oauth.denyAuthorization(authorization_id);
      if (result.error) throw result.error;
      if (!result.data?.redirect_url) throw new Error("The connection did not return a destination. Please try again.");
      window.location.assign(result.data.redirect_url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not complete your choice. Please try again."); setBusy(false); }
  }
  const scopes = details.scope.split(/\s+/).filter(Boolean);
  const labels: Record<string, string> = { openid: "Identify your account", email: "Share your email address", profile: "Share your basic profile" };
  return <main className="mx-auto w-full max-w-lg space-y-6 px-4 py-16">
    <p className="text-lg font-semibold text-primary">Energy Twin</p>
    <h1 className="text-2xl font-semibold">Connect {details.client.name} to Energy Twin</h1>
    <p className="text-muted-foreground">This lets {details.client.name} use this app as you.</p>
    <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Signed in as</dt><dd className="break-words">{details.user.email}</dd></div><div><dt className="text-muted-foreground">Returns to</dt><dd className="break-all">{details.redirect_uri}</dd></div></dl>
    <ul className="space-y-2 text-sm">{scopes.map((scope) => <li key={scope}>{labels[scope] ?? `Additional permission requested: ${scope}`}</li>)}</ul>
    <div className="space-y-2 border-y border-border py-4 text-sm"><p>Read synthetic hotel demos and available stress-test descriptions.</p><p className="text-muted-foreground">This connection cannot read your open tab, current results, saved scenarios, or advisor conversation.</p><p className="text-muted-foreground">This does not bypass this app’s permissions or data access rules.</p></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex gap-3"><Button disabled={busy} onClick={() => decide(true)}>Approve connection</Button><Button variant="outline" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button></div>
    <Button variant="ghost" size="sm" disabled={busy} onClick={async () => { setBusy(true); const result = await supabase.auth.signOut(); if (result.error) { setError(result.error.message); setBusy(false); } else window.location.reload(); }}>Switch account</Button>
  </main>;
}