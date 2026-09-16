// ─────────────────────────────────────────────────────────────────────────────
// Tiny zero-router navigation helpers.
//
// App.tsx switches on window.location.pathname and listens to `popstate`, so
// any component can move the app by pushing a history entry and firing that
// event. A one-shot flag lets a screen ask for the wizard (not the name-entry
// landing page) to open on the next visit to "/" — used after loading a cloud
// character from the table.
// ─────────────────────────────────────────────────────────────────────────────

export const CHARACTERS_PATH = '/Characters';
export const COACH_PATH = '/Coach';

let openWizardNext = false;

/** Push `to` and notify App's popstate listener. No-op when already there. */
export function navigateTo(to: string): void {
  if (window.location.pathname !== to) {
    window.history.pushState({}, '', to);
  }
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** Ask the builder to open straight into the wizard on its next mount. */
export function requestWizardOnReturn(): void {
  openWizardNext = true;
}

/** Read-and-clear the flag; AppInner calls this once when it mounts. */
export function consumeWizardRequest(): boolean {
  const value = openWizardNext;
  openWizardNext = false;
  return value;
}
