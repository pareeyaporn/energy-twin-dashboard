import { useTwin } from "@/store/useTwin";
import { PresetCard } from "./PresetCard";
import { HomeForm } from "./HomeForm";
import { CostSummary } from "./CostSummary";

export function HomePanel() {
  const { presets, selectedPresetId, selectPreset } = useTwin();
  return (
    <div className="flex h-full flex-col">
      <h2 className="px-6 pt-6 text-xl font-semibold">Your Home</h2>
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <section>
          <p className="label-caps mb-3">Start with a sample home</p>
          <div role="radiogroup" aria-label="Sample homes" className="space-y-2">
            {presets.map((p) => <PresetCard key={p.id} preset={p} selected={p.id === selectedPresetId} onSelect={() => selectPreset(p.id)} />)}
          </div>
        </section>
        <div className="flex items-center gap-3"><div className="h-px flex-1 bg-border" /><span className="label-caps text-[11px]">Or enter your own</span><div className="h-px flex-1 bg-border" /></div>
        <HomeForm />
      </div>
      <div className="border-t border-border p-4"><CostSummary /></div>
    </div>
  );
}
