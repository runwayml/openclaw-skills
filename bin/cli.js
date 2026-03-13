#!/usr/bin/env node

import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;

if (!RUNWAYML_API_SECRET) {
  console.log(`
  ╔══════════════════════════════════════════════════════════╗
  ║  Missing RUNWAYML_API_SECRET                             ║
  ║                                                          ║
  ║  1. Get an API key at https://dev.runwayml.com           ║
  ║  2. Run:  export RUNWAYML_API_SECRET=your_key            ║
  ║  3. Then:  npx openclaw-video-call                       ║
  ╚══════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

const serverPath = path.join(root, "dist/server/index.js");

import(serverPath).catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
