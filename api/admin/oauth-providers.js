import { encryptSecret, getAdminSupabase, requireSuperadmin, decryptSecret } from "../../server/integration-vault.js";

const providers = {
  google: { row: "google_oauth", enabled: "external_google_enabled", clientId: "external_google_client_id", secret: "external_google_secret" },
  facebook: { row: "facebook_oauth", enabled: "external_facebook_enabled", clientId: "external_facebook_client_id", secret: "external_facebook_secret" },
};
function send(res, status, body) { return res.status(status).json(body); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "DELETE"].includes(req.method)) { res.setHeader("Allow", "GET, POST, DELETE"); return send(res, 405, { error: "Method not allowed." }); }
  try {
    const supabase = getAdminSupabase();
    const auth = await requireSuperadmin(req, supabase);
    if (auth.error) return send(res, auth.status, { error: auth.error });
    if (req.method === "GET") {
      const { data, error } = await supabase.from("integration_secrets").select("provider,enabled,updated_at").in("provider", ["google_oauth", "facebook_oauth"]);
      if (error) return send(res, 500, { error: "OAuth settings unavailable. Apply migration 008." });
      const rows = data || [];
      return send(res, 200, { providers: ["google", "facebook"].map(name => {
        const row = rows.find(x => x.provider === providers[name].row);
        return { provider: name, configured: Boolean(row), enabled: Boolean(row?.enabled), updatedAt: row?.updated_at || null };
      }) });
    }
    const name = String(req.body?.provider || "");
    const config = providers[name];
    if (!config) return send(res, 400, { error: "Unsupported OAuth provider." });
    if (req.method === "DELETE") {
      const { error } = await supabase.from("integration_secrets").delete().eq("provider", config.row);
      if (error) return send(res, 500, { error: "Could not remove saved OAuth credentials." });
      return send(res, 200, { ok: true, note: "Saved credentials removed. Disable the provider in Supabase Auth if you no longer want it available." });
    }

    const clientId = String(req.body?.clientId || "").trim();
    const clientSecret = String(req.body?.clientSecret || "").trim();
    const enabled = req.body?.enabled === true;
    const { data: old, error: oldError } = await supabase.from("integration_secrets").select("encrypted_secret").eq("provider", config.row).maybeSingle();
    if (oldError) return send(res, 500, { error: "Could not load saved OAuth credentials." });
    let credentials = null;
    if (clientId && clientSecret) credentials = { clientId, clientSecret };
    else if (old?.encrypted_secret) {
      try { credentials = JSON.parse(decryptSecret(old.encrypted_secret)); } catch { return send(res, 500, { error: "Saved credentials could not be decrypted. Check APP_ENCRYPTION_KEY." }); }
      if (clientId) credentials.clientId = clientId;
      if (clientSecret) credentials.clientSecret = clientSecret;
    }
    if (enabled && (!credentials?.clientId || !credentials?.clientSecret)) return send(res, 400, { error: "Enter both the OAuth Client ID and Client Secret before enabling this provider." });
    if (enabled && (!process.env.SUPABASE_ACCESS_TOKEN || !process.env.SUPABASE_PROJECT_REF)) {
      return send(res, 503, { error: "To apply OAuth settings from this panel, configure SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF as server-only Vercel environment variables. No credentials were changed." });
    }

    if (process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_REF && credentials) {
      const patch = { [config.enabled]: enabled, [config.clientId]: credentials.clientId || "", [config.secret]: credentials.clientSecret || "" };
      const response = await fetch("https://api.supabase.com/v1/projects/" + encodeURIComponent(process.env.SUPABASE_PROJECT_REF) + "/config/auth", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + process.env.SUPABASE_ACCESS_TOKEN, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("Supabase Auth config update failed:", response.status, detail.slice(0, 500));
        return send(res, 502, { error: "Supabase rejected the OAuth configuration (HTTP " + response.status + "). Verify the Management API token permissions and project reference." });
      }
    } else if (enabled) {
      return send(res, 503, { error: "Supabase Management API is not configured." });
    }

    const encrypted = credentials ? encryptSecret(JSON.stringify(credentials)) : old?.encrypted_secret;
    if (encrypted) {
      const { error } = await supabase.from("integration_secrets").upsert({
        provider: config.row, encrypted_secret: encrypted, enabled, monthly_budget_usd: 0, daily_limit: 0,
        updated_by: auth.user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "provider" });
      if (error) return send(res, 500, { error: "Supabase Auth was updated, but credentials could not be saved to the vault." });
    }
    return send(res, 200, { ok: true, provider: name, enabled, configured: Boolean(credentials), message: enabled ? "OAuth configuration applied to Supabase Auth." : "Provider disabled in Supabase Auth." });
  } catch (error) {
    console.error("OAuth admin API error:", error);
    return send(res, 500, { error: "OAuth configuration failed. Check server configuration." });
  }
}
