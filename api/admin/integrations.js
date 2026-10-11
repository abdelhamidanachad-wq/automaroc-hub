import { encryptSecret, getAdminSupabase, requireSuperadmin, logIntegrationUsage, readIntegrationSecret, assertIntegrationCallAllowed } from "../../server/integration-vault.js";

const PROVIDERS = {
  google_maps: { label: "Google Maps Platform", description: "Geocoding, Places, Routes and map services", test: testGoogleMaps },
  apify: { label: "Apify", description: "Authorized data collection jobs", test: testApify },
  openai: { label: "OpenAI", description: "AI assistants and language models", test: testOpenAI },
  anthropic: { label: "Anthropic", description: "Claude AI assistants", test: testAnthropic },
  google_ai: { label: "Google AI", description: "Gemini models", test: testGoogleAI },
};
function send(res, status, body) { return res.status(status).json(body); }
function safeProvider(provider) { return Object.prototype.hasOwnProperty.call(PROVIDERS, provider); }

async function testGoogleMaps(key) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", "Casablanca, Morocco"); url.searchParams.set("key", key);
  const response = await fetch(url); const body = await response.json();
  const ok = response.ok && ["OK", "ZERO_RESULTS"].includes(body.status);
  return { ok, message: ok ? "Google Maps key accepted." : "Google Maps response: " + (body.error_message || body.status || response.status) };
}
async function testApify(key) {
  const response = await fetch("https://api.apify.com/v2/users/me", { headers: { Authorization: "Bearer " + key } });
  return { ok: response.ok, message: response.ok ? "Apify token accepted." : "Apify returned HTTP " + response.status + "." };
}
async function testOpenAI(key) {
  const response = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: "Bearer " + key } });
  return { ok: response.ok, message: response.ok ? "OpenAI API key accepted." : "OpenAI returned HTTP " + response.status + "." };
}
async function testAnthropic(key) {
  const response = await fetch("https://api.anthropic.com/v1/models?limit=1", { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
  return { ok: response.ok, message: response.ok ? "Anthropic API key accepted." : "Anthropic returned HTTP " + response.status + "." };
}
async function testGoogleAI(key) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(key));
  return { ok: response.ok, message: response.ok ? "Google AI key accepted." : "Google AI returned HTTP " + response.status + "." };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "DELETE"].includes(req.method)) { res.setHeader("Allow", "GET, POST, DELETE"); return send(res, 405, { error: "Method not allowed." }); }
  try {
    const supabase = getAdminSupabase();
    const auth = await requireSuperadmin(req, supabase);
    if (auth.error) return send(res, auth.status, { error: auth.error });

    if (req.method === "GET") {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [settings, events] = await Promise.all([
        supabase.from("integration_secrets").select("provider,enabled,monthly_budget_usd,daily_limit,updated_at"),
        supabase.from("integration_usage").select("provider,feature,units,outcome,created_at").gte("created_at", since).limit(5000),
      ]);
      if (settings.error || events.error) return send(res, 500, { error: "Could not load integrations. Apply the integrations migration." });
      const integrations = Object.entries(PROVIDERS).map(([provider, info]) => {
        const row = (settings.data || []).find(x => x.provider === provider);
        const usage = (events.data || []).filter(x => x.provider === provider);
        const features = {};
        usage.forEach(x => { features[x.feature] = (features[x.feature] || 0) + 1; });
        return {
          provider, label: info.label, description: info.description, configured: Boolean(row),
          enabled: Boolean(row?.enabled), monthlyBudgetUsd: Number(row?.monthly_budget_usd || 0),
          dailyLimit: Number(row?.daily_limit || 0), updatedAt: row?.updated_at || null,
          usage30d: { calls: usage.length, units: usage.reduce((n, x) => n + (x.units || 1), 0), errors: usage.filter(x => x.outcome !== "success").length, features },
        };
      });
      return send(res, 200, { integrations });
    }

    const body = req.body || {};
    const provider = String(body.provider || "");
    if (!safeProvider(provider)) return send(res, 400, { error: "Unknown provider." });

    if (req.method === "DELETE") {
      const { error } = await supabase.from("integration_secrets").delete().eq("provider", provider);
      if (error) return send(res, 500, { error: "Could not remove integration." });
      return send(res, 200, { ok: true });
    }

    if (body.action === "test") {
      const limit = await assertIntegrationCallAllowed(supabase, provider);
      if (!limit.allowed) return send(res, 429, { error: limit.reason });
      const key = await readIntegrationSecret(supabase, provider);
      if (!key) return send(res, 400, { error: "Save and enable a key before testing it." });
      const result = await PROVIDERS[provider].test(key);
      await logIntegrationUsage(supabase, provider, "admin_key_test", 1, result.ok ? "success" : "error");
      return send(res, result.ok ? 200 : 422, result);
    }

    const secret = String(body.secret || "").trim();
    const { data: old, error: oldError } = await supabase.from("integration_secrets").select("encrypted_secret").eq("provider", provider).maybeSingle();
    if (oldError) return send(res, 500, { error: "Could not load current integration." });
    const encryptedSecret = secret ? encryptSecret(secret) : old?.encrypted_secret;
    if (!encryptedSecret) return send(res, 400, { error: "Enter an API key before saving this integration." });
    const monthlyBudget = Number(body.monthlyBudgetUsd || 0);
    const dailyLimit = Number(body.dailyLimit || 0);
    if (!Number.isFinite(monthlyBudget) || monthlyBudget < 0 || monthlyBudget > 1000000 || !Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 10000000) {
      return send(res, 400, { error: "Invalid budget or daily limit." });
    }
    const { error } = await supabase.from("integration_secrets").upsert({
      provider, encrypted_secret: encryptedSecret, enabled: body.enabled === true,
      monthly_budget_usd: monthlyBudget, daily_limit: dailyLimit, updated_by: auth.user.id, updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });
    if (error) return send(res, 500, { error: "Could not save integration. Check the database migration." });
    return send(res, 200, { ok: true, provider, enabled: body.enabled === true });
  } catch (error) {
    console.error("Integration API error:", error);
    return send(res, 500, { error: String(error.message || "").includes("APP_ENCRYPTION_KEY") ? error.message : "Integration service failed. Check server configuration." });
  }
}
