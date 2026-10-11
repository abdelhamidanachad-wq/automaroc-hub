import { createClient } from "@supabase/supabase-js";
import { decryptSecret, logIntegrationUsage } from "../../server/integration-vault.js";

const ACTOR_ID = "delectable_incubator~avito-ma-scraper---low-cost";
const SOURCE = "authorized_import";
const MAX_ITEMS = 1000;
const ALLOWED_HOSTS = new Set(["avito.ma", "www.avito.ma"]);

const requiredEnv = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function json(res, status, body) {
  return res.status(status).json(body);
}

function isValidAvitoUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (ALLOWED_HOSTS.has(url.hostname) || url.hostname.endsWith(".avito.ma")) &&
      url.toString().length <= 2048;
  } catch {
    return false;
  }
}

function normalizeNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const digits = String(value).replace(/[^\d.,-]/g, "").replace(",", ".");
  const result = Number(digits);
  return Number.isFinite(result) ? result : null;
}

function firstValue(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function mapListing(item, ownerId) {
  const sourceUrl = firstValue(item, ["url", "listingUrl", "link", "adUrl", "canonicalUrl"]);
  const reference = firstValue(item, ["id", "listingId", "adId", "reference", "ref"]) || sourceUrl;
  if (!sourceUrl || !reference || !isValidAvitoUrl(sourceUrl)) return null;

  const brand = firstValue(item, ["brand", "make", "vehicleBrand", "marque"]);
  const model = firstValue(item, ["model", "vehicleModel", "modele"]);
  const year = normalizeNumber(firstValue(item, ["year", "vehicleYear", "annee"]));
  const price = normalizeNumber(firstValue(item, ["price", "priceMAD", "price_mad", "prix"]));
  const city = firstValue(item, ["city", "location", "region", "ville"]);
  if (!brand || !model || !year || year < 1950 || year > 2100 || !price || price <= 0 || !city) return null;

  const rawCategory = String(firstValue(item, ["category", "vehicleType", "type"]) || "Cars").toLowerCase();
  const category = rawCategory.includes("moto") ? "Motos"
    : rawCategory.includes("scooter") ? "Scooters"
    : rawCategory.includes("truck") || rawCategory.includes("camion") ? "Trucks"
    : "Cars";
  const rawListingType = String(firstValue(item, ["listing_type", "listingType", "condition"]) || "Occasion").toLowerCase();
  const listingType = rawListingType.includes("neuf") || rawListingType.includes("new") ? "Neuf" : "Occasion";
  const image = firstValue(item, ["imageUrl", "image", "mainImage", "image_url", "thumbnail"]);
  const description = firstValue(item, ["description", "title", "name", "titre"]);

  return {
    owner_id: ownerId,
    source: SOURCE,
    source_reference: String(reference).slice(0, 300),
    source_url: new URL(sourceUrl).toString(),
    source_authorized: true,
    category,
    brand: String(brand).trim().slice(0, 60),
    model: String(model).trim().slice(0, 100),
    year: Math.trunc(year),
    price_mad: price,
    fuel: String(firstValue(item, ["fuel", "fuelType", "carburant"]) || "Autre").slice(0, 60),
    mileage_km: Math.max(0, Math.trunc(normalizeNumber(firstValue(item, ["mileage", "mileageKm", "kilometers", "kilometrage"])) || 0)),
    listing_type: listingType,
    city: String(city).trim().slice(0, 120),
    image_url: image && /^https?:\/\//i.test(String(image)) ? String(image).slice(0, 2048) : null,
    description: description ? String(description).slice(0, 5000) : null,
    status: "pending",
  };
}

async function apifyRequest(path, token, options = {}) {
  const response = await fetch(`https://api.apify.com/v2${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || `Apify returned HTTP ${response.status}`;
    console.error("Apify API error:", response.status, message);
    throw new Error("The Apify request failed. Check the actor configuration and server logs.");
  }
  return payload?.data ?? payload;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Use POST." });
  }

  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length) return json(res, 500, { error: `Server configuration missing: ${missing.join(", ")}` });
  if (process.env.AVITO_IMPORT_AUTHORIZED !== "true") {
    return json(res, 403, { error: "Imports are disabled. Confirm that you have permission to collect and reuse this source data before enabling imports." });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  try {
    const authHeader = req.headers.authorization || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!accessToken) return json(res, 401, { error: "Please sign in again." });

    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !authData.user) return json(res, 401, { error: "Invalid or expired session." });

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "superadmin")
      .maybeSingle();

    if (roleError || !role) return json(res, 403, { error: "Superadmin access required." });

    const { data: apifyConfig, error: apifyConfigError } = await supabase
      .from("integration_secrets").select("encrypted_secret,enabled").eq("provider", "apify").maybeSingle();
    if (apifyConfigError) return json(res, 500, { error: "Could not read Apify integration settings." });
    let apifyToken = process.env.APIFY_API_TOKEN || "";
    if (apifyConfig) {
      if (!apifyConfig.enabled) return json(res, 403, { error: "Apify is disabled in the superadmin integrations settings." });
      apifyToken = decryptSecret(apifyConfig.encrypted_secret);
    }
    if (!apifyToken) return json(res, 500, { error: "Configure and enable Apify in the superadmin integrations page." });

    const { action } = req.body || {};

    if (action === "start") {
      const targetUrl = String(req.body.targetUrl || "").trim();
      if (!isValidAvitoUrl(targetUrl)) return json(res, 400, { error: "Enter a valid HTTPS Avito.ma URL." });
      if (req.body.confirmAuthorized !== true) {
        return json(res, 400, { error: "Confirm that you are authorized to collect and reuse the data at this URL." });
      }

      // Verify the actor's Input schema in Apify Store. This actor input currently
      // assumes the common startUrls shape; adapt it if the actor documents another schema.
      const run = await apifyRequest(`/acts/${encodeURIComponent(ACTOR_ID)}/runs`, apifyToken, {
        method: "POST",
        body: JSON.stringify({ startUrls: [{ url: targetUrl }] }),
      });
      if (!run?.id) throw new Error("Apify did not return a run ID.");

      const { error: insertError } = await supabase.from("scrape_runs").insert({
        run_id: run.id,
        requested_by: authData.user.id,
        target_url: targetUrl,
        status: "running",
      });
      if (insertError) {
        console.error("Could not save scrape run:", insertError.message);
        return json(res, 500, { error: "The run started but tracking could not be saved. Check server logs." });
      }
      await logIntegrationUsage(supabase, "apify", "avito_scrape_run", 1, "success");
      return json(res, 202, { runId: run.id, status: "running" });
    }

    if (action === "status") {
      const runId = String(req.body.runId || "").trim();
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(runId)) return json(res, 400, { error: "Invalid run ID." });

      const { data: record, error: recordError } = await supabase
        .from("scrape_runs")
        .select("run_id,requested_by,target_url,status,imported_count,imported_at")
        .eq("run_id", runId)
        .maybeSingle();

      if (recordError || !record) return json(res, 404, { error: "Run not found." });
      if (record.requested_by !== authData.user.id) {
        return json(res, 403, { error: "Only the administrator who started this run can inspect it." });
      }
      if (record.imported_at) {
        return json(res, 200, { status: "completed", importedCount: record.imported_count });
      }

      const run = await apifyRequest(`/actor-runs/${encodeURIComponent(runId)}`, apifyToken);
      if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
        await supabase.from("scrape_runs").update({
          status: run.status.toLowerCase(),
          error_message: "The Apify run did not complete successfully.",
        }).eq("run_id", runId);
        return json(res, 200, { status: run.status.toLowerCase() });
      }
      if (run.status !== "SUCCEEDED") return json(res, 200, { status: "running" });

      const ownerId = process.env.AUTHORIZED_IMPORT_OWNER_ID;
      if (!ownerId) return json(res, 500, { error: "Set AUTHORIZED_IMPORT_OWNER_ID to the UUID of the authorized inventory owner in Vercel." });

      const datasetId = run.defaultDatasetId;
      if (!datasetId) throw new Error("Apify run has no dataset.");

      const items = await apifyRequest(
        `/datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=true&limit=${MAX_ITEMS}`,
        process.env.APIFY_API_TOKEN
      );
      if (!Array.isArray(items)) throw new Error("The actor returned an unexpected dataset format.");

      const rows = items.map((item) => mapListing(item, ownerId)).filter(Boolean);
      let importedCount = 0;
      if (rows.length) {
        const { data, error: upsertError } = await supabase
          .from("listings")
          .upsert(rows, { onConflict: "source,source_reference", ignoreDuplicates: false })
          .select("id");
        if (upsertError) {
          console.error("Listing import failed:", upsertError.message);
          return json(res, 500, { error: "Could not save listings. Check database schema and server logs." });
        }
        importedCount = data?.length ?? rows.length;
      }

      const { error: updateError } = await supabase.from("scrape_runs").update({
        status: "completed",
        imported_count: importedCount,
        imported_at: new Date().toISOString(),
        error_message: null,
      }).eq("run_id", runId).is("imported_at", null);

      if (updateError) {
        console.error("Could not finalize scrape run:", updateError.message);
        return json(res, 500, { error: "Listings were saved, but run tracking could not be finalized." });
      }

      return json(res, 200, {
        status: "completed",
        datasetCount: items.length,
        importedCount,
        skippedCount: items.length - rows.length,
        limit: MAX_ITEMS,
        moderation: "pending",
      });
    }

    return json(res, 400, { error: "action must be start or status." });
  } catch (error) {
    console.error("Admin scrape endpoint error:", error);
    return json(res, 500, { error: error.message?.startsWith("The Apify request failed") ? error.message : "Scraping failed. Check actor input, database configuration, and server logs." });
  }
}
