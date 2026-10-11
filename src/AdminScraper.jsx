import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, LoaderCircle, Play, RefreshCw } from "lucide-react";
import { supabase } from "./lib/supabase.js";

export default function AdminScraper({ notify }) {
  const [targetUrl, setTargetUrl] = useState("");
  const [confirmedPermission, setConfirmedPermission] = useState(false);
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);

  async function requestApi(payload) {
    const { data, error } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (error || !token) throw new Error("Votre session a expiré. Reconnectez-vous.");

    const response = await fetch("/api/admin/scrape-avito", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "La requête a échoué.");
    return body;
  }

  async function startScraping(event) {
    event.preventDefault();
    setMessage("");
    setResult(null);
    setRunId("");
    setStatus("starting");
    try {
      const body = await requestApi({
        action: "start",
        targetUrl: targetUrl.trim(),
        confirmAuthorized: confirmedPermission,
      });
      setRunId(body.runId);
      setStatus("running");
      setMessage("Le scraping a démarré. Vérification de l’avancement…");
      notify?.("Import Apify démarré");
    } catch (error) {
      setStatus("error");
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (status !== "running" || !runId) return undefined;
    let cancelled = false;
    let timer;
    let inFlight = false;

    const check = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const body = await requestApi({ action: "status", runId });
        if (cancelled) return;
        if (body.status === "completed") {
          setResult(body);
          setStatus("completed");
          setMessage("Import terminé. Les annonces sont en attente de modération.");
          notify?.(`Import terminé : ${body.importedCount} annonce(s)`);
          return;
        }
        if (["failed", "aborted", "timed-out"].includes(body.status)) {
          setStatus("error");
          setMessage(`Le run Apify s’est terminé avec le statut : ${body.status}`);
          return;
        }
        setMessage("Scraping en cours. Nouvelle vérification dans quelques secondes…");
      } catch (error) {
        if (!cancelled) setMessage(`Vérification temporairement impossible : ${error.message}`);
      } finally {
        inFlight = false;
      }
      if (!cancelled) timer = setTimeout(check, 4000);
    };

    timer = setTimeout(check, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, runId]);

  return (
    <section className="admin-scraper">
      <div className="admin-scraper-heading">
        <div>
          <span className="auth-eyebrow">SOURCE EXTERNE · APIFY</span>
          <h2>Import d’annonces autorisées</h2>
          <p>Lancez un run Apify et suivez son statut. Les annonces importées restent en attente de modération.</p>
        </div>
        <span className="admin-scraper-icon"><Play size={20} /></span>
      </div>

      <form onSubmit={startScraping} className="admin-scraper-form">
        <label htmlFor="avito-target-url">URL de recherche ou d’annonces Avito.ma</label>
        <input
          id="avito-target-url"
          type="url"
          inputMode="url"
          autoComplete="url"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          placeholder="https://www.avito.ma/..."
          required
          disabled={status === "starting" || status === "running"}
        />
        <label className="admin-scraper-consent">
          <input
            type="checkbox"
            checked={confirmedPermission}
            onChange={(event) => setConfirmedPermission(event.target.checked)}
            disabled={status === "starting" || status === "running"}
          />
          <span>Je confirme que MOROTTO est autorisé à collecter et réutiliser les données de cette source, y compris les médias concernés.</span>
        </label>
        <div className="admin-scraper-actions">
          <button
            type="submit"
            disabled={!targetUrl.trim() || !confirmedPermission || status === "starting" || status === "running"}
          >
            {status === "starting" || status === "running"
              ? <><LoaderCircle className="scraper-spin" size={17} /> Scraping en cours…</>
              : <><Play size={17} /> Démarrer le scraping</>}
          </button>
          {(status === "completed" || status === "error") && (
            <button type="button" className="admin-scraper-secondary" onClick={() => {
              setStatus("idle"); setMessage(""); setResult(null); setRunId("");
            }}>
              <RefreshCw size={16} /> Nouveau run
            </button>
          )}
        </div>
      </form>

      {message && (
        <div className={`admin-scraper-message ${status}`} role="status" aria-live="polite">
          {status === "error" ? <AlertCircle size={18} /> : status === "completed" ? <CheckCircle2 size={18} /> : <LoaderCircle className={status === "running" ? "scraper-spin" : ""} size={18} />}
          <span>{message}</span>
        </div>
      )}
      {runId && <p className="admin-scraper-run-id">ID du run : <code>{runId}</code></p>}
      {result && (
        <div className="admin-scraper-results">
          <div><small>Éléments reçus</small><strong>{result.datasetCount}</strong></div>
          <div><small>Importés / mis à jour</small><strong>{result.importedCount}</strong></div>
          <div><small>Ignorés (données incomplètes)</small><strong>{result.skippedCount}</strong></div>
          <p>Statut des annonces : <b>en attente de modération</b>. Limite par run : {result.limit} éléments.</p>
        </div>
      )}
      <p className="admin-scraper-note">Le token Apify reste côté serveur. Les URL et les données sont validées avant l’import. Vérifiez les droits de réutilisation avant toute activation.</p>
    </section>
  );
}
