import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import type { ReactNode } from "react";

/** Wraps any number/element with a plain-language explanation tooltip. */
export function InfoTip({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {children ? <span className="cursor-help">{children}</span> : (
          <button type="button" aria-label="More info" className="inline-flex text-text-muted hover:text-foreground"><Info className="h-3.5 w-3.5" /></button>
        )}
      </TooltipTrigger>
      <TooltipContent className="max-w-60 border border-glass-border bg-panel text-foreground">{text}</TooltipContent>
    </Tooltip>
  );
}
