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

const vehiclePhotoCache = new Map();
const vehiclePhotoInflight = new Map();
const photoVariantFor = value => {
  const source = String(value ?? '');
  let hash = 2166136261;
  for (let i=0;i<source.length;i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash,16777619); }
  return (hash >>> 0) % 4;
};
async function resolveVehiclePhoto(brand, model, year, variant) {
  const key = [normalize(brand),normalize(model),String(year||''),String(variant)].join('|');
  if (vehiclePhotoCache.has(key)) return vehiclePhotoCache.get(key);
  if (vehiclePhotoInflight.has(key)) return vehiclePhotoInflight.get(key);
  const pending = fetch('/api/demo-vehicle-image?' + new URLSearchParams({
    brand: String(brand||''), model: String(model||''), year: String(year||''), variant: String(variant)
  })).then(async response => {
    const data = await response.json().catch(() => ({}));
    const result = response.ok ? data : {imageUrl:null};
    vehiclePhotoCache.set(key,result);
    return result;
  }).catch(() => {
    const result={imageUrl:null};
    vehiclePhotoCache.set(key,result);
    return result;
  }).finally(() => vehiclePhotoInflight.delete(key));
  vehiclePhotoInflight.set(key,pending);
  return pending;
}

export function VehiclePhoto({brand, model, year, listingId, alt}) {
  const variant = useMemo(() => photoVariantFor(listingId ?? [brand,model,year].join('-')), [listingId,brand,model,year]);
  const requestKey = [normalize(brand),normalize(model),String(year||''),String(variant)].join('|');
  const [state,setState] = useState({key:'',result:null});
  const [imageFailed,setImageFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setImageFailed(false);
    setState({key:requestKey,result:null});
    resolveVehiclePhoto(brand,model,year,variant).then(result => {
      if (active) setState({key:requestKey,result});
    });
    return () => { active=false; };
  },[brand,model,year,variant,requestKey]);
  const result = state.key===requestKey ? state.result : null;
  if (result?.imageUrl && !imageFailed) return <>
    <img src={result.imageUrl} alt={alt || [brand,model,year].filter(Boolean).join(' ')} loading="lazy" onError={() => setImageFailed(true)}/>
    {result.sourceUrl && <a className="vehicle-photo-credit" href={result.sourceUrl} target="_blank" rel="noreferrer" title={`Image: ${result.title || [brand,model].join(' ')} · ${result.artist || 'Wikimedia Commons contributor'} · ${result.license || 'See source page'}`} onClick={e=>e.stopPropagation()}>Photo · {result.license || 'Wikimedia Commons'} <ArrowRight size={11}/></a>}
  </>;
  return <div className="vehicle-photo-placeholder" role="img" aria-label={`Photo exacte indisponible pour ${brand} ${model}`}>
    <Car size={38} strokeWidth={1.35}/>
    <span>{result ? 'Photo exacte non trouvée' : 'Recherche de photo du modèle…'}</span>
    <strong>{brand} {model}</strong>
    <small>{year ? 'Année ' + year : 'Illustration de modèle'}</small>
  </div>;
}

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

const shuffledRank = (value, seed) => { const text = String(seed) + ':' + String(value?.id ?? value?.brand ?? value?.model ?? ''); let h = 2166136261; for (let i=0;i<text.length;i++) { h ^= text.charCodeAt(i); h = Math.imul(h,16777619); } return h >>> 0; };

export function BudgetCarFinder({ vehicles = [], demoListings = [], demoListingsLoading = false, demoListingsError = false, onDetails }) {
  const [category,setCategory] = useState('Cars');
  const [budgetMin,setBudgetMin] = useState(0);
  const [budgetMax,setBudgetMax] = useState(250000);
  const [brand,setBrand] = useState('Toutes');
  const [model,setModel] = useState('');
  const [fuel,setFuel] = useState('Tous');
  const [yearMin,setYearMin] = useState('');
  const [mileageMax,setMileageMax] = useState('');
  const [city,setCity] = useState('');
  const [sort,setSort] = useState('random');
  const [shuffleSeed,setShuffleSeed] = useState(()=>Math.random());
  const allVehicles = useMemo(()=>[...vehicles,...demoListings],[vehicles,demoListings]);
  const availableBrands = useMemo(()=>category==='Tous'
    ? [...new Set(allVehicles.map(v=>v.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'))
    : [...new Set(allVehicles.filter(v=>v.category===category).map(v=>v.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr')),
    [category,allVehicles]);
  const results = useMemo(()=>{
    const matches=allVehicles.filter(v=>
      (category==='Tous'||v.category===category) &&
      (brand==='Toutes'||normalize(v.brand)===normalize(brand)) &&
      normalize(`${v.brand} ${v.model}`).includes(normalize(model)) &&
      Number(v.price)>=Number(budgetMin||0) &&
      Number(v.price)<=Number(budgetMax||Number.MAX_SAFE_INTEGER) &&
      fuelMatches(v.fuel,fuel) &&
      (!yearMin||Number(v.year)>=Number(yearMin)) &&
      (!mileageMax||Number(v.mileage)<=Number(mileageMax)) &&
      (!city||normalize(v.city).includes(normalize(city)))
    );
    if(sort==='price') return matches.sort((a,b)=>Number(a.price)-Number(b.price));
    if(sort==='year') return matches.sort((a,b)=>Number(b.year)-Number(a.year));
    if(sort==='mileage') return matches.sort((a,b)=>Number(a.mileage)-Number(b.mileage));
    return matches.sort((a,b)=>shuffledRank(a,shuffleSeed)-shuffledRank(b,shuffleSeed));
  },[allVehicles,category,brand,model,budgetMin,budgetMax,fuel,yearMin,mileageMax,city,sort,shuffleSeed]);
  const reset=()=>{setCategory('Cars');setBudgetMin(0);setBudgetMax(250000);setBrand('Toutes');setModel('');setFuel('Tous');setYearMin('');setMileageMax('');setCity('');setSort('random');setShuffleSeed(Math.random())};
  const quickBudgets=[50000,100000,150000,250000,400000,700000];
  return <section className="vehicle-tool-page">
    <PageIntro eyebrow="RECHERCHE PERSONNALISÉE" title="La bonne voiture, dans votre budget." desc="Les annonces réelles et les fiches de démonstration sont mélangées par défaut. Les fiches démo portent un label clair et ne sont pas de vraies offres à vendre."/>
    <div className="vt-finder-layout">
      <aside className="vt-filter-panel">
        <div className="vt-filter-heading"><span className="vt-budget-icon"><SlidersHorizontal size={20}/></span><div><h2>Votre budget</h2><p>Commencez par le montant maximum.</p></div></div>
        <div className="vt-budget-display"><span>Budget maximum</span><strong>{money(budgetMax)}</strong><small>{budgetMin>0 ? 'À partir de '+money(budgetMin) : 'Tous les prix en dessous'}</small></div>
        <input aria-label="Budget maximum en dirhams" className="range vt-budget-range" type="range" min="20000" max="1500000" step="10000" value={Math.min(1500000,Math.max(20000,budgetMax))} onChange={e=>setBudgetMax(Math.max(Number(e.target.value),budgetMin))}/>
        <div className="range-labels"><span>20 000 DH</span><span>1 500 000 DH</span></div>
        <div className="vt-budget-presets" aria-label="Budgets rapides">{quickBudgets.map(amount=><button type="button" key={amount} className={budgetMax===amount?'active':''} onClick={()=>setBudgetMax(Math.max(amount,budgetMin))}>{amount>=1000000?(amount/1000000).toLocaleString('fr-MA')+' M':(amount/1000)+' k'} DH</button>)}</div>
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
        <div className="vt-results-head">
          <div><span className="eyebrow">RÉSULTATS MÉLANGÉS</span><h2>{results.length.toLocaleString('fr-MA')} résultat{results.length===1?'':'s'}</h2><p>{vehicles.length.toLocaleString('fr-MA')} annonce(s) réelle(s) publiée(s) · {demoListings.length.toLocaleString('fr-MA')} fiche(s) démo{demoListingsLoading?' · chargement…':''}</p></div>
          <div className="market-sort-controls"><select aria-label="Trier les résultats" className="form-select" value={sort} onChange={e=>setSort(e.target.value)}><option value="random">Ordre mélangé</option><option value="price">Prix croissant</option><option value="year">Plus récents</option><option value="mileage">Kilométrage faible</option></select><button type="button" className="shuffle-listings-button" onClick={()=>{setSort('random');setShuffleSeed(Math.random())}}><Sparkles size={15}/> Mélanger</button></div>
        </div>
        {demoListings.length>0&&<div className="vt-demo-note"><Info size={16}/><span>Les fiches marquées <b>DÉMO — PAS UNE OFFRE</b> sont des exemples synthétiques. Elles ne correspondent pas à des voitures réelles à vendre et ne permettent pas de contacter un vendeur.</span></div>}
        {demoListingsError&&<div className="vt-photo-error">Les fiches démo n’ont pas pu être chargées depuis Supabase. Les annonces réelles publiées restent disponibles.</div>}
        {results.length ? <div className="vt-finder-list">{results.slice(0,30).map(v=><article className={'vt-finder-card '+(v.demo?'is-demo-listing':'')} key={(v.demo?'demo-':'real-')+v.id}>
          <div className="vt-finder-card-image">{v.demo ? <VehiclePhoto brand={v.brand} model={v.model} year={v.year} listingId={v.id} alt={`${v.brand} ${v.model}, année ${v.year}, véhicule démo`}/> : <img src={v.image || ''} alt={`${v.brand} ${v.model}`} loading="lazy" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80'}}/>}{v.demo&&<span className="vt-demo-overlay">DÉMO · PAS UNE OFFRE</span>}</div>
          <div className="vt-finder-card-body"><div className="vt-card-meta"><span>{v.brand}</span><span>{v.year}</span></div><h3>{v.model}</h3><strong>{money(v.price)}</strong><div className="vt-card-specs"><span><Fuel size={14}/>{v.fuel}</span><span><Gauge size={14}/>{Number(v.mileage||0).toLocaleString('fr-MA')} km</span><span><MapPin size={14}/>{v.city}</span></div><button className="btn primary" type="button" onClick={()=>onDetails?.(v)}>{v.demo?'Voir la fiche démo':'Voir l’annonce'} <ArrowRight size={15}/></button></div>
        </article>)}</div> : demoListingsLoading ? <NoLiveListings title="Chargement des fiches de démonstration…" desc="Nous récupérons les exemples depuis Supabase. Les fiches seront mélangées aux annonces réelles publiées."/> : <NoLiveListings title="Aucun véhicule dans ce budget" desc={allVehicles.length ? 'Élargissez la fourchette ou retirez un filtre pour trouver plus de résultats.' : 'Aucune annonce réelle n’est publiée pour le moment. Les fiches de démonstration ne sont pas disponibles.'}/>}
        {results.length>30&&<p className="vt-disclaimer">30 fiches affichées sur {results.length.toLocaleString('fr-MA')} résultats. Modifiez les filtres ou mélangez l’ordre pour explorer d’autres résultats.</p>}
      </div>
    </div>
  </section>;
}
