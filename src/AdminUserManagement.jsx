import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, UserRound, Building2, Wrench, KeyRound, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from './lib/supabase.js';
import { demoAccountTypes } from './expandedMarketplace.js';

const typeLabels = Object.fromEntries(demoAccountTypes.map(x=>[x.type,x.label]));
const nameOf = p => p.full_name || p.display_name || p.business_name || p.name || 'Utilisateur MOROTTO';
const typeOf = p => p.account_type || p.user_type || 'individual';
export default function AdminUserManagement({notify}) {
  const [profiles,setProfiles]=useState([]);
  const [roles,setRoles]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [saving,setSaving]=useState('');
  const [copied,setCopied]=useState('');
  const [accountSettings,setAccountSettings]=useState([]);
  const refresh=async()=>{
    if(!supabase){setError('Supabase n’est pas configuré.');setLoading(false);return;}
    setLoading(true);setError('');
    const [p,r,s]=await Promise.all([supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(250),supabase.from('user_roles').select('user_id,role').limit(500),supabase.from('account_type_settings').select('*').order('sort_order')]);
    if(p.error)setError(p.error.message);else setProfiles(p.data||[]);
    setRoles(r.error?[]:(r.data||[]));setAccountSettings(s.error?[]:(s.data||[]));setLoading(false);
  };
  useEffect(()=>{refresh()},[]);
  const visible=useMemo(()=>profiles.filter(p=>{
    const role=roles.filter(r=>r.user_id===p.id).map(r=>r.role).join(' ');
    const type=typeOf(p);
    return (filter==='all'||type===filter)&&[nameOf(p),p.email,p.id,type,role,p.city].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase());
  }),[profiles,roles,filter,query]);
  const changeType=async(profile,type)=>{
    setSaving(profile.id);setError('');
    const {error:saveError}=await supabase.rpc('admin_set_account_type',{target_user:profile.id,next_type:type});
    if(saveError)setError('Type non modifié : '+saveError.message+' Vérifiez que la migration account_type_settings est appliquée.');
    else {setProfiles(prev=>prev.map(p=>p.id===profile.id?{...p,account_type:type}:p));notify?.('Type de compte mis à jour.');}
    setSaving('');
  };
  const copyId=async id=>{try{await navigator.clipboard.writeText(id);setCopied(id);notify?.('Identifiant copié.');}catch{setCopied('');setError('Copie indisponible dans ce navigateur.');}};
  const toggleType=async setting=>{const {error:saveError}=await supabase.from('account_type_settings').update({enabled:!setting.enabled,updated_at:new Date().toISOString()}).eq('account_type',setting.account_type);if(saveError){setError('Réglage non enregistré : '+saveError.message);return;}setAccountSettings(prev=>prev.map(x=>x.account_type===setting.account_type?{...x,enabled:!setting.enabled}:x));notify?.('Disponibilité du type de compte mise à jour.');};
  const privileged=roles.filter(r=>r.role==='superadmin').length;
  return <section className="admin-user-management">
    <div className="admin-list-head"><div><h2>Gestion des utilisateurs</h2><p>Recherchez les profils, ajustez les types de compte et vérifiez les rôles attribués côté serveur.</p></div><button className="admin-refresh" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Actualiser</button></div>
    <div className="admin-stats"><div><span><UserRound size={20}/></span><small>Profils</small><b>{profiles.length}</b></div><div><span><Building2 size={20}/></span><small>Comptes professionnels</small><b>{profiles.filter(p=>typeOf(p)!=='individual').length}</b></div><div><span><ShieldCheck size={20}/></span><small>Rôles superadmin attribués</small><b>{privileged}</b></div></div>
    <div className="admin-user-tools"><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom, email, identifiant, ville…"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tous les types</option>{demoAccountTypes.filter(x=>x.type!=='admin').map(x=><option key={x.type} value={x.type}>{x.label}</option>)}</select></div>
    {error&&<p className="auth-error">{error}</p>}
    {loading?<div className="admin-empty">Chargement des profils…</div>:visible.length?<div className="admin-table">{visible.map(p=>{const role=roles.filter(r=>r.user_id===p.id).map(r=>r.role);const type=typeOf(p);return <article className="admin-row admin-user-row" key={p.id}><div className="admin-car-icon"><UserRound size={19}/></div><div className="admin-row-main"><b>{nameOf(p)}</b><span>{p.email||'Email non exposé par la table profiles'} · {p.city||'Maroc'}</span><small>{p.id}</small><div className="admin-user-tags">{role.map(r=><span key={r} className={r==='superadmin'?'privileged':''}>{r}</span>)}<span>{typeLabels[type]||type}</span></div></div><label className="admin-user-type"><small>Type de compte</small><select disabled={saving===p.id} value={type} onChange={e=>changeType(p,e.target.value)}>{demoAccountTypes.filter(x=>x.type!=='admin').map(x=><option key={x.type} value={x.type}>{x.label}</option>)}</select></label><button className="admin-copy-id" onClick={()=>copyId(p.id)} title="Copier l’identifiant">{copied===p.id?<CheckCircle2 size={16}/>:<Copy size={16}/>}</button></article>})}</div>:<div className="admin-empty">Aucun profil ne correspond à cette recherche.</div>}
    <div className="admin-user-policy"><ShieldCheck size={18}/><p><b>Protection des accès :</b> cette interface ne peut pas créer un superadmin ni attribuer des droits privilégiés. Les rôles d’administration doivent être gérés par une procédure serveur de confiance. La modification du type de compte dépend de la colonne <code>profiles.account_type</code> et de ses politiques RLS.</p></div>
    <h3 className="admin-user-types-title">Types de compte configurés pour MOROTTO</h3>
    <p className="admin-user-settings-note">Activez uniquement les types de compte que vous souhaitez proposer à l’inscription. La liste publique et l’inscription pourront lire ces réglages après application de la migration.</p>
    <div className="admin-user-type-cards">{(accountSettings.length?accountSettings:demoAccountTypes.filter(x=>x.type!=='admin').map((x,i)=>({...x,account_type:x.type,sort_order:i,enabled:true}))).map(x=><article key={x.account_type}><span>{x.account_type==='individual'?<UserRound/>:x.account_type==='rental_agency'?<KeyRound/>:x.account_type==='service_provider'?<Wrench/>:<Building2/>}</span><b>{x.label}</b><p>{x.description}</p><small>{x.account_type==='admin'?'Accès privilégié · jamais auto-attribué':x.enabled?'Type activé':'Type désactivé'}</small>{accountSettings.length>0&&<button className={'admin-type-toggle '+(x.enabled?'enabled':'')} onClick={()=>toggleType(x)}>{x.enabled?'Désactiver':'Activer'}</button>}</article>)}</div>
  </section>;
}
