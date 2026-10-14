import { vehicleCatalog } from './vehicleCatalog.js';

// Synthetic showcase inventory for development and product demos. These are not real seller offers.
const cities = ['Casablanca','Rabat','Tanger','Marrakech','Fès','Agadir','Meknès','Oujda','Kénitra','Tétouan','El Jadida','Safi'];
const fuels = {
  Cars: ['Diesel','Essence','Hybride','Électrique'],
  Motos: ['Essence','Essence','Essence'],
  Scooters: ['Essence','Essence','Électrique'],
  Trucks: ['Diesel','Diesel','Diesel']
};
const categoryTargets = { Cars: 900, Motos: 260, Scooters: 240, Trucks: 100 };
const priceFor = (category, brand, model, i) => {
  const text = (brand + ' ' + model).toLowerCase();
  let base = category === 'Motos' ? 45000 : category === 'Scooters' ? 18000 : category === 'Trucks' ? 190000 : 145000;
  if (/dacia|kia|fiat|citroen|suzuki|zongshen|sym|kymco/.test(text)) base *= 0.72;
  if (/bmw|mercedes|audi|porsche|lexus|ducati|triumph|tesla|land rover|volvo/.test(text)) base *= 2.25;
  if (/duster|tiguan|qashqai|sportage|tucson|rav4|suv|land cruiser/.test(text)) base *= 1.35;
  if (/electric|e-tron|model 3|model y|spring|dolphin|atto 3|ev6|ioniq/.test(text)) base *= 1.45;
  if (/nmax|pcx|dio|agility|like 125|tmax|forza/.test(text)) base = category === 'Scooters' ? 28000 : base;
  const ageFactor = Math.max(0.55, 1 - (2026 - (2015 + (i % 12))) * 0.035);
  const variation = 0.84 + ((i * 37) % 31) / 100;
  return Math.round((base * ageFactor * variation) / 500) * 500;
};
const modelPools = Object.entries(vehicleCatalog).map(([category, brands]) => ({
  category,
  models: Object.entries(brands).flatMap(([brand, models]) => models.map(model => ({ category, brand, model })))
}));
const getPool = category => modelPools.find(p => p.category === category)?.models || [];
const allPool = Object.values(categoryTargets).flatMap((count, idx) => {
  const category = Object.keys(categoryTargets)[idx];
  const pool = getPool(category);
  return Array.from({ length: count }, (_, i) => {
    const vehicle = pool[i % Math.max(1, pool.length)] || { category, brand: category === 'Motos' ? 'Honda' : 'Dacia', model: category === 'Motos' ? 'CB500F' : 'Logan' };
    return { ...vehicle, serial: i, category };
  });
});
export const expandedVehicles = allPool.map((item, index) => {
  const year = 2015 + ((index * 7 + item.serial * 3) % 12);
  const category = item.category;
  const fuelList = fuels[category] || ['Diesel','Essence'];
  return {
    id: 'showcase-' + String(index + 1).padStart(4, '0'),
    category, brand: item.brand, model: item.model, year,
    price: priceFor(category, item.brand, item.model, index),
    fuel: fuelList[(index + item.serial) % fuelList.length],
    cv: category === 'Scooters' ? 2 + (index % 4) : category === 'Motos' ? 4 + (index % 9) : category === 'Trucks' ? 9 + (index % 8) : 5 + (index % 10),
    mileage: category === 'Scooters' ? 1800 + ((index * 911) % 38000) : 8000 + ((index * 1733) % (category === 'Trucks' ? 240000 : 180000)),
    type: 'Occasion',
    city: cities[(index * 5 + item.serial) % cities.length],
    image: '',
    featured: index % 37 === 0,
    source: 'catalogue',
    sampleInventory: true,
    sellerId: 'sample-seller-' + (index % 24 + 1),
  };
});
export const sampleSellerProfiles = [
  {id:'sample-seller-1',name:'Youssef Auto',type:'individual',city:'Casablanca',joined:'2025',listings:18,bio:'Passionné automobile, historique et documents disponibles sur demande.'},
  {id:'sample-seller-2',name:'Atlas Motors',type:'dealer',city:'Rabat',joined:'2024',listings:42,bio:'Vitrine automobile de présentation. Disponibilité réelle à confirmer.'},
  {id:'sample-seller-3',name:'Casa Mobility',type:'rental_agency',city:'Casablanca',joined:'2024',listings:26,bio:'Profil d’agence de location de présentation.'},
  {id:'sample-seller-4',name:'Garage Al Amal',type:'garage',city:'Marrakech',joined:'2025',listings:12,bio:'Profil atelier de présentation pour services et entretien.'},
  {id:'sample-seller-5',name:'Salma B.',type:'individual',city:'Tanger',joined:'2025',listings:3,bio:'Compte particulier de présentation.'},
  {id:'sample-seller-6',name:'Moto Corner',type:'dealer',city:'Agadir',joined:'2024',listings:31,bio:'Spécialiste motos et deux-roues, profil de présentation.'},
  {id:'sample-seller-7',name:'Pièces Express Maroc',type:'parts_seller',city:'Casablanca',joined:'2025',listings:120,bio:'Catalogue de pièces de présentation ; compatibilité à vérifier.'},
  {id:'sample-seller-8',name:'Rabat Auto Services',type:'service_provider',city:'Rabat',joined:'2024',listings:15,bio:'Profil de services auto de présentation.'},
  {id:'sample-seller-9',name:'Nadia El Fassi',type:'individual',city:'Fès',joined:'2025',listings:2,bio:'Compte particulier de présentation.'},
  {id:'sample-seller-10',name:'Premium Drive',type:'rental_agency',city:'Marrakech',joined:'2024',listings:34,bio:'Profil d’agence de location de présentation.'},
  {id:'sample-seller-11',name:'Auto Conseil Maroc',type:'partner',city:'Casablanca',joined:'2024',listings:8,bio:'Partenaire éditorial de présentation.'},
  {id:'sample-seller-12',name:'Mécanique du Nord',type:'mechanic',city:'Tétouan',joined:'2025',listings:9,bio:'Profil professionnel de présentation.'},
  ...Array.from({length:12},(_,i)=>({id:'sample-seller-'+(i+13),name:['Omar Auto','Tanger Motors','MobiCar','Garage Atlas','Deux Roues Casa','Pro Parts','Marrakech Auto','Rif Services','Agadir Mobilité','Fès Auto Pro','Casa Scooter','Maroc Auto Conseil'][i],type:['individual','dealer','rental_agency','garage','dealer','parts_seller','service_provider','mechanic','partner','dealer','rental_agency','partner'][i],city:cities[(i*3+2)%cities.length],joined:'2025',listings:4+(i*7)%45,bio:'Compte fictif de présentation. Identité et coordonnées non vérifiées.'}))
];
export const demoAccountTypes = [
  {type:'individual',label:'Particulier',description:'Favoris, annonces personnelles et messages vendeur.'},
  {type:'dealer',label:'Concessionnaire / vendeur',description:'Vitrine, gestion des véhicules et modération.'},
  {type:'rental_agency',label:'Agence de location',description:'Véhicules, tarifs, disponibilités et demandes de réservation.'},
  {type:'partner',label:'Partenaire',description:'Offres partenaires et visibilité professionnelle.'},
  {type:'service_provider',label:'Prestataire de services',description:'Garage, mécanique, entretien et rendez-vous.'},
  {type:'parts_seller',label:'Vendeur de pièces',description:'Catalogue, compatibilité et demandes de devis.'},
  {type:'admin',label:'Administrateur',description:'Gestion des comptes, rôles et modération. Accès réel réservé aux rôles attribués côté serveur.'}
];
