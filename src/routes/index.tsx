import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Energy Twin — Digital energy dashboard" },
      { name: "description", content: "Energy Twin: monitor and simulate your energy system in one view." },
      { property: "og:title", content: "Energy Twin" },
      { property: "og:description", content: "Monitor and simulate your energy system in one view." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Panel({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <span className="h-3 w-3 rounded-full bg-primary shadow-[var(--shadow-glow)]" />
        <h1 className="text-lg font-semibold tracking-tight">Energy Twin</h1>
      </header>
      <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[280px_1fr_300px]">
        <aside className="flex flex-col gap-4">
          <Panel title="Assets"><p className="text-sm text-muted-foreground">No assets yet.</p></Panel>
        </aside>
        <section className="flex min-h-[60vh] items-center justify-center rounded-lg border border-border bg-card">
          <p className="text-muted-foreground">Twin view</p>
        </section>
        <aside className="flex flex-col gap-4">
          <Panel title="Details"><p className="text-sm text-muted-foreground">Select an item.</p></Panel>
        </aside>
      </main>
    </div>
  );
}
