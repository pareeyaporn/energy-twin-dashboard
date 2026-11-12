// Small DOM helpers for the tour: switch the workspace tab the way a click would, read which tab is open, wait for an element.
import type { WorkspaceTab } from "./steps";

const tabs = () => Array.from(document.querySelectorAll<HTMLElement>('aside[aria-label="Workspace"] [role="tab"]'));
const tabName = (el: HTMLElement) => (el.textContent ?? "").replace(/^\d+/, "").trim();

/** The workspace tab that is open, or null off the main page. */
export function currentWorkspaceTab(): WorkspaceTab | null {
  const el = tabs().find((t) => t.getAttribute("aria-selected") === "true" || t.dataset["state"] === "active");
  return el ? (tabName(el) as WorkspaceTab) : null;
}

/** Opens a workspace tab as a click would (the tabs respond to a primary-button press). Returns false if the tab is not there. */
export function openWorkspaceTab(tab: WorkspaceTab): boolean {
  const el = tabs().find((t) => tabName(t) === tab);
  if (!el) return false;
  if (el.getAttribute("aria-selected") === "true") return true;
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
  el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, button: 0 }));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
  return true;
}

/** Resolves with the result of `find` once it is non-empty, or with [] after `timeoutMs`. */
export function waitFor(find: () => Element[], timeoutMs = 2500, signal?: { cancelled: boolean }): Promise<Element[]> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (signal?.cancelled) return resolve([]);
      const found = find();
      if (found.length) return resolve(found);
      if (Date.now() - started > timeoutMs) return resolve([]);
      setTimeout(tick, 80);
    };
    tick();
  });
}
