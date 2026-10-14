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
  const refresh=async()=>{
    if(!supabase){setError('Supabase n’est pas configuré.');setLoading(false);return;}
    setLoading(true);setError('');
    const [p,r]=await Promise.all([supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(250),supabase.from('user_roles').select('user_id,role').limit(500)]);
    if(p.error)setError(p.error.message);else setProfiles(p.data||[]);
    setRoles(r.error?[]:(r.data||[]));setLoading(false);
  };
  useEffect(()=>{refresh()},[]);
  const visible=useMemo(()=>profiles.filter(p=>{
    const role=roles.filter(r=>r.user_id===p.id).map(r=>r.role).join(' ');
    const type=typeOf(p);
    return (filter==='all'||type===filter)&&[nameOf(p),p.email,p.id,type,role,p.city].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase());
  }),[profiles,roles,filter,query]);
  const changeType=async(profile,type)=>{
    setSaving(profile.id);setError('');
    const {error:saveError}=await supabase.from('profiles').update({account_type:type}).eq('id',profile.id);
    if(saveError)setError('Type non modifié : '+saveError.message);
    else {setProfiles(prev=>prev.map(p=>p.id===profile.id?{...p,account_type:type}:p));notify?.('Type de compte mis à jour.');}
    setSaving('');
  };
  const copyId=async id=>{try{await navigator.clipboard.writeText(id);setCopied(id);notify?.('Identifiant copié.');}catch{setCopied('');setError('Copie indisponible dans ce navigateur.');}};
  const privileged=roles.filter(r=>r.role==='superadmin').length;
  return <section className="admin-user-management">
    <div className="admin-list-head"><div><h2>Gestion des utilisateurs</h2><p>Recherchez les profils, ajustez les types de compte et vérifiez les rôles attribués côté serveur.</p></div><button className="admin-refresh" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Actualiser</button></div>
    <div className="admin-stats"><div><span><UserRound size={20}/></span><small>Profils</small><b>{profiles.length}</b></div><div><span><Building2 size={20}/></span><small>Comptes professionnels</small><b>{profiles.filter(p=>typeOf(p)!=='individual').length}</b></div><div><span><ShieldCheck size={20}/></span><small>Rôles superadmin attribués</small><b>{privileged}</b></div></div>
    <div className="admin-user-tools"><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nom, email, identifiant, ville…"/></label><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tous les types</option>{demoAccountTypes.filter(x=>x.type!=='admin').map(x=><option key={x.type} value={x.type}>{x.label}</option>)}</select></div>
    {error&&<p className="auth-error">{error}</p>}
    {loading?<div className="admin-empty">Chargement des profils…</div>:visible.length?<div className="admin-table">{visible.map(p=>{const role=roles.filter(r=>r.user_id===p.id).map(r=>r.role);const type=typeOf(p);return <article className="admin-row admin-user-row" key={p.id}><div className="admin-car-icon"><UserRound size={19}/></div><div className="admin-row-main"><b>{nameOf(p)}</b><span>{p.email||'Email non exposé par la table profiles'} · {p.city||'Maroc'}</span><small>{p.id}</small><div className="admin-user-tags">{role.map(r=><span key={r} className={r==='superadmin'?'privileged':''}>{r}</span>)}<span>{typeLabels[type]||type}</span></div></div><label className="admin-user-type"><small>Type de compte</small><select disabled={saving===p.id} value={type} onChange={e=>changeType(p,e.target.value)}>{demoAccountTypes.filter(x=>x.type!=='admin').map(x=><option key={x.type} value={x.type}>{x.label}</option>)}</select></label><button className="admin-copy-id" onClick={()=>copyId(p.id)} title="Copier l’identifiant">{copied===p.id?<CheckCircle2 size={16}/>:<Copy size={16}/>}</button></article>})}</div>:<div className="admin-empty">Aucun profil ne correspond à cette recherche.</div>}
    <div className="admin-user-policy"><ShieldCheck size={18}/><p><b>Protection des accès :</b> cette interface ne peut pas créer un superadmin ni attribuer des droits privilégiés. Les rôles d’administration doivent être gérés par une procédure serveur de confiance. La modification du type de compte dépend de la colonne <code>profiles.account_type</code> et de ses politiques RLS.</p></div>
    <h3 className="admin-user-types-title">Types de compte configurés pour MOROTTO</h3>
    <div className="admin-user-type-cards">{demoAccountTypes.map(x=><article key={x.type}><span>{x.type==='individual'?<UserRound/>:x.type==='rental_agency'?<KeyRound/>:x.type==='service_provider'?<Wrench/>:<Building2/>}</span><b>{x.label}</b><p>{x.description}</p><small>{x.type==='admin'?'Accès privilégié · jamais auto-attribué':'Disponible comme profil de compte'}</small></article>)}</div>
  </section>;
}
