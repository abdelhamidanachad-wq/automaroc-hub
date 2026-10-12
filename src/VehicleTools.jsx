import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Camera, Calculator, Car, Fuel, Gauge, MapPin, Search, ShieldCheck, SlidersHorizontal, Info, Sparkles, Upload, RotateCcw, X, CheckCircle2 } from 'lucide-react';
import { brandsForCategory } from './vehicleCatalog.js';
import { supabase } from './lib/supabase.js';

const money = value => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(Number(value) || 0) + ' DH';
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr');
const categories = [{value:'Tous',label:'Tous les véhicules'},{value:'Cars',label:'Voitures'},{value:'Motos',label:'Motos'},{value:'Scooters',label:'Scooters'},{value:'Trucks',label:'Utilitaires'}];
const fuels = ['Tous','Diesel','Essence','Hybride','Électrique','Autre'];
const currentYear = new Date().getFullYear();
const generationSuffix = /\s*\((?:gen\s*)?\d+[^)]*\)\s*/ig;
const baseModelName = value => String(value || '').replace(generationSuffix, ' ').replace(/\s+/g, ' ').trim();
const fuelMatches = (listingFuel, selectedFuel) => selectedFuel === 'Tous' || normalize(listingFuel) === normalize(selectedFuel);

function PageIntro({eyebrow,title,desc}) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>;
}
function NoLiveListings({title='Pas encore assez de données',desc='MOROTTO affiche uniquement les annonces réelles publiées et validées. Aucun prix ou véhicule fictif ne sera ajouté pour remplir les résultats.'}) {
  return <div className="vt-empty"><span><Info size={22}/></span><h3>{title}</h3><p>{desc}</p></div>;
}
async function compressPhoto(file) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Choisissez une photo JPG, PNG ou WEBP.');
  if (typeof createImageBitmap !== 'function') {
    if (file.size > 2_000_000) throw new Error('La photo est trop lourde. Choisissez une image de moins de 2 Mo.');
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Impossible de lire cette photo.'));
      reader.readAsDataURL(file);
    });
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
  if (!blob) throw new Error('Impossible de préparer la photo.');
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Impossible de lire cette photo.'));
    reader.readAsDataURL(blob);
  });
}

export function CarValueEstimator({ vehicles = [] }) {
  const carBrands = useMemo(() => [...new Set([...brandsForCategory('Cars'), 'Dacia', 'Renault', 'Peugeot', 'Volkswagen', 'Toyota'])].sort((a,b)=>a.localeCompare(b,'fr')), []);
  const [brand,setBrand] = useState('Dacia');
  const [model,setModel] = useState('Sandero (Gen 3)');
  const [year,setYear] = useState(2022);
  const [mileage,setMileage] = useState(60000);
  const [fuel,setFuel] = useState('Diesel');
  const [guideRows,setGuideRows] = useState([]);
  const [guideLoading,setGuideLoading] = useState(false);
  const [guideError,setGuideError] = useState(false);
  const [photoData,setPhotoData] = useState('');
  const [photoName,setPhotoName] = useState('');
  const [photoLoading,setPhotoLoading] = useState(false);
  const [photoError,setPhotoError] = useState('');
  const [photoResult,setPhotoResult] = useState(null);
  const [photoWarning,setPhotoWarning] = useState('');

  useEffect(() => {
    let active = true;
    async function loadGuide() {
      if (!supabase) { setGuideRows([]); setGuideError(true); return; }
      setGuideLoading(true); setGuideError(false);
      const { data, error } = await supabase.rpc('search_vehicle_model_price_guide', {
        p_brand: brand, p_query: null, p_year: null, p_limit: 100
      });
      if (!active) return;
      setGuideRows(error ? [] : (data || []));
      setGuideError(Boolean(error));
      setGuideLoading(false);
    }
    loadGuide();
    return () => { active = false; };
  }, [brand]);

  const modelOptions = useMemo(() => [...new Set(guideRows.map(row => row.model))].sort((a,b)=>a.localeCompare(b,'fr')), [guideRows]);
  const selectedGuide = useMemo(() => {
    const base = normalize(baseModelName(model));
    const candidates = guideRows.filter(row => normalize(row.model) === normalize(model) || normalize(baseModelName(row.model)) === base || normalize(baseModelName(row.model)).includes(base) || base.includes(normalize(baseModelName(row.model))));
    return candidates.find(row => Number(year) >= Number(row.year_start) && Number(year) <= Number(row.year_end))
      || candidates.find(row => normalize(row.model) === normalize(model))
      || candidates[0]
      || null;
  }, [guideRows,model,year]);

  const comparables = useMemo(() => vehicles.filter(v => {
    const listingBase = normalize(baseModelName(v.model));
    const targetBase = normalize(baseModelName(model));
    const sameModel = listingBase && targetBase && (listingBase === targetBase || listingBase.includes(targetBase) || targetBase.includes(listingBase));
    return v.category === 'Cars' &&
      normalize(v.brand) === normalize(brand) &&
      sameModel &&
      Math.abs(Number(v.year) - Number(year)) <= 4 &&
      fuelMatches(v.fuel, fuel) &&
      Number(v.price) > 0;
  }),[vehicles,brand,model,year,fuel]);
  const sortedPrices = useMemo(() => comparables.map(v=>Number(v.price)).sort((a,b)=>a-b),[comparables]);
  const estimate = sortedPrices.length >= 3 ? {
    low: sortedPrices[Math.floor((sortedPrices.length - 1) * 0.2)],
    high: sortedPrices[Math.ceil((sortedPrices.length - 1) * 0.8)],
    median: sortedPrices[Math.floor((sortedPrices.length - 1) * 0.5)]
  } : null;

  const onPhotoChange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(''); setPhotoWarning(''); setPhotoResult(null); setPhotoData(''); setPhotoName(file.name);
    try { setPhotoData(await compressPhoto(file)); }
    catch (error) { setPhotoError(error.message || 'Impossible de lire la photo.'); }
    event.target.value = '';
  };

  const identifyVehicle = async () => {
    if (!photoData) { setPhotoError('Prenez une photo ou choisissez une image de votre véhicule.'); return; }
    setPhotoLoading(true); setPhotoError(''); setPhotoWarning(''); setPhotoResult(null);
    try {
      const response = await fetch('/api/vehicle-recognition', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photoData })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'La reconnaissance IA est indisponible pour le moment.');
      setPhotoResult(result);
      if (result.brand) {
        const match = carBrands.find(item => normalize(item) === normalize(result.brand));
        setBrand(match || result.brand);
      }
      if (result.model) setModel(result.model);
      if (Number.isInteger(Number(result.year)) && Number(result.year) >= 1950 && Number(result.year) <= currentYear + 1) setYear(Number(result.year));
      if (result.fuel && fuels.some(item => item !== 'Tous' && normalize(item) === normalize(result.fuel))) setFuel(fuels.find(item => item !== 'Tous' && normalize(item) === normalize(result.fuel)));
      setPhotoWarning('Suggestion IA uniquement. Vérifiez la marque, le modèle et l’année sur les documents du véhicule avant de continuer.');
    } catch (error) {
      setPhotoError(error.message || 'La reconnaissance a échoué. Vous pouvez saisir les informations manuellement.');
    } finally { setPhotoLoading(false); }
  };

  return <section className="vehicle-tool-page">
    <PageIntro eyebrow="ESTIMATION DU MARCHÉ MAROCAIN" title="Combien vaut votre voiture ?" desc="Prenez une photo pour préremplir les caractéristiques, puis comparez les annonces publiées ou consultez la fourchette indicative de notre guide marocain."/>
    <div className="vt-layout">
      <form className="vt-form" onSubmit={e=>e.preventDefault()}>
        <div className="vt-form-title"><span className="tile-icon tone-mint"><Calculator size={22}/></span><div><h2>Votre véhicule</h2><p>Commencez avec une photo ou remplissez les informations ci-dessous.</p></div></div>
        <div className="vt-photo-box">
          <div className="vt-photo-heading"><span className="vt-photo-icon"><Camera size={20}/></span><div><b>Identifier avec une photo</b><small>Caméra sur téléphone ou photo existante</small></div></div>
          <label className="vt-photo-picker">
            <Upload size={18}/><span>{photoData ? 'Changer la photo' : 'Prendre une photo / choisir une image'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" onChange={onPhotoChange}/>
          </label>
          {photoData && <div className="vt-photo-preview"><img src={photoData} alt="Aperçu de la photo du véhicule"/><div><b>{photoName || 'Photo préparée'}</b><small>La photo est envoyée pour analyse, elle n’est pas enregistrée dans votre annonce.</small><button type="button" className="vt-photo-clear" onClick={()=>{setPhotoData('');setPhotoName('');setPhotoResult(null);setPhotoError('');setPhotoWarning('')}}><X size={14}/> Retirer la photo</button></div></div>}
          <button type="button" className="btn primary full vt-ai-button" onClick={identifyVehicle} disabled={!photoData || photoLoading}>{photoLoading ? <><span className="vt-spinner"/> Analyse en cours…</> : <><Sparkles size={17}/> Détecter le véhicule avec l’IA</>}</button>
          {photoResult && <div className="vt-ai-result"><CheckCircle2 size={17}/><span><b>Suggestion détectée :</b> {[photoResult.brand,photoResult.model,photoResult.year].filter(Boolean).join(' ')}{photoResult.confidence ? ' · confiance ' + photoResult.confidence : ''}</span></div>}
          {photoWarning && <p className="vt-photo-warning">{photoWarning}</p>}
          {photoError && <p className="vt-photo-error">{photoError}</p>}
        </div>
        <label className="form-label" htmlFor="vt-brand">Marque</label>
        <select id="vt-brand" className="form-select" value={brand} onChange={e=>{setBrand(e.target.value);setModel('')}}>{[...new Set([...carBrands,brand])].sort((a,b)=>a.localeCompare(b,'fr')).map(b=><option key={b} value={b}>{b}</option>)}</select>
        <label className="form-label" htmlFor="vt-model">Modèle ou génération</label>
        <input id="vt-model" className="form-select" list="vt-model-options" value={model} onChange={e=>setModel(e.target.value)} placeholder="Ex. Sandero (Gen 3), Clio 5, Golf 7…"/>
        <datalist id="vt-model-options">{modelOptions.map(m=><option key={m} value={m}/>)}</datalist>
        <div className="vt-form-grid">
          <div><label className="form-label" htmlFor="vt-year">Année</label><input id="vt-year" className="form-select" type="number" min="1950" max={currentYear+1} value={year} onChange={e=>setYear(Math.min(currentYear+1,Math.max(1950,Number(e.target.value)||1950)))}/></div>
          <div><label className="form-label" htmlFor="vt-mileage">Kilométrage</label><input id="vt-mileage" className="form-select" type="number" min="0" max="1000000" step="5000" value={mileage} onChange={e=>setMileage(Math.max(0,Number(e.target.value)||0))}/></div>
        </div>
        <label className="form-label" htmlFor="vt-fuel">Carburant</label>
        <select id="vt-fuel" className="form-select" value={fuel} onChange={e=>setFuel(e.target.value)}>{fuels.filter(f=>f!=='Tous').map(f=><option key={f} value={f}>{f}</option>)}</select>
        {selectedGuide && <div className="vt-guide-match"><CheckCircle2 size={16}/><span>Guide trouvé : {selectedGuide.model}, {selectedGuide.year_start}–{selectedGuide.year_end}</span></div>}
        {guideLoading && <p className="vt-guide-loading">Recherche dans le référentiel de modèles…</p>}
        <div className="vt-note"><ShieldCheck size={18}/><p>L’état, l’entretien, la finition, l’historique et la situation administrative peuvent changer fortement la valeur.</p></div>
      </form>
      <div className="vt-result-panel">
        <span className="eyebrow">VOTRE ESTIMATION</span>
        <h2>{brand} {model || '—'}</h2>
        <p className="vt-summary">{year} · {Number(mileage).toLocaleString('fr-MA')} km · {fuel}</p>
        {estimate ? <>
          <div className="vt-range"><small>Fourchette observée sur les annonces publiées</small><strong>{money(estimate.low)} – {money(estimate.high)}</strong><span>Médiane des annonces comparables : {money(estimate.median)}</span></div>
          <div className="vt-evidence"><b>{comparables.length} annonces comparables</b><span>Comparaison réelle sur MOROTTO : même marque/modèle, année proche et carburant sélectionné.</span></div>
        </> : selectedGuide ? <>
          <div className="vt-range vt-guide-range"><small>Fourchette indicative du référentiel marocain</small><strong>{money(selectedGuide.price_min_mad)} – {money(selectedGuide.price_max_mad)}</strong><span>{selectedGuide.model} · {selectedGuide.year_start}–{selectedGuide.year_end}</span></div>
          <div className="vt-evidence"><b>{comparables.length ? comparables.length + ' annonce(s) réelle(s) trouvée(s), échantillon trop limité' : 'Pas encore d’annonces comparables publiées'}</b><span>{guideError ? 'Le référentiel de modèles a échoué à charger. Réessayez ou vérifiez les paramètres Supabase.' : 'Cette fourchette vient de votre guide de modèles fourni. Elle n’est pas calculée à partir de ventes vérifiées.'}</span></div>
        </> : <NoLiveListings title={guideError ? 'Référentiel indisponible' : 'Aucune fourchette fiable trouvée'} desc={guideError ? 'Le référentiel de modèles n’a pas pu être chargé. Vérifiez la connexion Supabase ou réessayez.' : 'Essayez le nom de génération exacte ou revenez lorsque MOROTTO aura plus de données.'}/>}
        {comparables.length>0&&<div className="vt-comps"><h3>Annonces réelles utilisées</h3>{comparables.slice(0,5).map(v=><div className="vt-comp" key={v.id}><span><b>{v.brand} {v.model}</b><small>{v.year} · {Number(v.mileage||0).toLocaleString('fr-MA')} km · {v.city}</small></span><strong>{money(v.price)}</strong></div>)}</div>}
        <p className="vt-disclaimer"><Info size={15}/> Estimation indicative, pas le prix final de vente ni une expertise. Le guide indique des fourchettes déclaratives fournies par l’utilisateur ; elles doivent être vérifiées. L’IA peut se tromper sur le modèle ou l’année.</p>
      </div>
    </div>
  </section>;
}

export function BudgetCarFinder({ vehicles = [], onDetails }) {
  const [category,setCategory] = useState('Cars');
  const [budgetMin,setBudgetMin] = useState(0);
  const [budgetMax,setBudgetMax] = useState(250000);
  const [brand,setBrand] = useState('Toutes');
  const [model,setModel] = useState('');
  const [fuel,setFuel] = useState('Tous');
  const [yearMin,setYearMin] = useState('');
  const [mileageMax,setMileageMax] = useState('');
  const [city,setCity] = useState('');
  const [sort,setSort] = useState('price');
  const availableBrands = useMemo(()=>category==='Tous'?[...new Set(vehicles.map(v=>v.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr')):brandsForCategory(category).filter(b=>vehicles.some(v=>v.category===category&&normalize(v.brand)===normalize(b))),[category,vehicles]);
  const results = useMemo(()=>vehicles.filter(v=>
    (category==='Tous'||v.category===category) &&
    (brand==='Toutes'||normalize(v.brand)===normalize(brand)) &&
    normalize(`${v.brand} ${v.model}`).includes(normalize(model)) &&
    Number(v.price)>=Number(budgetMin||0) && Number(v.price)<=Number(budgetMax||Number.MAX_SAFE_INTEGER) &&
    fuelMatches(v.fuel,fuel) &&
    (!yearMin||Number(v.year)>=Number(yearMin)) &&
    (!mileageMax||Number(v.mileage)<=Number(mileageMax)) &&
    (!city||normalize(v.city).includes(normalize(city)))
  ).sort((a,b)=>sort==='price'?Number(a.price)-Number(b.price):sort==='year'?Number(b.year)-Number(a.year):Number(a.mileage)-Number(b.mileage)),[vehicles,category,brand,model,budgetMin,budgetMax,fuel,yearMin,mileageMax,city,sort]);
  const reset=()=>{setCategory('Cars');setBudgetMin(0);setBudgetMax(250000);setBrand('Toutes');setModel('');setFuel('Tous');setYearMin('');setMileageMax('');setCity('');setSort('price')};
  const quickBudgets=[50000,100000,150000,250000,400000,700000];
  return <section className="vehicle-tool-page">
    <PageIntro eyebrow="RECHERCHE PERSONNALISÉE" title="La bonne voiture, dans votre budget." desc="Choisissez d’abord votre budget. Les résultats sont de vraies annonces publiées dans MOROTTO ; vos filtres affinent la liste instantanément."/>
    <div className="vt-finder-layout">
      <aside className="vt-filter-panel">
        <div className="vt-filter-heading"><span className="vt-budget-icon"><SlidersHorizontal size={20}/></span><div><h2>Votre budget</h2><p>Commencez par le montant maximum.</p></div></div>
        <div className="vt-budget-display"><span>Budget maximum</span><strong>{money(budgetMax)}</strong><small>{budgetMin>0 ? 'À partir de '+money(budgetMin) : 'Tous les prix en dessous'}</small></div>
        <input aria-label="Budget maximum en dirhams" className="range vt-budget-range" type="range" min="20000" max="1500000" step="10000" value={Math.min(1500000,Math.max(20000,budgetMax))} onChange={e=>setBudgetMax(Math.max(Number(e.target.value),budgetMin))}/>
        <div className="range-labels"><span>20 000 DH</span><span>1 500 000 DH</span></div>
        <div className="vt-budget-presets" aria-label="Budgets rapides">{quickBudgets.map(amount=><button type="button" key={amount} className={budgetMax===amount?'active':''} onClick={()=>{setBudgetMax(Math.max(amount,budgetMin));}}>{amount>=1000000?(amount/1000000).toLocaleString('fr-MA')+' M':amount>=1000?(amount/1000)+' k':' '+amount} DH</button>)}</div>
        <div className="vt-form-grid"><div><label className="form-label" htmlFor="vf-min">Budget min (DH)</label><input id="vf-min" className="form-select" type="number" min="0" max={budgetMax} step="5000" value={budgetMin} onChange={e=>setBudgetMin(Math.min(budgetMax,Math.max(0,Number(e.target.value)||0)))}/></div><div><label className="form-label" htmlFor="vf-max">Budget max (DH)</label><input id="vf-max" className="form-select" type="number" min={budgetMin} max="5000000" step="5000" value={budgetMax} onChange={e=>setBudgetMax(Math.max(budgetMin,Math.min(5000000,Number(e.target.value)||0)))}/></div></div>
        <div className="vt-divider"><span>Affiner si besoin</span></div>
        <label className="form-label" htmlFor="vf-category">Type de véhicule</label><select id="vf-category" className="form-select" value={category} onChange={e=>{setCategory(e.target.value);setBrand('Toutes')}}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <label className="form-label" htmlFor="vf-brand">Marque</label><select id="vf-brand" className="form-select" value={brand} onChange={e=>setBrand(e.target.value)}><option value="Toutes">Toutes les marques</option>{availableBrands.map(b=><option key={b} value={b}>{b}</option>)}</select>
        <label className="form-label" htmlFor="vf-model">Modèle ou mot-clé</label><input id="vf-model" className="form-select" value={model} onChange={e=>setModel(e.target.value)} placeholder="Ex. Clio, SUV…"/>
        <label className="form-label" htmlFor="vf-fuel">Carburant</label><select id="vf-fuel" className="form-select" value={fuel} onChange={e=>setFuel(e.target.value)}>{fuels.map(f=><option key={f} value={f}>{f}</option>)}</select>
        <div className="vt-form-grid"><div><label className="form-label" htmlFor="vf-year">Année minimum</label><input id="vf-year" className="form-select" type="number" min="1950" max={currentYear+1} value={yearMin} onChange={e=>setYearMin(e.target.value)} placeholder="Toutes"/></div><div><label className="form-label" htmlFor="vf-mileage">Km maximum</label><input id="vf-mileage" className="form-select" type="number" min="0" value={mileageMax} onChange={e=>setMileageMax(e.target.value)} placeholder="Sans limite"/></div></div>
        <label className="form-label" htmlFor="vf-city">Ville</label><input id="vf-city" className="form-select" value={city} onChange={e=>setCity(e.target.value)} placeholder="Casablanca, Rabat…"/>
        <button type="button" className="btn secondary full" onClick={reset}><RotateCcw size={15}/> Réinitialiser les critères</button>
      </aside>
      <div className="vt-finder-results">
        <div className="vt-results-head"><div><span className="eyebrow">ANNONCES RÉELLES PUBLIÉES</span><h2>{results.length} résultat{results.length===1?'':'s'}</h2><p>{vehicles.length ? `${vehicles.length} annonce(s) réelle(s) publiées au total avant filtrage.` : 'Le catalogue est prêt ; aucune annonce réelle n’est publiée pour le moment.'}</p></div><select aria-label="Trier les résultats" className="form-select" value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Prix croissant</option><option value="year">Plus récents</option><option value="mileage">Kilométrage faible</option></select></div>
        {results.length ? <div className="vt-finder-list">{results.slice(0,30).map(v=><article className="vt-finder-card" key={v.id}><img src={v.image} alt={`${v.brand} ${v.model}`} loading="lazy" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80'}}/><div className="vt-finder-card-body"><div className="vt-card-meta"><span>{v.brand}</span><span>{v.year}</span></div><h3>{v.model}</h3><strong>{money(v.price)}</strong><div className="vt-card-specs"><span><Fuel size={14}/>{v.fuel}</span><span><Gauge size={14}/>{Number(v.mileage||0).toLocaleString('fr-MA')} km</span><span><MapPin size={14}/>{v.city}</span></div><button className="btn primary" type="button" onClick={()=>onDetails?.(v)}>Voir l’annonce <ArrowRight size={15}/></button></div></article>)}</div> : <NoLiveListings title="Aucune annonce publiée dans ce budget" desc={vehicles.length ? 'Élargissez la fourchette, retirez un filtre ou choisissez une autre catégorie. Le moteur recherche uniquement dans les annonces réelles publiées.' : 'Les 1 500 fiches de test sont conservées en brouillon et ne sont volontairement pas affichées comme des voitures à vendre. Dès que des vendeurs publient de vrais véhicules après validation, ils apparaîtront ici automatiquement.'}/>}
        {results.length>30&&<p className="vt-disclaimer">30 annonces affichées sur {results.length} correspondances. Affinez les filtres pour réduire la liste.</p>}
      </div>
    </div>
  </section>;
}
