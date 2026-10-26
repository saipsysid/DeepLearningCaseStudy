/**
 * Load environment variables before any other backend module runs.
 * We look in a few common places so `npm run dev` works from /backend
 * or from the repo root.
 */

import dotenv from "dotenv";
import path from "path";

const candidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
  path.resolve(__dirname, "../../../.env"),
];

for (const file of candidates) {
  dotenv.config({ path: file });
}
