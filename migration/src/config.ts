import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import path from "node:path";

// Node 20.6+ native .env loader -- no `dotenv` dependency needed.
const envPath = path.resolve(import.meta.dirname, "..", ".env");
if (existsSync(envPath)) loadEnvFile(envPath);

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env var ${name} -- copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return v;
}

const args = process.argv.slice(2);
const isDryRun = !args.includes("--run");
if (!args.includes("--dry-run") && !args.includes("--run")) {
  console.log("No --dry-run or --run flag given -- defaulting to --dry-run (nothing will be written).\n");
}

const schema = process.env.MIGRATE_SCHEMA?.trim();
if (schema !== "qa" && schema !== "prod") {
  console.error(`MIGRATE_SCHEMA must be exactly "qa" or "prod" (got ${JSON.stringify(schema)}).`);
  process.exit(1);
}
if (schema === "prod" && process.env.MIGRATE_CONFIRM_PROD !== "yes") {
  console.error(
    'Refusing to run against "prod" -- set MIGRATE_CONFIRM_PROD=yes in .env if this is really intentional.',
  );
  process.exit(1);
}

export const config = {
  schema: schema as "qa" | "prod",
  dryRun: isDryRun,
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  googleServiceAccountKeyFile: path.resolve(
    import.meta.dirname,
    "..",
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE ?? "./service-account.json",
  ),
};

console.log(`Schema: ${config.schema}  |  Mode: ${config.dryRun ? "DRY RUN (no writes)" : "REAL RUN (will write)"}\n`);
