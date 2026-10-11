import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function encryptionKey() {
  const value = process.env.APP_ENCRYPTION_KEY || "";
  if (!/^[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error("APP_ENCRYPTION_KEY must be a 64-character hex string (32 random bytes).");
  }
  return Buffer.from(value, "hex");
}

export function encryptSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptSecret(value) {
  const parts = String(value || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted secret.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(parts[0], "base64"));
  decipher.setAuthTag(Buffer.from(parts[1], "base64"));
  return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64")), decipher.final()]).toString("utf8");
}

export function getAdminSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Server-side Supabase credentials are missing.");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function requireSuperadmin(req, supabase) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Authentication required.", status: 401 };
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return { error: "Invalid or expired session.", status: 401 };
  const { data: role, error: roleError } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "superadmin").maybeSingle();
  if (roleError || !role) return { error: "Superadmin access required.", status: 403 };
  return { user: data.user };
}

export async function readIntegrationSecret(supabase, provider) {
  const { data, error } = await supabase.from("integration_secrets").select("encrypted_secret,enabled").eq("provider", provider).maybeSingle();
  if (error) throw new Error("Could not read integration settings.");
  if (!data?.enabled || !data.encrypted_secret) return null;
  return decryptSecret(data.encrypted_secret);
}

export async function logIntegrationUsage(supabase, provider, feature, units = 1, outcome = "success") {
  const { error } = await supabase.from("integration_usage").insert({
    provider, feature: String(feature).slice(0, 100),
    units: Math.max(1, Math.min(1000000, Math.trunc(Number(units) || 1))),
    outcome: ["success", "error", "blocked"].includes(outcome) ? outcome : "success",
  });
  if (error) console.error("Integration usage logging failed:", error.message);
}

export async function assertIntegrationCallAllowed(supabase, provider) {
  const { data: config, error } = await supabase.from("integration_secrets")
    .select("enabled,daily_limit").eq("provider", provider).maybeSingle();
  if (error) return { allowed: false, reason: "Could not read integration limits." };
  if (!config) return { allowed: true, managed: false };
  if (!config.enabled) return { allowed: false, reason: "This integration is disabled by the superadmin." };
  if (Number(config.daily_limit || 0) > 0) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { count, error: countError } = await supabase.from("integration_usage")
      .select("id", { count: "exact", head: true })
      .eq("provider", provider).gte("created_at", start.toISOString());
    if (countError) return { allowed: false, reason: "Could not verify the daily usage limit." };
    if ((count || 0) >= Number(config.daily_limit)) {
      await logIntegrationUsage(supabase, provider, "daily_limit_block", 1, "blocked");
      return { allowed: false, reason: "The configured daily API-call limit has been reached." };
    }
  }
  return { allowed: true, managed: true };
}
