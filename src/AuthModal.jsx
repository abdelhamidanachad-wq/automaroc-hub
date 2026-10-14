import React, { useState } from 'react';
import { X, ShieldCheck, Mail, LockKeyhole, UserRound, Building2, Wrench, KeyRound, CarFront, ArrowRight, LoaderCircle } from 'lucide-react';
import { supabase } from './lib/supabase.js';

const accountTypes = [
  { value: 'individual', label: 'Particulier', icon: UserRound },
  { value: 'dealer', label: 'Concessionnaire', icon: Building2 },
  { value: 'garage', label: 'Garage', icon: Wrench },
  { value: 'rental_agency', label: 'Agence de location', icon: KeyRound },
  { value: 'mechanic', label: 'Mécanicien', icon: Wrench },
  { value: 'insurance_agency', label: 'Agence d’assurance', icon: ShieldCheck },
  { value: 'parts_seller', label: 'Vendeur de pièces', icon: CarFront },
  { value: 'partner', label: 'Partenaire', icon: Building2 },
  { value: 'service_provider', label: 'Prestataire de services', icon: Wrench },
];

export default function AuthModal({ onClose, onAuthenticated, allowSignups = true }) {
  const [mode, setMode] = useState(allowSignups ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [availableAccountTypes, setAvailableAccountTypes] = useState(accountTypes);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  React.useEffect(() => { if (!allowSignups) setMode('login'); }, [allowSignups]);
  React.useEffect(() => { let active=true; if(!supabase)return; supabase.from('account_type_settings').select('account_type,label,enabled').eq('enabled',true).order('sort_order').then(({data})=>{ if(!active||!data?.length)return; const next=data.map(row=>({...accountTypes.find(t=>t.value===row.account_type),value:row.account_type,label:row.label})).filter(t=>t.icon); if(next.length){setAvailableAccountTypes(next);setAccountType(current=>next.some(t=>t.value===current)?current:next[0].value);} }); return()=>{active=false}; },[]);

  const resetPassword = async () => {
    setError(''); setMessage('');
    if (!supabase) { setError('Supabase n’est pas configuré. Vérifiez les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans Vercel.'); return; }
    if (!email.trim()) { setError('Saisissez votre adresse e-mail ci-dessus, puis demandez le lien de réinitialisation.'); return; }
    setBusy(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin });
      if (resetError) throw resetError;
      setMessage('Si cette adresse est enregistrée, un lien de réinitialisation vient d’être envoyé. Vérifiez aussi vos courriers indésirables.');
    } catch (e) { setError(e?.message || 'Impossible d’envoyer le lien. Réessayez.'); }
    finally { setBusy(false); }
  };

  const signInSocial = async (provider) => {
    setBusy(true); setError(''); setMessage('');
    try {
      if (!supabase) throw new Error('La connexion Supabase n’est pas configurée.');
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin }
      });
      if (oauthError) throw oauthError;
    } catch (e) {
      const raw = e?.message || 'Connexion sociale impossible. Vérifiez la configuration du fournisseur dans Supabase.';
      const lower = raw.toLowerCase();
      setError(lower.includes('provider is not enabled') || lower.includes('unsupported provider')
        ? 'Ce fournisseur OAuth n’est pas encore activé dans Supabase Auth. Un superadmin peut le configurer dans Administration → Réglages de la plateforme, après ajout des variables de gestion Supabase sur Vercel et configuration du Client ID/Secret dans Google Cloud ou Meta.'
        : raw);
      setBusy(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      if (!supabase) throw new Error('La connexion Supabase n’est pas configurée. Vérifiez les variables VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');
      if (mode === 'signup') {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { display_name: name.trim(), account_type: accountType } }
        });
        if (authError) throw authError;
        if (data.session) {
          setMessage('Compte créé. Bienvenue sur MOROTTO !');
          onAuthenticated?.(data.session.user);
          onClose();
        } else {
          setMessage('Inscription envoyée. Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.');
          setMode('login');
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (authError) throw authError;
        setMessage('Connexion réussie.');
        onAuthenticated?.(data.user);
        onClose();
      }
    } catch (e) {
      const message = e?.message || 'Une erreur est survenue. Réessayez.';
      const lower = message.toLowerCase();
      if (lower.includes('database error saving new user') || lower.includes('schema cache') || (lower.includes('relation') && lower.includes('does not exist'))) {
        setError('La base MOROTTO semble incomplète : appliquez les deux fichiers SQL de supabase/migrations dans Supabase → SQL Editor, dans l’ordre 202610110001 puis 202610110002, puis réessayez. Détail : ' + message);
      } else if (lower.includes('invalid login credentials')) {
        setError('E-mail ou mot de passe incorrect. Si vous venez de vous inscrire, confirmez d’abord l’e-mail reçu. Vous pouvez aussi demander un lien de réinitialisation ci-dessous.');
      } else { setError(message); }
    } finally { setBusy(false); }
  };

  return <div className="auth-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="auth-close" onClick={onClose} aria-label="Fermer"><X size={20}/></button>
      <div className="auth-brand"><span className="auth-brand-mark"><ShieldCheck size={24}/></span><span>MOROTTO<small>VOTRE MOBILITÉ, VOTRE ESPACE</small></span></div>
      <span className="auth-eyebrow">{mode === 'signup' ? 'REJOIGNEZ LA COMMUNAUTÉ' : 'HEUREUX DE VOUS REVOIR'}</span>
      <h2 id="auth-title">{mode === 'signup' ? 'Créez votre compte.' : 'Connectez-vous.'}</h2>
      <p className="auth-subtitle">{mode === 'signup' ? 'Un compte pour vos annonces, favoris et services auto.' : 'Retrouvez votre espace MOROTTO en toute sécurité.'}</p>
      <div className="auth-mode-switch">{allowSignups && <button className={mode === 'signup' ? 'active' : ''} onClick={() => {setMode('signup');setError('');setMessage('')}}>Créer un compte</button>}<button className={mode === 'login' ? 'active' : ''} onClick={() => {setMode('login');setError('');setMessage('')}}>Se connecter</button></div>
      <div className="auth-social-buttons">
        <button type="button" onClick={() => signInSocial('google')} disabled={busy}><span className="auth-social-g">G</span> Continuer avec Google</button>
        <button type="button" onClick={() => signInSocial('facebook')} disabled={busy}><span className="auth-social-f">f</span> Continuer avec Facebook</button>
      </div>
      <div className="auth-divider"><span>ou par e-mail</span></div>
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <>
          <label>Nom affiché<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Votre nom" maxLength={80} required/></label>
          <label>Type de compte<select value={accountType} onChange={e=>setAccountType(e.target.value)}>{availableAccountTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        </>}
        <label>Adresse e-mail<span className="auth-input"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="vous@exemple.com" required/></span></label>
        <label>Mot de passe<span className="auth-input"><LockKeyhole size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} placeholder="8 caractères minimum" required/></span></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18}/> Connexion en cours…</> : <>{mode === 'signup' ? 'Créer mon compte' : 'Se connecter'} <ArrowRight size={17}/></>}</button>
        {mode === 'login' && <button type="button" className="auth-reset" onClick={resetPassword} disabled={busy}>Mot de passe oublié ? Recevoir un lien</button>}
      </form>
      <p className="auth-privacy">Votre compte est géré par Supabase Auth. Les rôles sensibles sont vérifiés côté serveur et ne peuvent pas être choisis ici.</p>
    </section>
  </div>;
}
