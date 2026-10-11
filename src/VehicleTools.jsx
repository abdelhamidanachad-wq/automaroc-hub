import React, { useMemo, useState } from 'react';
import { ArrowRight, Calculator, Car, Fuel, Gauge, MapPin, Search, ShieldCheck, SlidersHorizontal, Info } from 'lucide-react';
import { brandsForCategory, modelsFor } from './vehicleCatalog.js';

const money = value => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(value) + ' DH';
const normalize = value => String(value || '').trim().toLocaleLowerCase('fr');
const categories = [{value:'Tous',label:'Tous les véhicules'},{value:'Cars',label:'Voitures'},{value:'Motos',label:'Motos'},{value:'Scooters',label:'Scooters'},{value:'Trucks',label:'Utilitaires'}];
const fuels = ['Tous','Diesel','Essence','Hybride','Électrique','Autre'];
const currentYear = new Date().getFullYear();

function PageIntro({eyebrow,title,desc}) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>;
}
function NoLiveListings({title='Pas encore assez de données',desc='MOROTTO affiche uniquement les annonces réelles publiées et validées. Aucun prix ou véhicule fictif ne sera ajouté pour remplir les résultats.'}) {
  return <div className="vt-empty"><span><Info size={22}/></span><h3>{title}</h3><p>{desc}</p></div>;
}

export function CarValueEstimator({ vehicles = [] }) {
  const carBrands = useMemo(() => brandsForCategory('Cars'), []);
  const [brand,setBrand] = useState('Dacia');
  const [model,setModel] = useState('Sandero');
  const [year,setYear] = useState(currentYear - 5);
  const [mileage,setMileage] = useState(60000);
  const [fuel,setFuel] = useState('Diesel');
  const [customModel,setCustomModel] = useState(false);
  const modelOptions = modelsFor('Cars',brand);
  const comparables = useMemo(() => vehicles.filter(v =>
    v.category === 'Cars' &&
    normalize(v.brand) === normalize(brand) &&
    normalize(v.model) === normalize(model) &&
    Math.abs(Number(v.year) - Number(year)) <= 4 &&
    (!fuel || fuel === 'Tous' || normalize(v.fuel) === normalize(fuel)) &&
    Number(v.price) > 0
  ),[vehicles,brand,model,year,fuel]);
  const sortedPrices = useMemo(() => comparables.map(v=>Number(v.price)).sort((a,b)=>a-b),[comparables]);
  const estimate = sortedPrices.length >= 3 ? {
    low: sortedPrices[Math.floor((sortedPrices.length - 1) * 0.2)],
    high: sortedPrices[Math.ceil((sortedPrices.length - 1) * 0.8)],
    median: sortedPrices[Math.floor((sortedPrices.length - 1) * 0.5)]
  } : null;
  const suggestedModels = modelOptions.length ? modelOptions : [];
  return <section className="vehicle-tool-page">
    <PageIntro eyebrow="ESTIMATION DU MARCHÉ MAROCAIN" title="Combien vaut votre voiture ?" desc="Choisissez le véhicule. La fourchette est calculée uniquement si MOROTTO dispose d’assez d’annonces comparables publiées."/>
    <div className="vt-layout">
      <form className="vt-form" onSubmit={e=>e.preventDefault()}>
        <div className="vt-form-title"><span className="tile-icon tone-mint"><Calculator size={22}/></span><div><h2>Votre véhicule</h2><p>Plus les caractéristiques sont précises, plus la comparaison est pertinente.</p></div></div>
        <label className="form-label" htmlFor="vt-brand">Marque</label>
        <select id="vt-brand" className="form-select" value={brand} onChange={e=>{setBrand(e.target.value);setModel(modelsFor('Cars',e.target.value)[0]||'');setCustomModel(false)}}>{carBrands.map(b=><option key={b} value={b}>{b}</option>)}</select>
        <label className="form-label" htmlFor="vt-model">Modèle</label>
        <input id="vt-model" className="form-select" list="vt-model-options" value={model} onChange={e=>{setModel(e.target.value);setCustomModel(!modelsFor('Cars',brand).includes(e.target.value))}} placeholder="Ex. Sandero, Clio, Golf…"/>
        <datalist id="vt-model-options">{suggestedModels.map(m=><option key={m} value={m}/>)}</datalist>
        <div className="vt-form-grid">
          <div><label className="form-label" htmlFor="vt-year">Année</label><input id="vt-year" className="form-select" type="number" min="1980" max={currentYear+1} value={year} onChange={e=>setYear(Math.min(currentYear+1,Math.max(1980,Number(e.target.value)||1980)))}/></div>
          <div><label className="form-label" htmlFor="vt-mileage">Kilométrage</label><input id="vt-mileage" className="form-select" type="number" min="0" max="1000000" step="5000" value={mileage} onChange={e=>setMileage(Math.max(0,Number(e.target.value)||0))}/></div>
        </div>
        <label className="form-label" htmlFor="vt-fuel">Carburant</label>
        <select id="vt-fuel" className="form-select" value={fuel} onChange={e=>setFuel(e.target.value)}>{fuels.filter(f=>f!=='Tous').map(f=><option key={f} value={f}>{f}</option>)}</select>
        <div className="vt-note"><ShieldCheck size={18}/><p>L’état, l’entretien, la finition, l’historique et la situation administrative peuvent changer fortement la valeur.</p></div>
      </form>
      <div className="vt-result-panel">
        <span className="eyebrow">RÉSULTAT FONDÉ SUR LES ANNONCES</span>
        <h2>{brand} {model || '—'}</h2>
        <p className="vt-summary">{year} · {Number(mileage).toLocaleString('fr-MA')} km · {fuel}</p>
        {estimate ? <>
          <div className="vt-range"><small>Fourchette observée</small><strong>{money(estimate.low)} – {money(estimate.high)}</strong><span>Médiane des annonces comparables : {money(estimate.median)}</span></div>
          <div className="vt-evidence"><b>{comparables.length} annonces comparables</b><span>Véhicules publiés sur MOROTTO, même marque/modèle, années proches et carburant sélectionné.</span></div>
        </> : <NoLiveListings title={comparables.length ? 'Échantillon trop limité' : 'Aucune comparaison fiable pour le moment'} desc={comparables.length ? `Seulement ${comparables.length} annonce(s) correspondent à ces critères. Nous affichons les données observées, mais pas de fourchette estimée sans au moins 3 comparables.` : 'Aucune annonce publiée ne correspond exactement à cette marque, ce modèle, cette période et ce carburant. Essayez un autre véhicule ou revenez lorsque davantage d’annonces auront été validées.'}/>}
        {comparables.length>0&&<div className="vt-comps"><h3>Annonces utilisées</h3>{comparables.slice(0,5).map(v=><div className="vt-comp" key={v.id}><span><b>{v.brand} {v.model}</b><small>{v.year} · {Number(v.mileage||0).toLocaleString('fr-MA')} km · {v.city}</small></span><strong>{money(v.price)}</strong></div>)}</div>}
        <p className="vt-disclaimer"><Info size={15}/> Estimation indicative à partir des prix affichés, pas du prix final de vente ni d’une expertise. Le kilométrage est indiqué pour décrire votre véhicule ; les comparables ne sont pas corrigés mathématiquement en fonction de l’état.</p>
      </div>
    </div>
  </section>;
}

export function BudgetCarFinder({ vehicles = [], onDetails }) {
  const [category,setCategory] = useState('Cars');
  const [budgetMin,setBudgetMin] = useState(20000);
  const [budgetMax,setBudgetMax] = useState(250000);
  const [brand,setBrand] = useState('Toutes');
  const [model,setModel] = useState('');
  const [fuel,setFuel] = useState('Tous');
  const [yearMin,setYearMin] = useState('');
  const [mileageMax,setMileageMax] = useState('');
  const [city,setCity] = useState('');
  const [sort,setSort] = useState('price');
  const availableBrands = useMemo(()=>category==='Tous'?[...new Set(vehicles.map(v=>v.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr')):brandsForCategory(category),[category,vehicles]);
  const results = useMemo(()=>vehicles.filter(v=>
    (category==='Tous'||v.category===category) &&
    (brand==='Toutes'||normalize(v.brand)===normalize(brand)) &&
    normalize(`${v.brand} ${v.model}`).includes(normalize(model)) &&
    Number(v.price)>=Number(budgetMin||0) && Number(v.price)<=Number(budgetMax||Number.MAX_SAFE_INTEGER) &&
    (fuel==='Tous'||normalize(v.fuel)===normalize(fuel)) &&
    (!yearMin||Number(v.year)>=Number(yearMin)) &&
    (!mileageMax||Number(v.mileage)<=Number(mileageMax)) &&
    (!city||normalize(v.city).includes(normalize(city)))
  ).sort((a,b)=>sort==='price'?Number(a.price)-Number(b.price):sort==='year'?Number(b.year)-Number(a.year):Number(b.mileage)-Number(a.mileage)),[vehicles,category,brand,model,budgetMin,budgetMax,fuel,yearMin,mileageMax,city,sort]);
  const reset=()=>{setCategory('Cars');setBudgetMin(20000);setBudgetMax(250000);setBrand('Toutes');setModel('');setFuel('Tous');setYearMin('');setMileageMax('');setCity('');setSort('price')};
  return <section className="vehicle-tool-page">
    <PageIntro eyebrow="RECHERCHE PERSONNALISÉE" title="Trouvez le véhicule dans votre budget." desc="Combinez budget, marque, modèle, carburant, année, kilométrage et ville. Les résultats viennent uniquement des annonces publiées sur MOROTTO."/>
    <div className="vt-finder-layout">
      <aside className="vt-filter-panel">
        <div className="vt-filter-heading"><SlidersHorizontal size={19}/><div><h2>Vos critères</h2><p>Affinez les résultats en direct.</p></div></div>
        <label className="form-label" htmlFor="vf-category">Type de véhicule</label><select id="vf-category" className="form-select" value={category} onChange={e=>{setCategory(e.target.value);setBrand('Toutes')}}>{categories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <label className="form-label" htmlFor="vf-brand">Marque</label><select id="vf-brand" className="form-select" value={brand} onChange={e=>setBrand(e.target.value)}><option value="Toutes">Toutes les marques</option>{availableBrands.map(b=><option key={b} value={b}>{b}</option>)}</select>
        <label className="form-label" htmlFor="vf-model">Modèle ou mot-clé</label><input id="vf-model" className="form-select" value={model} onChange={e=>setModel(e.target.value)} placeholder="Ex. Clio, SUV…"/>
        <div className="vt-form-grid"><div><label className="form-label" htmlFor="vf-min">Budget min (DH)</label><input id="vf-min" className="form-select" type="number" min="0" value={budgetMin} onChange={e=>setBudgetMin(Math.max(0,Number(e.target.value)||0))}/></div><div><label className="form-label" htmlFor="vf-max">Budget max (DH)</label><input id="vf-max" className="form-select" type="number" min="0" value={budgetMax} onChange={e=>setBudgetMax(Math.max(0,Number(e.target.value)||0))}/></div></div>
        <label className="form-label" htmlFor="vf-fuel">Carburant</label><select id="vf-fuel" className="form-select" value={fuel} onChange={e=>setFuel(e.target.value)}>{fuels.map(f=><option key={f} value={f}>{f}</option>)}</select>
        <div className="vt-form-grid"><div><label className="form-label" htmlFor="vf-year">Année minimum</label><input id="vf-year" className="form-select" type="number" min="1980" max={currentYear+1} value={yearMin} onChange={e=>setYearMin(e.target.value)} placeholder="Toutes"/></div><div><label className="form-label" htmlFor="vf-mileage">Km maximum</label><input id="vf-mileage" className="form-select" type="number" min="0" value={mileageMax} onChange={e=>setMileageMax(e.target.value)} placeholder="Sans limite"/></div></div>
        <label className="form-label" htmlFor="vf-city">Ville</label><input id="vf-city" className="form-select" value={city} onChange={e=>setCity(e.target.value)} placeholder="Casablanca, Rabat…"/>
        <button type="button" className="btn secondary full" onClick={reset}>Réinitialiser les critères</button>
      </aside>
      <div className="vt-finder-results">
        <div className="vt-results-head"><div><span className="eyebrow">ANNONCES PUBLIÉES</span><h2>{results.length} résultat{results.length===1?'':'s'}</h2></div><select aria-label="Trier les résultats" className="form-select" value={sort} onChange={e=>setSort(e.target.value)}><option value="price">Prix croissant</option><option value="year">Plus récents</option><option value="mileage">Kilométrage faible</option></select></div>
        {results.length ? <div className="vt-finder-list">{results.slice(0,30).map(v=><article className="vt-finder-card" key={v.id}><img src={v.image} alt={`${v.brand} ${v.model}`} loading="lazy"/><div className="vt-finder-card-body"><div className="vt-card-meta"><span>{v.brand}</span><span>{v.year}</span></div><h3>{v.model}</h3><strong>{money(v.price)}</strong><div className="vt-card-specs"><span><Fuel size={14}/>{v.fuel}</span><span><Gauge size={14}/>{Number(v.mileage||0).toLocaleString('fr-MA')} km</span><span><MapPin size={14}/>{v.city}</span></div><button className="btn primary" type="button" onClick={()=>onDetails?.(v)}>Voir l’annonce <ArrowRight size={15}/></button></div></article>)}</div> : <NoLiveListings title="Aucun véhicule ne correspond" desc="Essayez d’augmenter le budget maximum, d’élargir la zone ou de retirer un filtre. Seules les annonces réellement publiées sont affichées."/>}
        {results.length>30&&<p className="vt-disclaimer">30 annonces affichées sur {results.length} correspondances. Affinez les filtres pour réduire la liste.</p>}
      </div>
    </div>
  </section>;
}
