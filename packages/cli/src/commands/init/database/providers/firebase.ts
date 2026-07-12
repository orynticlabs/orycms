import type { DatabaseProviderDefinition } from "../types";

export const firebaseProvider: DatabaseProviderDefinition = {
  name: "Firebase",

  validateConfig(env = {}) {
    const errors: string[] = [];
    if (!env["FIREBASE_PROJECT_ID"]) errors.push("FIREBASE_PROJECT_ID is required");
    if (!env["FIREBASE_PRIVATE_KEY"]) errors.push("FIREBASE_PRIVATE_KEY is required");
    if (!env["FIREBASE_CLIENT_EMAIL"]) errors.push("FIREBASE_CLIENT_EMAIL is required");
    return errors;
  },

  requiredPackages() {
    return ["firebase-admin"];
  },

  generateEnvVariables() {
    return [
      "FIREBASE_PROJECT_ID=your-project-id",
      "FIREBASE_PRIVATE_KEY=your-private-key",
      "FIREBASE_CLIENT_EMAIL=service@your-project.iam.gserviceaccount.com",
    ];
  },

  connectionInstructions() {
    return `
Firebase connection:
  Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL in your .env file.
  Generate a service account key at: https://console.firebase.google.com → Project Settings → Service Accounts

  The private key contains newlines — wrap it in double quotes in your .env file.
`.trim();
  },

  migrationInstructions() {
    return `
Firebase migrations:
  Firestore is schemaless — collections are created automatically on first write.

  For security rules deployment use the Firebase CLI:
    firebase deploy --only firestore:rules
`.trim();
  },

  seedInstructions() {
    return `
Firebase seed:
  Create a seed script at scripts/seed.ts and run:
    npx tsx scripts/seed.ts

  Example:
    import { initializeApp, cert } from "firebase-admin/app";
    import { getFirestore } from "firebase-admin/firestore";
    initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID!, privateKey: process.env.FIREBASE_PRIVATE_KEY!, clientEmail: process.env.FIREBASE_CLIENT_EMAIL! }) });
    const db = getFirestore();
    await db.collection("orycms_settings").doc("site_name").set({ value: "My Site" });
`.trim();
  },
};
