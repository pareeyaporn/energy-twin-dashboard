import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import { integrationHead } from "@/lib/integration-head";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({ next: oauthReturnPath(search['next']) }),
  head: () => integrationHead("Completing sign-in", "Complete secure sign-in and return to your Energy Twin connection."),
  component: Callback,
});
function Callback() {
  const { next } = Route.useSearch();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const finish = () => { if (active) window.location.replace(next); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (session) finish(); });
    void supabase.auth.getSession().then(({ data }) => { if (data.session) finish(); });
    const timer = window.setTimeout(() => { if (active) setFailed(true); }, 12000);
    return () => { active = false; window.clearTimeout(timer); subscription.unsubscribe(); };
  }, [next]);
  return <main className="mx-auto max-w-md space-y-4 px-4 py-16"><h1 className="text-2xl font-semibold">{failed ? "Sign-in is not complete" : "Completing sign-in…"}</h1>{failed && <Button asChild><Link to="/login" search={{ next }}>Return to sign in</Link></Button>}</main>;
}