import React, { useState } from 'react';
import { X, ShieldCheck, Mail, LockKeyhole, UserRound, Building2, Wrench, KeyRound, ArrowRight, LoaderCircle } from 'lucide-react';
import { supabase } from './lib/supabase.js';

const accountTypes = [
  { value: 'individual', label: 'Particulier', icon: UserRound },
  { value: 'dealer', label: 'Concessionnaire', icon: Building2 },
  { value: 'garage', label: 'Garage', icon: Wrench },
  { value: 'rental_agency', label: 'Agence de location', icon: KeyRound },
];

export default function AuthModal({ onClose, onAuthenticated }) {
  const [mode, setMode] = useState('signup');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('individual');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
      setError(e?.message || 'Une erreur est survenue. Réessayez.');
    } finally { setBusy(false); }
  };

  return <div className="auth-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="auth-card" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="auth-close" onClick={onClose} aria-label="Fermer"><X size={20}/></button>
      <div className="auth-brand"><span className="auth-brand-mark"><ShieldCheck size={24}/></span><span>MOROTTO<small>VOTRE MOBILITÉ, VOTRE ESPACE</small></span></div>
      <span className="auth-eyebrow">{mode === 'signup' ? 'REJOIGNEZ LA COMMUNAUTÉ' : 'HEUREUX DE VOUS REVOIR'}</span>
      <h2 id="auth-title">{mode === 'signup' ? 'Créez votre compte.' : 'Connectez-vous.'}</h2>
      <p className="auth-subtitle">{mode === 'signup' ? 'Un compte pour vos annonces, favoris et services auto.' : 'Retrouvez votre espace MOROTTO en toute sécurité.'}</p>
      <div className="auth-mode-switch"><button className={mode === 'signup' ? 'active' : ''} onClick={() => {setMode('signup');setError('');setMessage('')}}>Créer un compte</button><button className={mode === 'login' ? 'active' : ''} onClick={() => {setMode('login');setError('');setMessage('')}}>Se connecter</button></div>
      <form onSubmit={submit} className="auth-form">
        {mode === 'signup' && <>
          <label>Nom affiché<input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Votre nom" maxLength={80} required/></label>
          <label>Type de compte<select value={accountType} onChange={e=>setAccountType(e.target.value)}>{accountTypes.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        </>}
        <label>Adresse e-mail<span className="auth-input"><Mail size={17}/><input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="vous@exemple.com" required/></span></label>
        <label>Mot de passe<span className="auth-input"><LockKeyhole size={17}/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} placeholder="8 caractères minimum" required/></span></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18}/> Connexion en cours…</> : <>{mode === 'signup' ? 'Créer mon compte' : 'Se connecter'} <ArrowRight size={17}/></>}</button>
      </form>
      <p className="auth-privacy">Votre compte est géré par Supabase Auth. Les rôles sensibles sont vérifiés côté serveur et ne peuvent pas être choisis ici.</p>
    </section>
  </div>;
}
