import React, { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, CircleAlert, Eye, EyeOff, KeyRound, RefreshCw, Save, ShieldCheck, Trash2, FlaskConical } from "lucide-react";
import { supabase } from "./lib/supabase.js";

const order = ["google_maps", "google_translate", "deepl", "apify", "openai", "anthropic", "google_ai"];
const blank = { secret: "", enabled: false, monthlyBudgetUsd: 0, dailyLimit: 0 };

export default function AdminIntegrations() {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [visible, setVisible] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState({ type: "", text: "" });

  const token = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error("Reconnectez-vous pour gérer les intégrations.");
    return data.session.access_token;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = await token();
      const response = await fetch("/api/admin/integrations", { headers: { Authorization: "Bearer " + accessToken }, cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Chargement impossible.");
      setItems(body.integrations || []);
      setDrafts(old => {
        const next = { ...old };
        for (const item of body.integrations || []) next[item.provider] = {
          ...(next[item.provider] || blank), enabled: item.enabled,
          monthlyBudgetUsd: item.monthlyBudgetUsd, dailyLimit: item.dailyLimit,
        };
        return next;
      });
      setNotice({ type: "", text: "" });
    } catch (error) { setNotice({ type: "error", text: error.message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function call(provider, body, method) {
    const accessToken = await token();
    const response = await fetch("/api/admin/integrations", {
      method: method || "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
      body: method === "GET" ? undefined : JSON.stringify({ provider, ...(body || {}) }),
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "La requête a échoué.");
    return result;
  }

  function update(provider, key, value) {
    setDrafts(old => ({ ...old, [provider]: { ...(old[provider] || blank), [key]: value } }));
  }

  async function save(item) {
    const draft = drafts[item.provider] || blank;
    setBusy(item.provider); setNotice({ type: "", text: "" });
    try {
      await call(item.provider, { secret: draft.secret, enabled: draft.enabled, monthlyBudgetUsd: Number(draft.monthlyBudgetUsd), dailyLimit: Number(draft.dailyLimit) });
      setDrafts(old => ({ ...old, [item.provider]: { ...old[item.provider], secret: "" } }));
      setNotice({ type: "success", text: item.label + " : paramètres enregistrés. La clé n’est jamais renvoyée au navigateur." });
      await load();
    } catch (error) { setNotice({ type: "error", text: error.message }); }
    finally { setBusy(""); }
  }

  async function test(item) {
    setBusy(item.provider); setNotice({ type: "", text: "" });
    try {
      const result = await call(item.provider, { action: "test" });
      setNotice({ type: result.ok ? "success" : "error", text: result.message });
      await load();
    } catch (error) { setNotice({ type: "error", text: error.message }); }
    finally { setBusy(""); }
  }

  async function remove(item) {
    if (!window.confirm("Supprimer la clé " + item.label + " ?")) return;
    setBusy(item.provider);
    try {
      await call(item.provider, {}, "DELETE");
      setDrafts(old => ({ ...old, [item.provider]: blank }));
      setNotice({ type: "success", text: item.label + " supprimé." });
      await load();
    } catch (error) { setNotice({ type: "error", text: error.message }); }
    finally { setBusy(""); }
  }

  return <section className="admin-integrations">
    <header className="admin-integrations-head">
      <div><span className="auth-eyebrow">CONFIGURATION PRIVÉE · SUPERADMIN</span><h2><KeyRound size={22}/> Clés API & contrôle d’usage</h2><p>Enregistrez les clés chiffrées côté serveur, activez ou désactivez chaque fournisseur, fixez des limites et consultez l’activité récente.</p></div>
      <button type="button" className="integrations-refresh" onClick={load} disabled={loading}><RefreshCw size={16}/> Actualiser</button>
    </header>
    <div className="integrations-security"><ShieldCheck size={20}/><span>Les clés existantes ne sont jamais affichées après enregistrement. Utilisez des clés à permissions minimales et configurez aussi des restrictions chez chaque fournisseur.</span></div>
    {notice.text && <div className={"integrations-notice " + notice.type} role="status">{notice.type === "error" ? <CircleAlert size={18}/> : <CheckCircle2 size={18}/>}<span>{notice.text}</span></div>}
    {loading ? <p>Chargement des intégrations…</p> : <div className="integrations-grid">{[...items].sort((a,b)=>order.indexOf(a.provider)-order.indexOf(b.provider)).map(item => {
      const draft = drafts[item.provider] || blank;
      const busyNow = busy === item.provider;
      return <article className="integration-card" key={item.provider}>
        <div className="integration-card-title"><span className="integration-symbol"><KeyRound size={19}/></span><div><h3>{item.label}</h3><p>{item.description}</p></div><span className={"integration-status " + (item.enabled ? "enabled" : "disabled")}>{item.enabled ? "Activé" : "Désactivé"}</span></div>
        <label className="integration-field">Clé API {item.configured && <small>· clé déjà enregistrée, saisissez une nouvelle clé uniquement pour la remplacer</small>}
          <span className="integration-secret-field"><input type={visible[item.provider] ? "text" : "password"} autoComplete="new-password" value={draft.secret || ""} onChange={e=>update(item.provider,"secret",e.target.value)} placeholder={item.configured ? "•••••••• (inchangée si vide)" : "Collez la clé API ici"}/><button type="button" onClick={()=>setVisible(old=>({...old,[item.provider]:!old[item.provider]}))} aria-label={visible[item.provider] ? "Masquer la clé" : "Afficher la clé"}>{visible[item.provider] ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span>
        </label>
        <div className="integration-controls">
          <label><input type="checkbox" checked={!!draft.enabled} onChange={e=>update(item.provider,"enabled",e.target.checked)}/> Activer ce service</label>
          <label>Budget mensuel estimé (USD)<input type="number" min="0" max="1000000" step="1" value={draft.monthlyBudgetUsd ?? 0} onChange={e=>update(item.provider,"monthlyBudgetUsd",e.target.value)}/></label>
          <label>Limite d’appels par jour (0 = sans limite applicative)<input type="number" min="0" step="1" value={draft.dailyLimit ?? 0} onChange={e=>update(item.provider,"dailyLimit",e.target.value)}/></label>
        </div>
        <div className="integration-usage"><div><Activity size={16}/><span>30 derniers jours</span></div><strong>{item.usage30d.calls} appels</strong><span>{item.usage30d.errors} erreurs · {item.usage30d.units} unités</span></div>
        <div className="integration-actions"><button type="button" onClick={()=>save(item)} disabled={busyNow}><Save size={16}/>{busyNow ? "Enregistrement…" : "Enregistrer"}</button><button type="button" onClick={()=>test(item)} disabled={busyNow || !item.configured || !item.enabled}><FlaskConical size={16}/> Tester</button><button type="button" className="integration-delete" onClick={()=>remove(item)} disabled={busyNow || !item.configured} aria-label={"Supprimer " + item.label}><Trash2 size={16}/></button></div>
      </article>;
    })}</div>}
    <p className="integrations-footnote">Les compteurs incluent uniquement les appels enregistrés par MOROTTO et les tests de clé ; ils ne remplacent pas la facturation officielle. Les budgets et limites sont des paramètres de gouvernance et ne constituent pas encore des plafonds de dépense garantis.</p>
  </section>;
}
