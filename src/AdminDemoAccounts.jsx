import React, { useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, ShieldCheck, UserPlus } from 'lucide-react';
import { supabase } from './lib/supabase.js';

export default function AdminDemoAccounts({ notify }) {
  const [accounts, setAccounts] = useState([]);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const refresh = async () => {
    if (!supabase) { setError('Supabase n’est pas configuré.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase
      .from('demo_test_accounts')
      .select('email,display_name,account_type,city,purpose,is_demo,auth_user_id,provisioned_at')
      .order('account_type');
    if (queryError) setError(queryError.message);
    else setAccounts(data || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const provision = async (event) => {
    event.preventDefault();
    if (password.length < 12) { setError('Choisissez un mot de passe temporaire de 12 caractères minimum.'); return; }
    setBusy(true); setError(''); setResult(null);
    const { data, error: invokeError } = await supabase.functions.invoke('provision-demo-accounts', { body: { password } });
    setBusy(false);
    if (invokeError || data?.error) { setError(data?.error || invokeError?.message || 'Provisionnement impossible. Vérifiez que la fonction Supabase est déployée.'); return; }
    setResult(data);
    notify?.('Comptes de démonstration provisionnés dans Supabase Auth.');
    await refresh();
  };

  return <section className="demo-accounts-panel">
    <div className="admin-list-head"><div><h2>Comptes fictifs de test</h2><p>Comptes dédiés aux tests de bout en bout. Les sociétés d’assurance ne sont pas des comptes utilisateurs.</p></div><button className="admin-refresh" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Actualiser</button></div>
    <div className="demo-security-note"><ShieldCheck size={19}/><span>Réservé au superadmin. Le mot de passe temporaire est envoyé à Supabase Auth côté serveur, n’est pas enregistré en base, et s’applique à tous les comptes listés. Changez-le après la session de test.</span></div>
    <form className="demo-provision-form" onSubmit={provision}>
      <label htmlFor="demo-temp-password">Mot de passe temporaire commun (12 caractères minimum)</label>
      <div className="demo-password-row"><input id="demo-temp-password" type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Saisir un mot de passe de test" required/><button className="btn primary" disabled={busy || password.length < 12}>{busy?<RefreshCw size={16} className="spin"/>:<UserPlus size={16}/>} {busy?'Provisionnement…':'Créer / réinitialiser les comptes'}</button></div>
      <small>Utilisez un mot de passe unique à l’environnement de démonstration, jamais celui du compte admin.</small>
    </form>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {result?.accounts && <div className="demo-result"><b>Provisionnement terminé</b><p>{result.accounts.filter(x=>x.status==='created').length} créés · {result.accounts.filter(x=>x.status==='reset').length} réinitialisés.</p><button type="button" onClick={()=>{navigator.clipboard?.writeText(result.accounts.map(x=>x.email+'\t'+password+'\t'+x.account_type).join('\n'));notify?.('Table des identifiants copiée.')}}><Copy size={15}/> Copier les identifiants avec le mot de passe temporaire</button></div>}
    <div className="demo-credentials-table-wrap"><table className="demo-credentials-table"><thead><tr><th>Nom de test</th><th>Rôle</th><th>Ville</th><th>Email de connexion</th><th>Statut Auth</th><th>Test principal</th></tr></thead><tbody>{loading?<tr><td colSpan="6">Chargement des comptes…</td></tr>:accounts.map(account=><tr key={account.email}><td>{account.display_name}<small>FICTIF</small></td><td>{account.account_type}</td><td>{account.city}</td><td><code>{account.email}</code></td><td>{account.auth_user_id ? 'Provisionné' : 'À créer dans Auth'}</td><td>{account.purpose}</td></tr>)}</tbody></table></div>
    <p className="admin-footnote">Les emails listés ne deviennent des identifiants fonctionnels qu’après un provisionnement réussi. Les comptes d’assurance ne sont volontairement pas créés.</p>
  </section>;
}
