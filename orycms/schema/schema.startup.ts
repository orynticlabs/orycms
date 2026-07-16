import { getOryCMSPool } from "@/lib/db";
import { loadOryCMSCollectionsIntoRegistry } from "./schema.persistence";

let loadPromise: Promise<void> | null = null;

export function loadOryCMSPersistedCollectionsOnStartup(): Promise<void> {
  if (!process.env.ORYCMS_DATABASE_URL) return Promise.resolve();

  loadPromise ??= loadOryCMSCollectionsIntoRegistry(getOryCMSPool()).then(() => undefined);
  return loadPromise;
}

export function resetOryCMSStartupLoaderForTests(): void {
  loadPromise = null;
}
