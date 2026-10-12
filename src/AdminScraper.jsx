import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clipboard, LoaderCircle, Play, RefreshCw, PauseCircle, History, Plus, ListChecks, ExternalLink } from "lucide-react";
import { supabase } from "./lib/supabase.js";
import { moroccoPriceGuide, formatMad } from "./moroccoPriceGuide.js";

const STATUS_LABELS = { pending: "À faire", queued: "En attente", running: "En cours", completed: "Terminée", failed: "Échec", skipped: "Ignorée" };
const STATUS_CLASS = { pending: "pending", queued: "queued", running: "running", completed: "completed", failed: "error", skipped: "skipped" };

export default function AdminScraper({ notify }) {
  const [searches, setSearches] = useState([]);
  const [runs, setRuns] = useState([]);
  const [events, setEvents] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, running: 0, completed: 0, failed: 0, disabled: 0 });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState("");
  const [filter, setFilter] = useState("all");
  const [targetUrl, setTargetUrl] = useState("");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [city, setCity] = useState("Maroc");
  const [maxPages, setMaxPages] = useState(5);
  const [confirmedPermission, setConfirmedPermission] = useState(false);
  const [selectedModelKey, setSelectedModelKey] = useState(() => moroccoPriceGuide.length ? `${moroccoPriceGuide[0].brand}|||${moroccoPriceGuide[0].model}` : "");
  const [copyMessage, setCopyMessage] = useState("");
  const [detailRun, setDetailRun] = useState("");

  const selectedModel = useMemo(() => moroccoPriceGuide.find(item => `${item.brand}|||${item.model}` === selectedModelKey) || moroccoPriceGuide[0], [selectedModelKey]);
  const searchPhrase = selectedModel ? `${selectedModel.brand} ${selectedModel.model} occasion Maroc` : "";

  const requestApi = useCallback(async (payload, method = "POST") => {
    const { data, error } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (error || !token) throw new Error("Votre session a expiré. Reconnectez-vous.");
    const response = await fetch("/api/admin/scrape-searches", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      ...(method === "GET" ? {} : { body: JSON.stringify(payload) }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "La requête a échoué.");
    return body;
  }, []);

  const refreshHistory = useCallback(async (quiet = false) => {
    if (!quiet) setHistoryLoading(true);
    setHistoryError("");
    try {
      const body = await requestApi({}, "GET");
      setSearches(body.searches || []);
      setRuns(body.runs || []);
      setEvents(body.events || []);
      setCounts(body.counts || { total: 0, pending: 0, running: 0, completed: 0, failed: 0, disabled: 0 });
    } catch (error) {
      setHistoryError(error.message);
    } finally {
      if (!quiet) setHistoryLoading(false);
    }
  }, [requestApi]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  async function copySearchPhrase() {
    try {
      await navigator.clipboard.writeText(searchPhrase);
      setCopyMessage("Recherche copiée. Ouvrez Avito et collez ici l’URL exacte des résultats autorisés.");
    } catch {
      setCopyMessage("Recherche à copier : " + searchPhrase);
    }
  }

  async function saveSearch(event) {
    event.preventDefault();
    if (!confirmedPermission) {
      setHistoryError("Confirmez l’autorisation de collecter et réutiliser ces données avant d’enregistrer.");
      return;
    }
    setSaving(true);
    setHistoryError("");
    try {
      const searchName = name.trim() || [brand, model, city].filter(Boolean).join(" — ");
      await requestApi({ action: "save_search", search: {
        name: searchName, brand: brand.trim() || null, model: model.trim() || null,
        city: city.trim() || "Maroc", target_url: targetUrl.trim(), max_pages: maxPages, enabled: true,
      } });
      setName(""); setTargetUrl(""); setConfirmedPermission(false); setCopyMessage("");
      notify?.("Recherche de scraping enregistrée");
      await refreshHistory(true);
    } catch (error) {
      setHistoryError(error.message);
    } finally { setSaving(false); }
  }

  async function runSearch(id) {
    setRunningId(id); setHistoryError("");
    try {
      const body = await requestApi({ action: "run_search", id });
      notify?.("Recherche envoyée à GitHub Actions");
      await refreshHistory(true);
      setHistoryError(body.status === "queued" ? "Recherche mise en file dans GitHub Actions. Actualisez pour suivre l’exécution." : "");
    } catch (error) { setHistoryError(error.message); }
    finally { setRunningId(""); }
  }

  async function toggleSearch(search) {
    setRunningId(search.id); setHistoryError("");
    try {
      await requestApi({ action: "update_search", id: search.id, enabled: !search.enabled }, "PATCH");
      await refreshHistory(true);
      notify?.(search.enabled ? "Recherche désactivée" : "Recherche réactivée");
    } catch (error) { setHistoryError(error.message); }
    finally { setRunningId(""); }
  }

  async function reconfirmAuthorization(search) {
    const accepted = window.confirm(`Confirmez-vous l’autorisation de collecter et réutiliser les données de cette recherche ?\n\n${search.name}\n${search.target_url}`);
    if (!accepted) return;
    setRunningId(search.id); setHistoryError("");
    try {
      await requestApi({ action: "update_search", id: search.id, confirmAuthorization: true }, "PATCH");
      await refreshHistory(true); notify?.("Autorisation confirmée");
    } catch (error) { setHistoryError(error.message); }
    finally { setRunningId(""); }
  }

  const visibleSearches = searches.filter(item => {
    const status = item.last_status || "pending";
    if (filter === "pending") return item.enabled && ["pending", "queued"].includes(status);
    if (filter === "running") return status === "running";
    if (filter === "completed") return status === "completed";
    if (filter === "failed") return status === "failed";
    if (filter === "disabled") return !item.enabled;
    return true;
  });
  const currentRun = runs.find(run => run.run_id === detailRun);
  const currentEvents = events.filter(item => item.run_id === detailRun);
  const latestRunBySearch = useMemo(() => {
    const map = new Map();
    for (const run of runs) if (!map.has(run.search_id)) map.set(run.search_id, run);
    return map;
  }, [runs]);

  return <section className="admin-scraper">
    <div className="admin-scraper-heading"><div>
      <span className="auth-eyebrow">COLLECTE AUTORISÉE · GITHUB ACTIONS + SUPABASE</span>
      <h2>Centre de scraping Avito</h2>
      <p>Enregistrez les recherches une par une, lancez-les manuellement et consultez le statut et l’historique. Les annonces restent en attente de modération.</p>
    </div><span className="admin-scraper-icon"><Play size={20}/></span></div>

    <div className="admin-scraper-stats">
      <div><small>Recherches</small><strong>{counts.total}</strong></div>
      <div><small>À faire / attente</small><strong>{counts.pending}</strong></div>
      <div><small>En cours</small><strong>{counts.running}</strong></div>
      <div><small>Terminées</small><strong>{counts.completed}</strong></div>
      <div><small>Échecs</small><strong>{counts.failed}</strong></div>
    </div>

    <div className="admin-scraper-model-picker">
      <label htmlFor="morotto-priority-model">Modèle à traiter en priorité</label>
      <select id="morotto-priority-model" value={selectedModelKey} onChange={event => {
        setSelectedModelKey(event.target.value); setCopyMessage("");
        const found = moroccoPriceGuide.find(item => `${item.brand}|||${item.model}` === event.target.value);
        setBrand(found?.brand || ""); setModel(found?.model || ""); setName(found ? `${found.brand} ${found.model} — Maroc` : "");
      }}>
        {moroccoPriceGuide.map(item => <option key={`${item.brand}|||${item.model}`} value={`${item.brand}|||${item.model}`}>{item.brand} — {item.model}</option>)}
      </select>
      {selectedModel && <div className="admin-scraper-model-summary">
        <div><small>Années de référence</small><strong>{selectedModel.years}</strong></div>
        <div><small>Carburant indicatif</small><strong>{selectedModel.fuel}</strong></div>
        <div><small>Fourchette indicative</small><strong>{formatMad(selectedModel.min)} – {formatMad(selectedModel.max)}</strong></div>
        <button type="button" className="admin-scraper-secondary" onClick={copySearchPhrase}><Clipboard size={16}/> Copier la recherche</button>
        {copyMessage && <p role="status">{copyMessage}</p>}
      </div>}
      <p className="admin-scraper-note">Les prix sont indicatifs, pas des annonces en direct. Sélectionner un modèle préremplit le nom; l’URL exacte des résultats Avito doit être fournie par l’administrateur.</p>
    </div>

    <form onSubmit={saveSearch} className="admin-scraper-form">
      <h3><Plus size={18}/> Ajouter une recherche suivie</h3>
      <label htmlFor="avito-search-name">Nom de la recherche</label>
      <input id="avito-search-name" value={name} onChange={event => setName(event.target.value)} placeholder="Ex. Dacia Duster — Casablanca" required/>
      <div className="admin-scraper-fields">
        <div><label htmlFor="avito-search-brand">Marque</label><input id="avito-search-brand" value={brand} onChange={event => setBrand(event.target.value)} placeholder="Dacia"/></div>
        <div><label htmlFor="avito-search-model">Modèle</label><input id="avito-search-model" value={model} onChange={event => setModel(event.target.value)} placeholder="Duster"/></div>
        <div><label htmlFor="avito-search-city">Ville / région</label><input id="avito-search-city" value={city} onChange={event => setCity(event.target.value)} placeholder="Maroc"/></div>
        <div><label htmlFor="avito-search-pages">Pages maximum</label><input id="avito-search-pages" type="number" min="1" max="50" value={maxPages} onChange={event => setMaxPages(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}/></div>
      </div>
      <label htmlFor="avito-target-url">URL exacte des résultats Avito.ma</label>
      <input id="avito-target-url" type="url" inputMode="url" autoComplete="url" value={targetUrl} onChange={event => setTargetUrl(event.target.value)} placeholder="https://www.avito.ma/..." required/>
      <p className="admin-scraper-note">Le worker s’arrête en cas de refus d’accès, limitation de débit ou challenge. Il n’essaie pas de contourner les protections anti-bot.</p>
      <label className="admin-scraper-consent"><input type="checkbox" checked={confirmedPermission} onChange={event => setConfirmedPermission(event.target.checked)}/><span>Je confirme que MOROTTO est autorisé à collecter et réutiliser les données de cette recherche, y compris les images concernées.</span></label>
      <div className="admin-scraper-actions">
        <button type="submit" disabled={saving || !targetUrl.trim() || !confirmedPermission}>{saving ? <><LoaderCircle className="scraper-spin" size={17}/> Enregistrement…</> : <><ListChecks size={17}/> Enregistrer dans la file</>}</button>
        <button type="button" className="admin-scraper-secondary" onClick={() => refreshHistory()} disabled={historyLoading}><RefreshCw size={16}/> Actualiser l’historique</button>
      </div>
    </form>

    {historyError && <div className="admin-scraper-message error" role="alert"><AlertCircle size={18}/><span>{historyError}</span></div>}

    <div className="admin-scraper-list">
      <div className="admin-scraper-list-heading">
        <div><h3><ListChecks size={18}/> File de recherches</h3><p>Une recherche qui n’a jamais tourné reste marquée « À faire ».</p></div>
        <select aria-label="Filtrer les recherches" value={filter} onChange={event => setFilter(event.target.value)}>
          <option value="all">Toutes</option><option value="pending">À faire / attente</option><option value="running">En cours</option><option value="completed">Terminées</option><option value="failed">Échecs</option><option value="disabled">Désactivées</option>
        </select>
      </div>
      {historyLoading ? <div className="admin-empty">Chargement des recherches…</div> : visibleSearches.length ? visibleSearches.map(search => {
        const status = search.last_status || "pending";
        const latestRun = latestRunBySearch.get(search.id);
        return <article className="admin-scrape-search-row" key={search.id}>
          <div className="admin-scrape-search-main">
            <div className="admin-scrape-search-title"><strong>{search.name}</strong><span className={`admin-scrape-status ${STATUS_CLASS[status] || "pending"}`}>{STATUS_LABELS[status] || status}</span></div>
            <p>{[search.brand, search.model, search.city].filter(Boolean).join(" · ") || "Avito.ma"}</p>
            <a href={search.target_url} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Ouvrir la source</a>
            <small>Dernier lancement : {search.last_started_at ? new Date(search.last_started_at).toLocaleString("fr-MA") : "Jamais lancée"} · Pages max. : {search.max_pages}</small>
            {search.last_error && <small className="admin-scraper-error-detail">{search.last_error}</small>}
            {latestRun && <small>Dernier run : {latestRun.run_id} · {latestRun.imported_count || 0} annonce(s) importée(s) · {latestRun.status}</small>}
            {search.authorization_confirmed_at && <small>Autorisation confirmée le {new Date(search.authorization_confirmed_at).toLocaleString("fr-MA")}</small>}
          </div>
          <div className="admin-scrape-search-actions">
            <button type="button" onClick={() => runSearch(search.id)} disabled={!search.enabled || runningId === search.id || status === "running"} title="Lancer maintenant">{runningId === search.id ? <LoaderCircle className="scraper-spin" size={16}/> : <Play size={16}/>} Lancer</button>
            <button type="button" className="admin-scraper-secondary" onClick={() => reconfirmAuthorization(search)} disabled={runningId === search.id}>Confirmer</button>
            <button type="button" className="admin-scraper-secondary" onClick={() => toggleSearch(search)} disabled={runningId === search.id}><PauseCircle size={16}/>{search.enabled ? "Désactiver" : "Réactiver"}</button>
            {latestRun && <button type="button" className="admin-scraper-secondary" onClick={() => setDetailRun(latestRun.run_id)}><History size={16}/> Détails</button>}
          </div>
        </article>;
      }) : <div className="admin-empty">Aucune recherche pour ce filtre. Ajoutez-en une ci-dessus.</div>}
    </div>

    {detailRun && <section className="admin-scraper-run-detail">
      <div className="admin-scraper-list-heading"><div><h3>Historique du run</h3><p>{currentRun?.run_id || detailRun}</p></div><button className="admin-scraper-secondary" type="button" onClick={() => setDetailRun("")}>Fermer</button></div>
      {currentRun && <div className="admin-scraper-results">
        <div><small>Statut</small><strong>{STATUS_LABELS[currentRun.status] || currentRun.status}</strong></div>
        <div><small>Annonces vues</small><strong>{currentRun.dataset_count || 0}</strong></div>
        <div><small>Importées</small><strong>{currentRun.imported_count || 0}</strong></div>
        <p>Démarré : {new Date(currentRun.started_at || currentRun.created_at).toLocaleString("fr-MA")} · Terminé : {currentRun.finished_at ? new Date(currentRun.finished_at).toLocaleString("fr-MA") : "En attente"}</p>
        {currentRun.error_message && <p className="admin-scraper-error-detail">{currentRun.error_message}</p>}
      </div>}
      <div className="admin-scraper-event-list"><h4>Événements récents</h4>
        {currentEvents.length ? currentEvents.map(item => <article key={item.id} className={`admin-scraper-event ${item.level}`}><time>{new Date(item.created_at).toLocaleString("fr-MA")}</time><strong>{item.event}</strong><p>{item.message}</p></article>) : <p>Aucun événement pour ce run dans les 100 derniers événements.</p>}
      </div>
    </section>}

    <p className="admin-scraper-note">Pour lancer depuis ce tableau, configurez <code>GITHUB_ACTIONS_TOKEN</code> côté serveur avec les droits Actions minimaux nécessaires. Sinon, utilisez GitHub Actions &gt; MOROTTO authorized Avito import. Les clés restent côté serveur.</p>
  </section>;
}
