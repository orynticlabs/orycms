import type { DatabaseProviderDefinition } from "../types";

export const mongodbProvider: DatabaseProviderDefinition = {
  name: "MongoDB",

  validateConfig(env = {}) {
    const errors: string[] = [];
    if (!env["MONGODB_URI"]) errors.push("MONGODB_URI is required");
    return errors;
  },

  requiredPackages() {
    return ["mongoose"];
  },

  generateEnvVariables() {
    return ["MONGODB_URI=mongodb://localhost:27017/mydb"];
  },

  connectionInstructions() {
    return `
MongoDB connection:
  Set MONGODB_URI in your .env file.
  Format: mongodb://USER:PASSWORD@HOST:PORT/DBNAME

  Local dev with Docker:
    docker run --name orycms-mongo -p 27017:27017 -d mongo:7
`.trim();
  },

  migrationInstructions() {
    return `
MongoDB migrations:
  OryCMS uses Mongoose schemas — collections are created automatically on first use.

  For explicit schema management use migrate-mongo:
    npx migrate-mongo up
`.trim();
  },

  seedInstructions() {
    return `
MongoDB seed:
  Create a seed script at scripts/seed.ts and run:
    npx tsx scripts/seed.ts

  Example:
    import mongoose from "mongoose";
    await mongoose.connect(process.env.MONGODB_URI!);
    await mongoose.connection.collection("orycms_settings").insertOne({ key: "site_name", value: "My Site" });
`.trim();
  },
};
