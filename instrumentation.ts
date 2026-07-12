export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || !process.env.NEXT_RUNTIME) {
    const { loadOryCMSPersistedCollectionsOnStartup } = await import("@/schema");
    await loadOryCMSPersistedCollectionsOnStartup().catch((error) => {
      console.warn("OryCMS: persisted collection registry load failed.", error);
    });
  }
}
