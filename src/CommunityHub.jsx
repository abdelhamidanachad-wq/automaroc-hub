import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, MapPin, Navigation, Search, ShieldCheck, Wrench, Package, CarFront, MessageCircle, RefreshCw, ExternalLink, Send, BadgeCheck } from 'lucide-react';
import { supabase } from './lib/supabase.js';
import './community-hub.css';

const sections = [
  ['rentals', 'Location', CarFront],
  ['insurance', 'Assurance', ShieldCheck],
  ['services', 'Mécanique & garages', Wrench],
  ['parts', 'Pièces auto', Package],
  ['community', 'Communauté', MessageCircle],
  ['navigation', 'Navigation', Navigation],
];

const money = value => value == null ? 'Prix à confirmer' : new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(Number(value)) + ' DH';
const period = value => ({ day: '/ jour', week: '/ semaine', month: '/ mois' }[value] || '');

export default function CommunityHub({ user, notify }) {
  const [section, setSection] = useState('rentals');
  const [data, setData] = useState({ rentals: [], insurance: [], services: [], parts: [], community: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState('');
  const [query, setQuery] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postBody, setPostBody] = useState('');
  const [postTopic, setPostTopic] = useState('general');
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); setError('Supabase n’est pas configuré.'); return; }
    setLoading(true); setError('');
    const specs = [
      ['rentals', 'rental_offers', 'created_at'],
      ['insurance', 'insurance_offers', 'created_at'],
      ['services', 'service_providers', 'created_at'],
      ['parts', 'parts_listings', 'created_at'],
      ['community', 'community_posts', 'created_at'],
    ];
    const results = await Promise.all(specs.map(async ([key, table, order]) => {
      const result = await supabase.from(table).select('*').eq('status', 'published').order(order, { ascending: false }).limit(100);
      return [key, result];
    }));
    const next = { rentals: [], insurance: [], services: [], parts: [], community: [] };
    const errors = [];
    for (const [key, result] of results) {
      if (result.error) errors.push(result.error.message);
      else next[key] = result.data || [];
    }
    setData(next);
    if (errors.length) setError('Certaines rubriques ne sont pas encore disponibles. Appliquez la migration communautaire Supabase. ' + errors[0]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const matches = item => {
    const text = [item.title, item.name, item.provider_name, item.insurer_name, item.offer_name, item.vehicle_brand, item.vehicle_model, item.city, item.part_category, item.brand, item.body, item.coverage_summary].filter(Boolean).join(' ').toLocaleLowerCase();
    return text.includes(query.trim().toLocaleLowerCase());
  };

  const createPost = async event => {
    event.preventDefault();
    if (!user) { notify?.('Connectez-vous pour publier dans la communauté.'); return; }
    if (!postTitle.trim() || !postBody.trim()) return;
    setPosting(true); setError('');
    const { error: insertError } = await supabase.from('community_posts').insert({
      author_id: user.id, title: postTitle.trim(), body: postBody.trim(), topic: postTopic, status: 'published'
    });
    if (insertError) setError(insertError.message);
    else { setPostTitle(''); setPostBody(''); notify?.('Publication ajoutée à la communauté.'); await refresh(); }
    setPosting(false);
  };

  const list = data[section] || [];
  const filtered = list.filter(matches);
  const openDirections = provider => {
    const place = [provider.name, provider.address, provider.city, 'Maroc'].filter(Boolean).join(', ');
    const encoded = encodeURIComponent(place);
    return { google: 'https://www.google.com/maps/dir/?api=1&destination=' + encoded, waze: 'https://waze.com/ul?q=' + encoded + '&navigate=yes' };
  };

  return <section className="community-page">
    <div className="community-hero">
      <div className="community-hero-copy">
        <span className="community-eyebrow">L’ÉCOSYSTÈME AUTO MAROCAIN</span>
        <h1>Tout ce qui fait avancer <em>la communauté.</em></h1>
        <p>Comparez les offres publiées, trouvez des professionnels, échangez des conseils et lancez un itinéraire dans votre application GPS préférée.</p>
      </div>
      <div className="community-hero-mark"><Navigation size={34}/><span>MOROTTO</span><small>ENSEMBLE SUR LA ROUTE</small></div>
    </div>
    <div className="community-tabs">{sections.map(([id, label, Icon]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><Icon size={17}/>{label}<span>{id === 'navigation' ? 'GPS' : data[id]?.length ?? 0}</span></button>)}</div>
    {section === 'navigation' ? <div className="community-panel route-panel">
      <span className="community-eyebrow">NAVIGATION</span><h2>Où voulez-vous aller ?</h2>
      <p>Entrez une adresse, un quartier ou un lieu au Maroc. MOROTTO ouvrira l’itinéraire dans l’application choisie.</p>
      <form className="route-form" onSubmit={e => e.preventDefault()}><MapPin size={20}/><input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ex. Gare Casa-Voyageurs, Casablanca" aria-label="Destination" required/></form>
      <div className="route-actions"><a className="community-primary" href={destination.trim() ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination.trim()) : undefined} target="_blank" rel="noreferrer" onClick={e => { if (!destination.trim()) e.preventDefault(); }}><Navigation size={17}/> Itinéraire Google Maps <ExternalLink size={15}/></a><a className="community-secondary" href={destination.trim() ? 'https://waze.com/ul?q=' + encodeURIComponent(destination.trim()) + '&navigate=yes' : undefined} target="_blank" rel="noreferrer" onClick={e => { if (!destination.trim()) e.preventDefault(); }}><ArrowUpRight size={17}/> Ouvrir dans Waze <ExternalLink size={15}/></a></div>
      <div className="community-notice"><ShieldCheck size={18}/><span>Cette première intégration ouvre une navigation externe. Le guidage vocal, le trafic en direct et le recalcul d’itinéraire sont assurés par Google Maps ou Waze, pas directement dans MOROTTO.</span></div>
    </div> : <>
      <div className="community-list-head"><div><h2>{sections.find(item => item[0] === section)?.[1]}</h2><p>Seules les entrées publiées par la base MOROTTO sont affichées ici.</p></div><button className="community-refresh" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Actualiser</button></div>
      {section !== 'community' && <label className="community-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une offre, une ville, une marque…"/></label>}
      {error && <div className="community-notice"><ShieldCheck size={18}/><span>{error}</span></div>}
      {loading ? <div className="community-empty">Chargement des données publiées…</div> : filtered.length ? <div className="community-cards">
        {filtered.map(item => {
          if (section === 'rentals') return <article className="community-card" key={item.id}><span className="community-card-icon"><CarFront/></span><span className="community-tag">Loueur</span><h3>{item.title}</h3><p>{item.provider_name} · {item.vehicle_brand} {item.vehicle_model}{item.vehicle_year ? ' · ' + item.vehicle_year : ''}</p><div className="community-card-bottom"><b>{money(item.price_mad)} <small>{period(item.billing_period)}</small></b><span>{item.city}</span></div>{item.contact_phone && <a href={'tel:' + item.contact_phone} className="community-card-link">Contacter le loueur <ArrowUpRight size={15}/></a>}</article>;
          if (section === 'insurance') return <article className="community-card" key={item.id}><span className="community-card-icon"><ShieldCheck/></span><span className="community-tag">Offre publiée</span><h3>{item.insurer_name}</h3><p>{item.offer_name}</p><p>{item.coverage_summary}</p><div className="community-card-bottom"><b>{money(item.price_from_mad)}</b>{item.valid_until && <span>Valide jusqu’au {item.valid_until}</span>}</div>{item.quote_url && <a className="community-card-link" href={item.quote_url} target="_blank" rel="noreferrer">Demander un devis <ExternalLink size={15}/></a>}{item.contact_phone && <a className="community-card-link" href={'tel:' + item.contact_phone}>Appeler <ArrowUpRight size={15}/></a>}</article>;
          if (section === 'services') return <article className="community-card" key={item.id}><span className="community-card-icon"><Wrench/></span><span className="community-tag">{item.verified ? 'Professionnel vérifié' : 'Professionnel publié'}</span><h3>{item.name}</h3><p>{({mechanic:'Mécanicien',garage:'Garage',parts_shop:'Magasin de pièces',inspection_center:'Centre de visite technique',towing:'Dépannage'}[item.provider_type] || item.provider_type)} · {item.city}</p>{item.description && <p>{item.description}</p>}<div className="community-card-actions">{item.phone && <a className="community-card-link" href={'tel:' + item.phone}>Appeler <ArrowUpRight size={15}/></a>}{item.address && <a className="community-card-link" href={openDirections(item).google} target="_blank" rel="noreferrer">Itinéraire <Navigation size={15}/></a>}</div></article>;
          if (section === 'parts') return <article className="community-card" key={item.id}>{item.image_url && <img className="community-part-image" src={item.image_url} alt={item.title} loading="lazy"/>}<span className="community-card-icon"><Package/></span><span className="community-tag">{({new:'Neuf',used:'Occasion',refurbished:'Reconditionné'}[item.condition] || item.condition)} · {item.part_category}</span><h3>{item.title}</h3><p>{[item.brand, item.compatible_vehicles, item.city].filter(Boolean).join(' · ')}</p>{item.description && <p>{item.description}</p>}<div className="community-card-bottom"><b>{money(item.price_mad)}</b></div>{item.contact_phone && <a className="community-card-link" href={'tel:' + item.contact_phone}>Contacter le vendeur <ArrowUpRight size={15}/></a>}</article>;
          return <article className="community-card community-post" key={item.id}><span className="community-card-icon"><MessageCircle/></span><span className="community-tag">{item.topic?.replaceAll('_', ' ') || 'Communauté'}{item.city ? ' · ' + item.city : ''}</span><h3>{item.title}</h3><p>{item.body}</p><small>Publié le {new Date(item.created_at).toLocaleDateString('fr-MA')}</small></article>;
        })}
      </div> : <div className="community-empty"><span className="community-empty-icon">{section === 'parts' ? <Package/> : section === 'services' ? <Wrench/> : section === 'insurance' ? <ShieldCheck/> : <CarFront/>}</span><h3>Aucune offre publiée pour le moment</h3><p>Les offres réelles apparaîtront ici après inscription des partenaires, validation des données et publication par MOROTTO. Nous n’affichons pas de faux prix ou de fausses annonces pour remplir le catalogue.</p></div>}
      {section === 'community' && <form className="community-compose" onSubmit={createPost}><h3>Partager avec la communauté</h3><p>Posez une question, partagez un conseil d’entretien ou racontez votre expérience sur la route.</p><select value={postTopic} onChange={e => setPostTopic(e.target.value)}><option value="general">Discussion générale</option><option value="buying_advice">Conseils d’achat</option><option value="maintenance">Entretien</option><option value="road_trip">Voyage & route</option><option value="parts">Pièces auto</option><option value="safety">Sécurité routière</option></select><input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Titre de votre publication" maxLength={120} required/><textarea value={postBody} onChange={e => setPostBody(e.target.value)} placeholder="Votre message…" maxLength={5000} rows={4} required/><button className="community-primary" disabled={posting}><Send size={16}/>{posting ? 'Publication…' : user ? 'Publier' : 'Connectez-vous pour publier'}</button></form>}
    </>}
    <div className="community-trust"><BadgeCheck size={18}/><p>Les offres commerciales ne doivent être publiées qu’avec l’autorisation de la source et après vérification par l’équipe MOROTTO. Le nombre d’offres affiché correspond aux enregistrements réellement publiés, jamais à un objectif marketing.</p></div>
  </section>;
}
