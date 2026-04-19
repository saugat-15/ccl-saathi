const STORAGE_KEY = "ccl-saathi-progress-v1";

export type ProgressPayload = {
  v: 1;
  completedDialoguePaths: string[];
};

function readRaw(): ProgressPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as ProgressPayload).v === 1 &&
      Array.isArray((parsed as ProgressPayload).completedDialoguePaths)
    ) {
      return parsed as ProgressPayload;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function markDialogueCompleted(dialogueBasePath: string) {
  if (typeof window === "undefined") return;
  const prev = readRaw();
  const completedDialoguePaths = prev?.completedDialoguePaths ?? [];
  if (completedDialoguePaths.includes(dialogueBasePath)) return;
  const next: ProgressPayload = {
    v: 1,
    completedDialoguePaths: [...completedDialoguePaths, dialogueBasePath],
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

/** Count completed dialogues under `dialogues/{categorySlug}/` from stored base paths. */
export function countCompletedInCategory(categorySlug: string): number {
  const data = readRaw();
  if (!data) return 0;
  const prefix = `dialogues/${categorySlug}/`;
  return data.completedDialoguePaths.filter((p) => p.startsWith(prefix)).length;
}

export function subscribeProgress(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener("storage", handler);
  window.addEventListener("ccl-saathi-progress", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("ccl-saathi-progress", handler);
  };
}

export function notifyProgressUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("ccl-saathi-progress"));
}
