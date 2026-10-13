import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, MapPin, Navigation, Search, ShieldCheck, Wrench, Package, CarFront, MessageCircle, RefreshCw, ExternalLink, Send, BadgeCheck, BookOpen } from 'lucide-react';
import { supabase } from './lib/supabase.js';
import './community-hub.css';
import { moroccoPriceGuide } from './moroccoPriceGuide.js';
import { demoRentals, demoInsurance, demoWorkshopPricing, demoParts } from './demoMarketplace.js';
import { t } from './i18n.js';

const sections = [
  ['rentals', 'Location', CarFront],
  ['insurance', 'Assurance', ShieldCheck],
  ['services', 'Mécanique & garages', Wrench],
  ['parts', 'Pièces auto', Package],
  ['community', 'Communauté', MessageCircle],
  ['guides', 'Guides & astuces', BookOpen],
  ['pricing', 'Prix atelier', Wrench],
  ['navigation', 'Navigation', Navigation],
];

const money = value => value == null ? 'Prix à confirmer' : new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(Number(value)) + ' DH';
const insurerLogoUrls = { 'Sanlam': 'https://www.google.com/s2/favicons?domain=sanlam.ma&sz=128', 'Wafa Assurance': 'https://www.google.com/s2/favicons?domain=wafaassurance.ma&sz=128', 'AXA': 'https://commons.wikimedia.org/wiki/Special:FilePath/AXA_Logo.svg', 'RMA': 'https://www.google.com/s2/favicons?domain=rmaassurance.com&sz=128', 'Saham Assurance': 'https://www.google.com/s2/favicons?domain=sahamassurance.ma&sz=128' };
const period = value => ({ day: '/ jour', week: '/ semaine', month: '/ mois' }[value] || '');

export default function CommunityHub({ user, notify, language = 'fr', initialSection = 'rentals' }) {
  const [section, setSection] = useState(initialSection);
  const [vehicleBrand, setVehicleBrand] = useState('Dacia');
  const [vehicleModel, setVehicleModel] = useState('Logan (Gen 2)');
  const [vehicleYear, setVehicleYear] = useState('2018');
  const [data, setData] = useState({ rentals: [], insurance: [], services: [], parts: [], pricing: demoWorkshopPricing, community: [], guides: [] });
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
    const articleLocale = ['it', 'es'].includes(language) ? 'en' : ['fr', 'en', 'ar'].includes(language) ? language : 'fr';
    const specs = [
      ['rentals', 'rental_offers', 'created_at'],
      ['insurance', 'insurance_offers', 'created_at'],
      ['services', 'service_providers', 'created_at'],
      ['parts', 'parts_listings', 'created_at'],
      ['community', 'community_posts', 'created_at'],
      ['guides', 'knowledge_base', 'created_at'],
    ];
    const results = await Promise.all(specs.map(async ([key, table, order]) => {
      let request = supabase.from(table).select('*');
      if (key === 'guides') {
        request = request.eq('is_published', true).eq('locale', articleLocale).order('category', { ascending: true }).order('title', { ascending: true });
      } else {
        request = request.eq('status', 'published').order(order, { ascending: false });
      }
      const result = await request.limit(100);
      return [key, result];
    }));
    const next = { rentals: [], insurance: [], services: [], parts: [], pricing: demoWorkshopPricing, community: [], guides: [] };
    const errors = [];
    for (const [key, result] of results) {
      if (result.error) errors.push(result.error.message);
      else next[key] = result.data || [];
    }
    setData(next);
    if (errors.length) setError('Certaines rubriques ne sont pas encore disponibles. Appliquez la migration communautaire Supabase. ' + errors[0]);
    setLoading(false);
  }, [language]);

  useEffect(() => { refresh(); }, [refresh]);

  const matches = item => {
    const text = [item.title, item.name, item.provider_name, item.insurer_name, item.offer_name, item.vehicle_brand, item.vehicle_model, item.city, item.part_category, item.brand, item.body, item.excerpt, item.content, item.coverage_summary, item.compatible_vehicles, item.years, ...(item.tags || [])].filter(Boolean).join(' ').toLocaleLowerCase();
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

  const list = section === 'pricing' ? data.pricing : (data[section] || []);
  const brands = [...new Set(moroccoPriceGuide.map(item => item.brand))];
  const modelsForBrand = moroccoPriceGuide.filter(item => item.brand === vehicleBrand);
  const selectedGuide = moroccoPriceGuide.find(item => item.brand === vehicleBrand && item.model === vehicleModel) || modelsForBrand[0] || moroccoPriceGuide[0];
  const yearFactor = Math.max(0.8, Math.min(1.3, 1 + (2024 - Number(vehicleYear)) * 0.012));
  const vehicleFactor = selectedGuide ? Math.max(0.7, Math.min(3.2, ((selectedGuide.min + selectedGuide.max) / 2) / 100000)) : 1;
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
        <h1>{t(language,'communityHeroTitle')}</h1>
        <p>{t(language,'communityHeroDescription')}</p>
      </div>
      <div className="community-hero-mark"><Navigation size={34}/><span>MOROTTO</span><small>ENSEMBLE SUR LA ROUTE</small></div>
    </div>
    <div className="community-tabs">{sections.map(([id, label, Icon]) => <button key={id} className={section === id ? 'active' : ''} onClick={() => setSection(id)}><Icon size={17}/>{id === 'rentals' ? t(language,'rentals') : id === 'insurance' ? t(language,'insurance') : id === 'services' ? t(language,'mechanics') : id === 'parts' ? t(language,'parts') : id === 'community' ? t(language,'community') : id === 'pricing' ? t(language,'workshopPrices') : id === 'guides' ? t(language,'learn') : label}<span>{id === 'navigation' ? 'GPS' : data[id]?.length ?? 0}</span></button>)}</div>
    {section === 'navigation' ? <div className="community-panel route-panel">
      <span className="community-eyebrow">NAVIGATION</span><h2>Où voulez-vous aller ?</h2>
      <p>Entrez une adresse, un quartier ou un lieu au Maroc. MOROTTO ouvrira l’itinéraire dans l’application choisie.</p>
      <form className="route-form" onSubmit={e => e.preventDefault()}><MapPin size={20}/><input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Ex. Gare Casa-Voyageurs, Casablanca" aria-label="Destination" required/></form>
      <div className="route-actions"><a className="community-primary" href={destination.trim() ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination.trim()) : undefined} target="_blank" rel="noreferrer" onClick={e => { if (!destination.trim()) e.preventDefault(); }}><Navigation size={17}/> Itinéraire Google Maps <ExternalLink size={15}/></a><a className="community-secondary" href={destination.trim() ? 'https://waze.com/ul?q=' + encodeURIComponent(destination.trim()) + '&navigate=yes' : undefined} target="_blank" rel="noreferrer" onClick={e => { if (!destination.trim()) e.preventDefault(); }}><ArrowUpRight size={17}/> Ouvrir dans Waze <ExternalLink size={15}/></a></div>
      <div className="community-notice"><ShieldCheck size={18}/><span>Cette première intégration ouvre une navigation externe. Le guidage vocal, le trafic en direct et le recalcul d’itinéraire sont assurés par Google Maps ou Waze, pas directement dans MOROTTO.</span></div>
    </div> : <>
      <div className="community-list-head"><div><h2>{sections.find(item => item[0] === section)?.[1]}</h2><p>{t(language,'listingsOnly')}</p></div><button className="community-refresh" onClick={refresh} disabled={loading}><RefreshCw size={16}/> {t(language,'refresh')}</button></div>
      {section === 'insurance' && <div className="insurance-demo-filters"><div><label>{t(language,'brand')}</label><select value={vehicleBrand} onChange={e => { setVehicleBrand(e.target.value); const nextModel = moroccoPriceGuide.find(x => x.brand === e.target.value); if (nextModel) setVehicleModel(nextModel.model); }} >{brands.map(brand => <option key={brand}>{brand}</option>)}</select></div><div><label>{t(language,'model')}</label><select value={selectedGuide?.model || vehicleModel} onChange={e => setVehicleModel(e.target.value)}>{modelsForBrand.map(item => <option key={item.model} value={item.model}>{item.model}</option>)}</select></div><div><label>{t(language,'year')}</label><select value={vehicleYear} onChange={e => setVehicleYear(e.target.value)}>{Array.from({length: 2026-1998},(_,i)=>2026-i).map(year=><option key={year} value={year}>{year}</option>)}</select></div><p>{t(language,'demoInsuranceDisclaimer')}</p></div>}
      {section !== 'community' && <label className="community-search"><Search size={18}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder={t(language,'searchOffer')}/></label>}
      {error && <div className="community-notice"><ShieldCheck size={18}/><span>{error}</span></div>}
      {loading ? <div className="community-empty">Chargement des données publiées…</div> : filtered.length ? <div className="community-cards">
        {filtered.map(item => {
          if (section === 'guides') return <article className="community-card community-article-card" key={item.id}>
            <span className="community-card-icon"><BookOpen/></span>
            <span className="community-tag">{item.category || t(language,'learn')}</span>
            <h3>{item.title}</h3>
            {item.excerpt && <p>{item.excerpt}</p>}
            <details className="community-article-details">
              <summary>{language === 'ar' ? 'اقرأ المقال' : language === 'en' || language === 'it' || language === 'es' ? 'Read article' : 'Lire l’article'}</summary>
              <div className="community-article-content">{item.content}</div>
            </details>
            {item.tags?.length > 0 && <small className="community-article-tags">{item.tags.join(' · ')}</small>}
          </article>;
          if (section === 'pricing') return <article className="community-card pricing-card" key={item.id}><span className="community-card-icon"><Wrench/></span><span className="community-tag">FOURCHETTE INDICATIVE · {item.years}</span><h3>{item.brand} {item.model}</h3><p>Fourchette véhicule de référence : {money(item.min)} – {money(item.max)} · Carburant : {item.fuel}</p><div className="pricing-lines"><span>Vidange + filtre <b>{money(item.oilMin)} – {money(item.oilMax)}</b></span><span>Plaquettes de frein <b>{money(item.brakesMin)} – {money(item.brakesMax)}</b></span><span>Batterie <b>{money(item.batteryMin)} – {money(item.batteryMax)}</b></span><span>Diagnostic <b>{money(item.diagnosticMin)} – {money(item.diagnosticMax)}</b></span><span>Kit distribution <b>{money(item.timingMin)} – {money(item.timingMax)}</b></span></div><p className="demo-disclaimer">Fourchette indicative, pas un devis. Confirmer la motorisation, le VIN et les pièces auprès du garage.</p></article>;
          if (section === 'rentals') return <article className="community-card" key={item.id}><span className="community-card-icon"><CarFront/></span><span className="community-tag">{item.demo ? 'OFFRE INDICATIVE' : 'Loueur'}</span><h3>{item.title}</h3><p>{item.provider_name} · {item.vehicle_brand} {item.vehicle_model}{item.vehicle_year ? ' · ' + item.vehicle_year : ''}</p><div className="community-card-bottom"><b>{money(item.price_mad)} <small>{period(item.billing_period)}</small></b><span>{item.city}</span></div>{item.contact_phone && <a href={'tel:' + item.contact_phone} className="community-card-link">Contacter le loueur <ArrowUpRight size={15}/></a>}</article>;
          if (section === 'insurance') return <article className="community-card" key={item.id}><span className="community-card-icon"><ShieldCheck/></span><span className="community-tag">{item.demo ? 'ESTIMATION INDICATIVE' : 'Offre publiée'}</span><div className="insurer-logo-row"><span className="insurer-logo-shell"><img src={insurerLogoUrls[item.insurer_name] || ''} alt={item.insurer_name + ' logo'} loading="lazy" onError={e=>{e.currentTarget.dataset.failed='true';}}/><span className="insurer-logo-fallback">{item.insurer_name==='Wafa Assurance'?'WAFA':item.insurer_name==='Saham Assurance'?'SAHAM':item.insurer_name.toUpperCase()}</span></span><div className="insurer-logo-text"><h3>{item.insurer_name}</h3><small>{item.insurer_name==='Saham Assurance' ? 'Marque historique de démonstration · statut à vérifier' : 'Nom de marque illustratif · offre démo'}</small></div></div><p>{item.offer_name}</p><p>{item.coverage_summary}</p><p className="insurance-vehicle">Véhicule choisi : {vehicleBrand} {selectedGuide?.model || vehicleModel} · {vehicleYear}</p><div className="community-card-bottom"><b>{money(item.demo ? Math.round((item.price_from_mad || 0) * vehicleFactor * yearFactor / 25) * 25 : item.price_from_mad)}</b>{item.valid_until && <span>Valide jusqu’au {item.valid_until}</span>}</div>{item.quote_url && <a className="community-card-link" href={item.quote_url} target="_blank" rel="noreferrer">Demander un devis <ExternalLink size={15}/></a>}{item.contact_phone && <a className="community-card-link" href={'tel:' + item.contact_phone}>Appeler <ArrowUpRight size={15}/></a>}</article>;
          if (section === 'services') return <article className="community-card" key={item.id}><span className="community-card-icon"><Wrench/></span><span className="community-tag">{item.demo ? 'DÉMO · À VÉRIFIER' : item.verified ? 'Professionnel vérifié' : 'Professionnel publié'}</span><h3>{item.name}</h3><p>{({mechanic:'Mécanicien',garage:'Garage',parts_shop:'Magasin de pièces',inspection_center:'Centre de visite technique',towing:'Dépannage'}[item.provider_type] || item.provider_type)} · {item.city}</p>{item.description && <p>{item.description}</p>}<div className="community-card-actions">{item.phone && <a className="community-card-link" href={'tel:' + item.phone}>Appeler <ArrowUpRight size={15}/></a>}{item.address && <a className="community-card-link" href={openDirections(item).google} target="_blank" rel="noreferrer">Itinéraire <Navigation size={15}/></a>}</div></article>;
          if (section === 'parts') return <article className="community-card" key={item.id}>{item.image_url && <img className="community-part-image" src={item.image_url} alt={item.title} loading="lazy"/>}<span className="community-card-icon"><Package/></span><span className="community-tag">{item.demo ? 'DÉMO · ' : ''}{({new:'Neuf',used:'Occasion',refurbished:'Reconditionné'}[item.condition] || item.condition)} · {item.part_category}</span><h3>{item.title}</h3><p>{[item.brand, item.compatible_vehicles, item.city].filter(Boolean).join(' · ')}</p>{item.description && <p>{item.description}</p>}<div className="community-card-bottom"><b>{money(item.price_mad)}</b></div>{item.contact_phone && <a className="community-card-link" href={'tel:' + item.contact_phone}>Contacter le vendeur <ArrowUpRight size={15}/></a>}</article>;
          return <article className="community-card community-post" key={item.id}><span className="community-card-icon"><MessageCircle/></span><span className="community-tag">{item.topic?.replaceAll('_', ' ') || 'Communauté'}{item.city ? ' · ' + item.city : ''}</span><h3>{item.title}</h3><p>{item.body}</p><small>Publié le {new Date(item.created_at).toLocaleDateString('fr-MA')}</small></article>;
        })}
      </div> : <div className="community-empty"><span className="community-empty-icon">{section === 'guides' ? <BookOpen/> : section === 'parts' ? <Package/> : section === 'services' ? <Wrench/> : section === 'insurance' ? <ShieldCheck/> : <CarFront/>}</span><h3>{section === 'guides' ? (language === 'ar' ? 'لا توجد مقالات منشورة حالياً' : language === 'en' || language === 'it' || language === 'es' ? 'No published articles yet' : 'Aucun article publié pour le moment') : 'Aucune offre publiée pour le moment'}</h3><p>{section === 'guides' ? (language === 'ar' ? 'ستظهر هنا أدلة ونصائح السيارات بعد نشرها.' : language === 'en' || language === 'it' || language === 'es' ? 'Automotive guides and community help articles will appear here once published.' : 'Les guides automobiles et articles d’aide apparaîtront ici une fois publiés.') : 'Les entrées marquées DÉMO sont des exemples synthétiques pour tester l’interface et ne sont ni des annonces réelles, ni des offres commerciales, ni des devis.'}</p></div>}
      {section === 'community' && <form className="community-compose" onSubmit={createPost}><h3>Partager avec la communauté</h3><p>Posez une question, partagez un conseil d’entretien ou racontez votre expérience sur la route.</p><select value={postTopic} onChange={e => setPostTopic(e.target.value)}><option value="general">Discussion générale</option><option value="buying_advice">Conseils d’achat</option><option value="maintenance">Entretien</option><option value="road_trip">Voyage & route</option><option value="parts">Pièces auto</option><option value="safety">Sécurité routière</option></select><input value={postTitle} onChange={e => setPostTitle(e.target.value)} placeholder="Titre de votre publication" maxLength={120} required/><textarea value={postBody} onChange={e => setPostBody(e.target.value)} placeholder="Votre message…" maxLength={5000} rows={4} required/><button className="community-primary" disabled={posting}><Send size={16}/>{posting ? 'Publication…' : user ? 'Publier' : 'Connectez-vous pour publier'}</button></form>}
    </>}
    <div className="community-trust"><BadgeCheck size={18}/><p>Les offres publiées doivent être autorisées par leur source et contrôlées par l’équipe MOROTTO. Les repères de prix restent indicatifs.</p></div>
  </section>;
}
