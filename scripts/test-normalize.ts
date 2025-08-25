import { readFileSync } from "node:fs";
import { normalizeFeed } from "../lib/jobs/normalize"; // ← יחסי, לא "@/..."
const raw = JSON.parse(readFileSync("data/jobs-feed.json", "utf8"));
console.log(normalizeFeed(raw));