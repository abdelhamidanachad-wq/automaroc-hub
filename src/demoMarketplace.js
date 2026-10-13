import { moroccoPriceGuide } from './moroccoPriceGuide.js';

// Synthetic reference data retained only for legacy tooling and admin previews; never mix it into live offer results.
const cityList = ['Casablanca', 'Rabat', 'Tanger', 'Marrakech', 'Fès', 'Agadir', 'Oujda'];
const modelImage = (brand, model) => {
  const key = (brand + ' ' + model).toLowerCase();
  if (key.includes('golf 8') || key.includes('golf (gen 8)')) return 'https://upload.wikimedia.org/wikipedia/commons/d/d0/Volkswagen_Golf_VIII_IMG_4021.jpg';
  if (key.includes('sportage')) return 'https://upload.wikimedia.org/wikipedia/commons/b/b9/2018_Kia_Sportage_%28QL_II_MY19%29_Si_2WD_wagon_%282018-11-26%29_01.jpg';
  if (key.includes('208')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/2014_Peugeot_208_%28A9_MY13%29_Active_5-door_hatchback_%282015-11-13%29_01.jpg/1280px-2014_Peugeot_208_%28A9_MY13%29_Active_5-door_hatchback_%282015-11-13%29_01.jpg';
  if (key.includes('evoque')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/2013_Land_Rover_Range_Rover_Evoque_%28L538_MY13.5%29_SD4_Pure_Tech_4WD_5-door_wagon_%282015-11-13%29_01.jpg/1280px-2013_Land_Rover_Range_Rover_Evoque_%28L538_MY13.5%29_SD4_Pure_Tech_4WD_5-door_wagon_%282015-11-13%29_01.jpg';
  if (key.includes('qashqai')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/2010_Nissan_Qashqai_white.JPG/1280px-2010_Nissan_Qashqai_white.JPG';
  if (key.includes('yaris')) return 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Toyota_Yaris_front.JPG/1280px-Toyota_Yaris_front.JPG';
  if (brand === 'Dacia') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Dacia%20Logan%201.5DCi%20Break.jpg';
  if (brand === 'Renault') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Renault%20Clio%20IV.jpg';
  if (brand === 'BMW') return 'https://commons.wikimedia.org/wiki/Special:FilePath/BMW%203%20Series%20G20.jpg';
  if (brand === 'Mercedes-Benz') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Mercedes-Benz%20A-Class%20W176.jpg';
  if (brand === 'Audi') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Audi%20A3%208V.jpg';
  if (brand === 'Hyundai') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Hyundai%20Tucson%20NX4.jpg';
  if (brand === 'Kia') return 'https://commons.wikimedia.org/wiki/Special:FilePath/2018%20Kia%20Sportage%20%28QL%20II%20MY19%29%20Si%202WD%20wagon%20%282018-11-26%29%2001.jpg';
  if (brand === 'Toyota') return 'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota%20Yaris%20front.JPG';
  if (brand === 'Nissan') return 'https://commons.wikimedia.org/wiki/Special:FilePath/2010%20Nissan%20Qashqai%20white.JPG';
  if (brand === 'Peugeot') return 'https://commons.wikimedia.org/wiki/Special:FilePath/2014%20Peugeot%20208%20%28A9%20MY13%29%20Active%205-door%20hatchback%20%282015-11-13%29%2001.jpg';
  if (brand === 'Land Rover') return 'https://commons.wikimedia.org/wiki/Special:FilePath/2013%20Land%20Rover%20Range%20Rover%20Evoque%20%28L538%20MY13.5%29%20SD4%20Pure%20Tech%204WD%205-door%20wagon%20%282015-11-13%29%2001.jpg';
  return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=80';
};
const yearFromRange = range => {
  const years = String(range).match(/\d{4}/g) || ['2020', '2024'];
  return Math.max(Number(years[0]), Math.min(2024, Number(years[years.length - 1]) - 1));
};
export const demoVehicles = moroccoPriceGuide.map((item, index) => ({
  id: 'demo-model-' + index, category: 'Cars', brand: item.brand, model: item.model,
  year: yearFromRange(item.years), price: Math.round((item.min + item.max) / 2 / 100) * 100,
  priceMin: item.min, priceMax: item.max, fuel: item.fuel.split(' / ')[0], cv: 6 + index % 5,
  mileage: 35000 + (index % 12) * 6500, type: 'DÉMO', city: cityList[index % cityList.length],
  image: modelImage(item.brand, item.model), featured: index < 6, source: 'demo',
  demo: true, imageCredit: 'Wikimedia Commons / illustrative fallback'
}));

const rentalCities = [
  ['Casablanca', 'Casa Aéroport', 'Casa Centre'], ['Rabat', 'Rabat Agence', 'Rabat Aéroport'],
  ['Tanger', 'Tanger Ville', 'Tanger Aéroport'], ['Marrakech', 'Marrakech Médina', 'Marrakech Aéroport'],
  ['Fès', 'Fès Centre', 'Fès Aéroport'], ['Agadir', 'Agadir Plage', 'Agadir Aéroport'],
  ['Oujda', 'Oujda Centre', 'Oujda Aéroport']
];
export const demoRentals = rentalCities.flatMap(([city, first, second], i) => [
  { id: 'demo-rent-' + i + '-a', provider_name: 'Agence démo ' + first, title: 'Citadine — retrait ' + first, vehicle_brand: 'Dacia', vehicle_model: i % 2 ? 'Logan' : 'Sandero', vehicle_year: 2022, city, price_mad: 280 + i * 15, billing_period: 'day', deposit_mad: 2500 + i * 100, availability_notes: 'Exemple de démonstration, disponibilité non vérifiée', contact_phone: null, demo: true },
  { id: 'demo-rent-' + i + '-b', provider_name: 'Agence démo ' + second, title: 'SUV compact — retrait ' + second, vehicle_brand: 'Dacia', vehicle_model: 'Duster', vehicle_year: 2021, city, price_mad: 520 + i * 20, billing_period: 'day', deposit_mad: 5000 + i * 150, availability_notes: 'Exemple de démonstration, disponibilité non vérifiée', contact_phone: null, demo: true }
]);

export const demoInsurance = [
  { insurer_name: 'Sanlam', offer_name: 'Auto — formule de démonstration', coverage_summary: 'Comparatif fictif : responsabilité civile, assistance et options à confirmer par devis.', price_from_mad: 1800, demo: true },
  { insurer_name: 'Wafa Assurance', offer_name: 'Auto — formule de démonstration', coverage_summary: 'Comparatif fictif : garanties, franchises et exclusions à vérifier auprès de la compagnie.', price_from_mad: 1950, demo: true },
  { insurer_name: 'AXA', offer_name: 'Auto — formule de démonstration', coverage_summary: 'Comparatif fictif : assistance et dommages selon contrat à confirmer.', price_from_mad: 2100, demo: true },
  { insurer_name: 'RMA', offer_name: 'Auto — formule de démonstration', coverage_summary: 'Comparatif fictif : niveaux de couverture et franchises non contractuels.', price_from_mad: 1875, demo: true },
  { insurer_name: 'Saham Assurance', offer_name: 'Auto — entrée historique / démo', coverage_summary: 'Entrée demandée pour la maquette. Disponibilité commerciale et identité de l’offre à vérifier.', price_from_mad: 2050, demo: true }
];

const priceBand = (base, factor) => Math.round(base * factor / 50) * 50;
export const demoWorkshopPricing = moroccoPriceGuide.map((item, index) => {
  const base = Math.round((item.min + item.max) / 2);
  const premium = /BMW|Mercedes|Audi|Porsche|Land Rover|Volvo|Alfa Romeo/i.test(item.brand);
  const factor = premium ? 1.45 : 1;
  return {
    id: 'demo-workshop-' + index, brand: item.brand, model: item.model, years: item.years,
    fuel: item.fuel, min: item.min, max: item.max, demo: true,
    oilMin: priceBand(350, factor), oilMax: priceBand(750, factor),
    brakesMin: priceBand(500, factor), brakesMax: priceBand(1400, factor),
    batteryMin: priceBand(650, factor), batteryMax: priceBand(1600, factor),
    diagnosticMin: priceBand(150, factor), diagnosticMax: priceBand(450, factor),
    timingMin: priceBand(1600, factor), timingMax: priceBand(4200, factor),
    city: 'Toutes villes'
  };
});
export const demoParts = moroccoPriceGuide.flatMap((item, index) => [
  { id: 'demo-part-oil-' + index, title: 'Filtre à huile / entretien', part_category: 'Filtres', brand: item.brand, compatible_vehicles: item.model, condition: 'new', price_mad: 90 + (index % 8) * 20, city: 'Toutes villes', description: 'Prix indicatif de démonstration ; référence exacte à confirmer par VIN.', demo: true },
  { id: 'demo-part-brake-' + index, title: 'Kit plaquettes de frein', part_category: 'Freinage', brand: item.brand, compatible_vehicles: item.model, condition: 'new', price_mad: 280 + (index % 9) * 60, city: 'Toutes villes', description: 'Prix indicatif de démonstration ; compatibilité à confirmer par version et année.', demo: true },
  { id: 'demo-part-battery-' + index, title: 'Batterie adaptée au véhicule', part_category: 'Électricité', brand: item.brand, compatible_vehicles: item.model, condition: 'new', price_mad: 650 + (index % 7) * 100, city: 'Toutes villes', description: 'Prix indicatif de démonstration ; capacité et dimensions à vérifier.', demo: true }
]);
