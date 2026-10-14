import React, { useEffect, useState } from 'react';
import './admin-scraper.css';
import AdminScraper from './AdminScraper.jsx';
import AdminIntegrations from './AdminIntegrations.jsx';
import AdminPlatformSettings from './AdminPlatformSettings.jsx';
import './admin-platform.css';
import './admin-integrations.css';
import './admin-user-management.css';
import AdminUserManagement from './AdminUserManagement.jsx';
import AdminMarketplaceOffers from './AdminMarketplaceOffers.jsx';
import AdminRentalBookings from './AdminRentalBookings.jsx';
import { ShieldCheck, Users, CarFront, RefreshCw, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { supabase } from './lib/supabase.js';
import { demoVehicles, demoRentals, demoInsurance, demoWorkshopPricing, demoParts } from './demoMarketplace.js';

export default function AdminDashboard({ user, notify }) {
  const [listings, setListings] = useState([]);
  const [counts, setCounts] = useState({users: 0, pending: 0, published: 0});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [page, setPage] = useState('overview');
  const pages = [
    ['overview','Vue d’ensemble'], ['listings','Annonces & modération'], ['users','Utilisateurs & rôles'], ['offers','Offres & services'], ['bookings','Réservations'], ['imports','Import autorisé'],
    ['marketplace','Catalogue'], ['integrations','Intégrations & clés'], ['settings','Paramètres plateforme']
  ];

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
    <nav className="admin-page-nav" aria-label="Pages administration">{pages.map(([id,label])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}>{label}</button>)}</nav>
    {error && <p className="auth-error">{error}</p>}
    {page==='overview' && <><div className="admin-stats"><div><span><Users size={20}/></span><small>Comptes</small><b>{counts.users}</b></div><div><span><Clock3 size={20}/></span><small>À modérer</small><b>{counts.pending}</b></div><div><span><CarFront size={20}/></span><small>Annonces publiées</small><b>{counts.published}</b></div></div><div className="admin-overview-grid"><button onClick={()=>setPage('listings')}><CarFront/><b>Modérer les annonces</b><span>Valider ou rejeter les annonces réelles reçues.</span></button><button onClick={()=>setPage('imports')}><RefreshCw/><b>Importer des annonces</b><span>Lancer une collecte uniquement avec autorisation.</span></button><button onClick={()=>setPage('marketplace')}><ShieldCheck/><b>Catalogue de démonstration</b><span>Contrôler les données fictives avant la présentation.</span></button><button onClick={()=>setPage('integrations')}><Users/><b>Intégrations</b><span>Contrôler les connexions et services.</span></button></div></>}
    {page==='listings' && <><div className="admin-list-head"><div><h2>Modération des annonces</h2><p>Examinez les annonces avant de les publier.</p></div><span className="admin-live"><i/> Contrôle d’accès actif</span></div>{loading ? <div className="admin-empty">Chargement des données…</div> : listings.length ? <div className="admin-table">{listings.map(item=><article className="admin-row" key={item.id}><div className="admin-car-icon"><CarFront size={20}/></div><div className="admin-row-main"><b>{item.brand} {item.model} · {item.year}</b><span>{item.city} · {new Intl.NumberFormat('fr-MA').format(item.price_mad)} DH</span><small>Compte vendeur : {item.owner_id}</small></div><span className={'admin-status '+item.status}>{item.status}</span><div className="admin-row-actions">{item.status !== 'published' && <button disabled={!!busyId} onClick={()=>moderate(item.id,'published')} title="Publier"><CheckCircle2 size={17}/> Publier</button>}{item.status !== 'rejected' && item.status !== 'published' && <button className="reject" disabled={!!busyId} onClick={()=>moderate(item.id,'rejected')} title="Rejeter"><XCircle size={17}/> Rejeter</button>}</div></article>)}</div> : <div className="admin-empty">Aucune annonce réelle à modérer. Les modèles de démonstration sont séparés du flux de modération.</div>}</>}
    {page==='users' && <AdminUserManagement notify={notify} />}
    {page==='offers' && <AdminMarketplaceOffers notify={notify} />}
    {page==='bookings' && <AdminRentalBookings notify={notify} />}
    {page==='imports' && <AdminScraper notify={notify} />}
    {page==='marketplace' && <section className="admin-demo-data"><div className="admin-list-head"><div><h2>Jeu de données de démonstration</h2><p>Les fiches marquées DÉMO sont fictives et ne sont jamais publiées comme annonces réelles.</p></div></div><div className="admin-stats"><div><span><CarFront size={20}/></span><small>Modèles / annonces démo</small><b>{demoVehicles.length}</b></div><div><span><Clock3 size={20}/></span><small>Agences de location démo</small><b>{demoRentals.length}</b></div><div><span><ShieldCheck size={20}/></span><small>Comparaisons assurance</small><b>{demoInsurance.length}</b></div><div><span><CarFront size={20}/></span><small>Guides atelier par modèle</small><b>{demoWorkshopPricing.length}</b></div><div><span><RefreshCw size={20}/></span><small>Références de pièces</small><b>{demoParts.length}</b></div></div><div className="admin-demo-actions"><button onClick={()=>window.dispatchEvent(new CustomEvent('tab',{detail:'buy'}))}>Voir le catalogue démo</button><button onClick={()=>window.dispatchEvent(new CustomEvent('tab',{detail:'community'}))}>Voir location, assurance & pièces</button><button onClick={()=>window.dispatchEvent(new CustomEvent('tab',{detail:'mechanic'}))}>Voir la mécanique</button></div><p className="admin-footnote">Les prix de véhicules, assurances, pièces et ateliers sont des valeurs synthétiques de présentation, basées sur les fourchettes de référence fournies. Ils ne sont pas des cotations validées. Les photos sont hébergées sur Wikimedia Commons ou Unsplash selon disponibilité ; vérifiez la correspondance exacte et les licences avant une mise en production commerciale.</p></section>}
    {page==='integrations' && <AdminIntegrations />}
    {page==='settings' && <AdminPlatformSettings />}
    <p className="admin-footnote">Le rôle superadmin n’est jamais attribué depuis cette interface. Il doit être accordé par un administrateur de base de données de confiance.</p>
  </section>;
}
