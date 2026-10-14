import React, { useEffect, useState } from 'react';
import { UserRound, Building2, Wrench, KeyRound, CarFront, ShieldCheck, Plus, RefreshCw, Clock3, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from './lib/supabase.js';
import { brandsForCategory, modelsFor } from './vehicleCatalog.js';

const types = {
  individual: {label:'Particulier', icon:UserRound, desc:'Gérez vos favoris et publiez vos annonces automobiles.'},
  dealer: {label:'Concessionnaire', icon:Building2, desc:'Gérez votre vitrine et soumettez vos véhicules à modération.'},
  garage: {label:'Garage', icon:Wrench, desc:'Présentez votre activité et développez votre présence dans l’écosystème auto.'},
  rental_agency: {label:'Agence de location', icon:KeyRound, desc:'Gérez vos annonces et votre activité de location.'},
  mechanic: {label:'Mécanicien', icon:Wrench, desc:'Présentez votre activité et gérez votre vitrine professionnelle.'},
  insurance_agency: {label:'Agence d’assurance', icon:ShieldCheck, desc:'Préparez votre vitrine d’assurance automobile.'},
  parts_seller: {label:'Vendeur de pièces', icon:CarFront, desc:'Gérez votre catalogue de pièces et vos annonces.'},
  partner: {label:'Partenaire', icon:Building2, desc:'Gérez vos offres et votre vitrine partenaire.'},
  service_provider: {label:'Prestataire de services', icon:Wrench, desc:'Gérez vos services, devis et rendez-vous.'}
};

export default function AccountDashboard({user, notify}) {
  const accountType = types[user?.user_metadata?.account_type] ? user.user_metadata.account_type : 'individual';
  const config = types[accountType];
  const Icon = config.icon;
  const [listings,setListings] = useState([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [showForm,setShowForm] = useState(false);
  const [editingId,setEditingId] = useState(null);
  const [form,setForm] = useState({brand:'',model:'',year:String(new Date().getFullYear()),price:'',city:'Casablanca',category:'Cars',fuel:'Diesel',mileage:'0'});
  const load = async () => {
    if(!supabase || !user) return;
    setLoading(true);
    const {data,error:loadError}=await supabase.from('listings').select('id,category,brand,model,year,price_mad,city,status,created_at,fuel,mileage_km').eq('owner_id',user.id).order('created_at',{ascending:false}).limit(100);
    if(loadError) setError(loadError.message); else setListings(data||[]);
    setLoading(false);
  };
  useEffect(()=>{load()},[user?.id]);
  const update=(key,value)=>setForm(old=>({...old,[key]:value}));
  const brandOptions=brandsForCategory(form.category);
  const modelOptions=modelsFor(form.category,form.brand);
  const editListing=item=>{setEditingId(item.id);setForm({brand:item.brand||'',model:item.model||'',year:String(item.year||new Date().getFullYear()),price:String(item.price_mad||''),city:item.city||'Casablanca',category:item.category||'Cars',fuel:item.fuel||'Diesel',mileage:String(item.mileage_km||0)});setShowForm(true);};
  const submit=async e=>{
    e.preventDefault();setSaving(true);setError('');
    const payload={owner_id:user.id,brand:form.brand.trim(),model:form.model.trim(),year:Number(form.year),price_mad:Number(form.price),city:form.city.trim(),category:form.category,fuel:form.fuel,mileage_km:Number(form.mileage||0),listing_type:'Occasion',status:'pending',source:accountType==='dealer'?'dealer':'seller'};
    const {error:saveError}=editingId ? await supabase.from('listings').update(payload).eq('id',editingId).eq('owner_id',user.id).in('status',['draft','pending','rejected']) : await supabase.from('listings').insert(payload);
    if(saveError)setError(saveError.message);
    else {setForm({brand:'',model:'',year:String(new Date().getFullYear()),price:'',city:'Casablanca',category:'Cars',fuel:'Diesel',mileage:'0'});setShowForm(false);setEditingId(null);notify?.(editingId?'Annonce mise à jour et soumise à modération':'Annonce envoyée pour modération');await load();}
    setSaving(false);
  };
  return <section className="account-page">
    <div className="account-hero"><div className="account-avatar"><Icon size={26}/></div><div className="account-hero-copy"><span className="auth-eyebrow">ESPACE PERSONNEL & PROFESSIONNEL</span><h1>Bonjour{user?.user_metadata?.display_name?' '+user.user_metadata.display_name:''}.</h1><p>{user?.email}</p><span className="account-type-pill">{config.label} · identité de connexion confirmée</span></div><div className="account-orb"/></div>
    <div className="account-welcome"><div><h2>Votre espace MOROTTO</h2><p>{config.desc}</p></div><button className="admin-refresh" onClick={load} disabled={loading}><RefreshCw size={16}/> Actualiser</button></div>
    <div className="account-metrics"><div><span><CarFront size={20}/></span><small>Mes annonces</small><b>{listings.length}</b></div><div><span><Clock3 size={20}/></span><small>En attente</small><b>{listings.filter(x=>x.status==='pending').length}</b></div><div><span><CheckCircle2 size={20}/></span><small>Publiées</small><b>{listings.filter(x=>x.status==='published').length}</b></div></div>
    <div className="account-list-head"><div><h2>Mes annonces</h2><p>Chaque nouvelle annonce est envoyée à l’équipe de modération.</p></div><button className="auth-submit account-add" onClick={()=>{setShowForm(!showForm);setEditingId(null);}}><Plus size={17}/>{showForm?'Fermer le formulaire':'Déposer une annonce'}</button></div>
    {showForm&&<form className="listing-form" onSubmit={submit}><label>Marque<input list="morotto-brand-options" value={form.brand} onChange={e=>setForm(old=>({...old,brand:e.target.value,model:""}))} placeholder="Choisir ou saisir une marque" maxLength={60} required/><datalist id="morotto-brand-options">{brandOptions.map(b=><option key={b} value={b}/>)}</datalist></label><label>Modèle<input list="morotto-model-options" value={form.model} onChange={e=>update("model",e.target.value)} placeholder={form.brand?"Choisir ou saisir un modèle":"Saisissez d’abord une marque"} maxLength={100} required disabled={!form.brand}/><datalist id="morotto-model-options">{modelOptions.map(m=><option key={m} value={m}/>)}</datalist></label><label>Année<input type="number" min="1950" max="2100" value={form.year} onChange={e=>update('year',e.target.value)} required/></label><label>Prix (DH)<input type="number" min="1" value={form.price} onChange={e=>update('price',e.target.value)} placeholder="125000" required/></label><label>Ville<input value={form.city} onChange={e=>update('city',e.target.value)} maxLength={100} required/></label><label>Catégorie<select value={form.category} onChange={e=>setForm(old=>({...old,category:e.target.value,brand:'',model:''}))}><option value="Cars">Voitures</option><option value="Motos">Motos</option><option value="Scooters">Scooters</option><option value="Trucks">Utilitaires</option></select></label><label>Carburant<select value={form.fuel} onChange={e=>update('fuel',e.target.value)}><option>Diesel</option><option>Essence</option><option>Hybride</option><option>Électrique</option><option>Autre</option></select></label><label>Kilométrage<input type="number" min="0" value={form.mileage} onChange={e=>update('mileage',e.target.value)}/></label><div className="listing-form-actions"><button className="auth-submit" disabled={saving}>{saving?'Enregistrement…':editingId?'Enregistrer les modifications':'Envoyer pour modération'}</button><small>Statut initial : en attente. La publication publique nécessite une validation.</small></div></form>}
    {error&&<p className="auth-error account-error"><AlertCircle size={16}/>{error}</p>}
    {loading?<div className="admin-empty">Chargement de vos annonces…</div>:listings.length?<div className="admin-table">{listings.map(item=><article className="admin-row" key={item.id}><div className="admin-car-icon"><CarFront size={20}/></div><div className="admin-row-main"><b>{item.brand} {item.model} · {item.year}</b><span>{item.city} · {new Intl.NumberFormat('fr-MA').format(item.price_mad)} DH</span><small>Déposée le {new Date(item.created_at).toLocaleDateString('fr-MA')}</small></div><div className="account-list-actions">{['draft','pending','rejected'].includes(item.status)&&<button type="button" className="account-edit-listing" onClick={()=>editListing(item)}>Modifier</button>}<span className={'admin-status '+item.status}>{item.status}</span></div></article>)}</div>:<div className="admin-empty">Vous n’avez pas encore publié d’annonce. Votre première annonce apparaîtra ici.</div>}
  </section>;
}
