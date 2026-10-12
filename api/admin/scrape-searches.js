import { getAdminSupabase, requireSuperadmin } from "../../server/integration-vault.js";

const ALLOWED_HOSTS = new Set(["avito.ma", "www.avito.ma"]);
const STATUSES = new Set(["pending", "queued", "running", "completed", "failed", "skipped"]);

function send(res, status, body) {
  return res.status(status).json(body);
}

function isValidAvitoUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" &&
      ALLOWED_HOSTS.has(url.hostname) &&
      !url.username && !url.password && !url.port &&
      url.toString().length <= 2048;
  } catch {
    return false;
  }
}

function normalizeSearch(input, userId, existing = {}) {
  const search = input || {};
  const name = String(search.name ?? existing.name ?? "").trim();
  const targetUrl = String(search.target_url ?? search.targetUrl ?? existing.target_url ?? "").trim();
  const maxPages = Math.max(1, Math.min(50, Math.trunc(Number(search.max_pages ?? existing.max_pages ?? 5) || 5)));
  const city = String(search.city ?? existing.city ?? "Maroc").trim().slice(0, 120) || "Maroc";
  const brand = String(search.brand ?? existing.brand ?? "").trim().slice(0, 80) || null;
  const model = String(search.model ?? existing.model ?? "").trim().slice(0, 120) || null;
  if (name.length < 2 || name.length > 160) throw new Error("Le nom doit contenir entre 2 et 160 caractères.");
  if (!isValidAvitoUrl(targetUrl)) throw new Error("Utilisez une URL HTTPS exacte de avito.ma ou www.avito.ma.");
  return {
    name, brand, model, city, target_url: targetUrl,
    max_pages: maxPages,
    enabled: search.enabled === undefined ? (existing.enabled ?? true) : search.enabled === true,
    // Authorization must be reconfirmed by an explicit save action; never inherited from client-supplied fields.
    authorized_by: userId,
    authorization_confirmed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function startWorkflow(searchId) {
  const owner = process.env.GITHUB_ACTIONS_OWNER || "abdelhamidanachad-wq";
  const repo = process.env.GITHUB_ACTIONS_REPO || "automaroc-hub";
  const workflow = process.env.GITHUB_SCRAPE_WORKFLOW || "scrape-avito.yml";
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) throw new Error("Le lancement direct n’est pas configuré. Utilisez GitHub Actions > MOROTTO authorized Avito import.");
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { search_id: searchId, dry_run: "false" } }),
  });
  if (response.status !== 204) {
    // Do not return any response headers or token material to the browser.
    throw new Error(`GitHub Actions n’a pas accepté le lancement (HTTP ${response.status}).`);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return send(res, 405, { error: "Method not allowed." });
  }

  try {
    const db = getAdminSupabase();
    const auth = await requireSuperadmin(req, db);
    if (auth.error) return send(res, auth.status, { error: auth.error });

    if (req.method === "GET") {
      const [searches, runs, events] = await Promise.all([
        db.from("scrape_searches").select("*").order("created_at", { ascending: false }).limit(500),
        db.from("scrape_runs").select("*").order("created_at", { ascending: false }).limit(100),
        db.from("scrape_run_events").select("id,run_id,search_id,level,event,message,created_at").order("created_at", { ascending: false }).limit(100),
      ]);
      if (searches.error || runs.error || events.error) {
        console.error("Scraper history query failed:", searches.error?.message, runs.error?.message, events.error?.message);
        return send(res, 500, { error: "L’historique du scraper est indisponible. Vérifiez que la migration avito_search_queue_and_run_history est appliquée." });
      }
      const normalizedSearches = (searches.data || []).map(item => ({
        ...item,
        last_status: item.last_status || "pending",
      }));
      const count = { total: normalizedSearches.length, pending: 0, running: 0, completed: 0, failed: 0, disabled: 0 };
      for (const item of normalizedSearches) {
        if (!item.enabled) count.disabled++;
        if (item.enabled && ["pending", "queued"].includes(item.last_status)) count.pending++;
        if (item.last_status === "running") count.running++;
        if (item.last_status === "completed") count.completed++;
        if (item.last_status === "failed") count.failed++;
      }
      return send(res, 200, { searches: normalizedSearches, runs: runs.data || [], events: events.data || [], counts: count });
    }

    const body = req.body || {};
    if (req.method === "POST" && body.action === "save_search") {
      const row = normalizeSearch(body.search, auth.user.id);
      const { data, error } = await db.from("scrape_searches").insert(row).select("*").single();
      if (error) {
        console.error("Create scrape search failed:", error.message);
        return send(res, 500, { error: "Impossible d’enregistrer cette recherche." });
      }
      return send(res, 201, { search: data });
    }

    if (req.method === "PATCH" && body.action === "update_search") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: "ID de recherche invalide." });
      const { data: current, error: readError } = await db.from("scrape_searches").select("*").eq("id", id).maybeSingle();
      if (readError || !current) return send(res, 404, { error: "Recherche introuvable." });
      const patch = {};
      if (body.search) Object.assign(patch, normalizeSearch(body.search, auth.user.id, current));
      if (typeof body.enabled === "boolean") {
        patch.enabled = body.enabled;
        patch.updated_at = new Date().toISOString();
      }
      if (body.confirmAuthorization === true) {
        patch.authorized_by = auth.user.id;
        patch.authorization_confirmed_at = new Date().toISOString();
      }
      if (!Object.keys(patch).length) return send(res, 400, { error: "Aucune modification fournie." });
      const { data, error } = await db.from("scrape_searches").update(patch).eq("id", id).select("*").single();
      if (error) {
        console.error("Update scrape search failed:", error.message);
        return send(res, 500, { error: "Impossible de mettre à jour cette recherche." });
      }
      return send(res, 200, { search: data });
    }

    if (req.method === "POST" && body.action === "run_search") {
      const id = String(body.id || "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) return send(res, 400, { error: "ID de recherche invalide." });
      const { data: search, error } = await db.from("scrape_searches").select("*").eq("id", id).maybeSingle();
      if (error || !search) return send(res, 404, { error: "Recherche introuvable." });
      if (!search.enabled) return send(res, 409, { error: "Cette recherche est désactivée." });
      if (!search.authorization_confirmed_at) return send(res, 409, { error: "Une autorisation doit être confirmée avant le lancement." });
      if (process.env.AVITO_IMPORT_AUTHORIZED !== "true") {
        return send(res, 403, { error: "Les imports sont désactivés côté serveur. Vérifiez AVITO_IMPORT_AUTHORIZED avant de lancer la collecte." });
      }
      try {
        await startWorkflow(id);
      } catch (dispatchError) {
        console.error("GitHub workflow dispatch failed:", dispatchError.message);
        return send(res, 503, { error: dispatchError.message });
      }
      const queuedAt = new Date().toISOString();
      const { error: updateError } = await db.from("scrape_searches").update({
        last_status: "queued",
        last_started_at: queuedAt,
        last_error: null,
        updated_at: queuedAt,
      }).eq("id", id);
      if (updateError) console.error("Search queue status could not be saved:", updateError.message);
      return send(res, 202, { ok: true, status: "queued", searchId: id });
    }

    if (req.method === "POST" && body.action === "retry_search") {
      // Retry is deliberately routed through the same authorization and dispatch validation.
      return send(res, 400, { error: "Utilisez run_search pour relancer la recherche après vérification de son URL et de son autorisation." });
    }

    return send(res, 400, { error: "Action non reconnue." });
  } catch (error) {
    console.error("Scraper admin API error:", error);
    return send(res, 500, { error: error?.message || "Le service de suivi du scraper a échoué." });
  }
}
