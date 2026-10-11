import React, { useEffect, useState } from 'react';
import './admin-scraper.css';
import AdminScraper from './AdminScraper.jsx';
import { ShieldCheck, Users, CarFront, RefreshCw, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { supabase } from './lib/supabase.js';

export default function AdminDashboard({ user, notify }) {
  const [listings, setListings] = useState([]);
  const [counts, setCounts] = useState({users: 0, pending: 0, published: 0});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const refresh = async () => {
    if (!supabase) return;
    setLoading(true); setError('');
    const [listResult, profileResult, publishedResult] = await Promise.all([
      supabase.from('listings').select('id,brand,model,year,price_mad,city,status,created_at,owner_id').order('created_at', {ascending:false}).limit(100),
      supabase.from('profiles').select('id', {count:'exact', head:true}),
      supabase.from('listings').select('id', {count:'exact', head:true}).eq('status','published')
    ]);
    if (listResult.error) setError(listResult.error.message);
    else setListings(listResult.data || []);
    setCounts({users:profileResult.count || 0, pending:(listResult.data || []).filter(x=>x.status==='pending').length, published:publishedResult.count || 0});
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const moderate = async (id, status) => {
    setBusyId(id); setError('');
    const { error: updateError } = await supabase.from('listings').update({status, published_at: status === 'published' ? new Date().toISOString() : null}).eq('id', id);
    if (updateError) setError(updateError.message);
    else { notify?.(status === 'published' ? 'Annonce publiée' : 'Annonce rejetée'); await refresh(); }
    setBusyId('');
  };

  return <section className="admin-page">
    <div className="admin-welcome"><div><span className="auth-eyebrow">CONSOLE PRIVÉE · MOROTTO</span><h1><ShieldCheck size={29}/> Administration</h1><p>Connecté en tant que {user?.email}. Les actions sont protégées par les rôles Supabase.</p></div><button className="admin-refresh" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Actualiser</button></div>
    <AdminScraper notify={notify} />
    <div className="admin-stats"><div><span><Users size={20}/></span><small>Comptes</small><b>{counts.users}</b></div><div><span><Clock3 size={20}/></span><small>À modérer</small><b>{counts.pending}</b></div><div><span><CarFront size={20}/></span><small>Annonces publiées</small><b>{counts.published}</b></div></div>
    <div className="admin-list-head"><div><h2>Modération des annonces</h2><p>Examinez les annonces avant de les publier.</p></div><span className="admin-live"><i/> Contrôle d’accès actif</span></div>
    {error && <p className="auth-error">{error}</p>}
    {loading ? <div className="admin-empty">Chargement des données…</div> : listings.length ? <div className="admin-table">{listings.map(item=><article className="admin-row" key={item.id}><div className="admin-car-icon"><CarFront size={20}/></div><div className="admin-row-main"><b>{item.brand} {item.model} · {item.year}</b><span>{item.city} · {new Intl.NumberFormat('fr-MA').format(item.price_mad)} DH</span><small>Compte vendeur : {item.owner_id}</small></div><span className={'admin-status '+item.status}>{item.status}</span><div className="admin-row-actions">{item.status !== 'published' && <button disabled={!!busyId} onClick={()=>moderate(item.id,'published')} title="Publier"><CheckCircle2 size={17}/> Publier</button>}{item.status !== 'rejected' && item.status !== 'published' && <button className="reject" disabled={!!busyId} onClick={()=>moderate(item.id,'rejected')} title="Rejeter"><XCircle size={17}/> Rejeter</button>}</div></article>)}</div> : <div className="admin-empty">Aucune annonce pour le moment. Les nouvelles annonces soumises apparaîtront ici.</div>}
    <p className="admin-footnote">Le rôle superadmin n’est jamais attribué depuis cette interface. Il doit être accordé par un administrateur de base de données de confiance.</p>
  </section>;
}
