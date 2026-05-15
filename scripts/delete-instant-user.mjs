import { readFileSync } from "node:fs";
import { init } from "@instantdb/admin";

function readEnv() {
  const env = {};

  try {
    const text = readFileSync(".env", "utf8");

    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);

      if (match) {
        env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // The script also supports regular process.env values.
  }

  return { ...env, ...process.env };
}

const email = process.argv[2]?.trim().toLowerCase();

if (!email) {
  console.error("Usage: node scripts/delete-instant-user.mjs user@example.com");
  process.exit(1);
}

if (email === "milanovic.sini@gmail.com") {
  console.error("Refusing to delete the owner account.");
  process.exit(1);
}

const env = readEnv();
const appId = env.EXPO_PUBLIC_INSTANT_APP_ID;
const adminToken = env.INSTANT_APP_ADMIN_TOKEN;

if (!appId || !adminToken) {
  console.error("Missing EXPO_PUBLIC_INSTANT_APP_ID or INSTANT_APP_ADMIN_TOKEN.");
  process.exit(1);
}

const db = init({ appId, adminToken });
const deleted = await db.auth.deleteUser({ email });

console.log(`Deleted ${deleted.email ?? email} from InstantDB.`);
