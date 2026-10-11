#!/usr/bin/env node
// Import authorized dealer/partner inventory. New records always enter moderation as pending.
// Required environment variables are server/terminal-only: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const input=process.argv[2];
const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!input||!url||!key){
  console.error('Usage: node scripts/import-authorized-listings.mjs <authorized.csv>');
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your terminal only. Never use VITE_ variables for the service key.');
  process.exit(2);
}
if(!fs.existsSync(input)){console.error('CSV file not found:',input);process.exit(2);}

function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(quoted){if(c==='"'&&n==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
    else if(c==='"'&&!field)quoted=true;
    else if(c===','){row.push(field);field='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&n==='\n')i++;row.push(field);field='';if(row.some(v=>v.trim()))rows.push(row);row=[];}
    else field+=c;
  }
  if(quoted)throw new Error('Unclosed quoted field in CSV.');
  if(field||row.length){row.push(field);rows.push(row);}
  if(!rows.length)throw new Error('CSV is empty.');
  const headers=rows.shift().map((v)=>v.trim().replace(/^\uFEFF/,''));
  if(new Set(headers).size!==headers.length)throw new Error('Duplicate CSV column name.');
  return rows.map((values,i)=>{const out={};headers.forEach((h,j)=>out[h]=(values[j]||'').trim());out.__row=i+2;return out;});
}

const required=['owner_id','source','source_reference','source_url','source_authorized','category','brand','model','year','price_mad','fuel','mileage_km','listing_type','city'];
const allowedSources=['dealer','authorized_import'];
const allowedCategories=['Cars','Motos','Scooters','Trucks'];
const rows=parseCsv(fs.readFileSync(input,'utf8'));
const missing=required.filter(k=>!(k in rows[0]));
if(missing.length){console.error('Missing columns: '+missing.join(', '));process.exit(2);}
const errors=[],records=[];
for(const r of rows){
  const fail=(m)=>errors.push('Row '+r.__row+': '+m);
  if(!/^[0-9a-f-]{36}$/i.test(r.owner_id)){fail('owner_id must be an existing auth user UUID.');continue;}
  if(!allowedSources.includes(r.source)){fail('source must be dealer or authorized_import.');continue;}
  if(!r.source_reference){fail('source_reference is required for deduplication.');continue;}
  if(!/^https?:\/\//i.test(r.source_url)){fail('source_url must be an http(s) URL.');continue;}
  if(!['true','1','yes'].includes(r.source_authorized.toLowerCase())){fail('source_authorized must be true and permission must be documented.');continue;}
  if(!allowedCategories.includes(r.category)){fail('Invalid category.');continue;}
  const year=Number(r.year),price=Number(r.price_mad),mileage=Number(r.mileage_km||0),cv=r.fiscal_power?Number(r.fiscal_power):null;
  if(!r.brand||r.brand.length>60||!r.model||r.model.length>100){fail('Missing/invalid brand or model.');continue;}
  if(!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+1){fail('Invalid year.');continue;}
  if(!Number.isFinite(price)||price<=0||!Number.isInteger(mileage)||mileage<0){fail('Invalid price or mileage.');continue;}
  if(cv!==null&&(!Number.isInteger(cv)||cv<1||cv>100)){fail('Invalid fiscal_power.');continue;}
  if(!r.city){fail('City is required.');continue;}
  records.push({owner_id:r.owner_id,source:r.source,source_reference:r.source_reference,source_url:r.source_url,source_authorized:true,category:r.category,brand:r.brand,model:r.model,year,price_mad:price,fuel:r.fuel||'Autre',mileage_km:mileage,fiscal_power:cv,listing_type:['Neuf','Occasion','Location'].includes(r.listing_type)?r.listing_type:'Occasion',city:r.city,image_url:r.image_url||null,description:r.description||null,status:'pending',featured:false,published_at:null});
}
if(errors.length){console.error('Import cancelled: '+errors.length+' validation error(s); no records written.');console.error(errors.slice(0,80).join('\n'));process.exit(1);}
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
let inserted=0,skipped=0;
for(let i=0;i<records.length;i+=100){
  const batch=records.slice(i,i+100),sources=[...new Set(batch.map(r=>r.source))],refs=batch.map(r=>r.source_reference);
  const {data:existing,error:lookupError}=await db.from('listings').select('source,source_reference').in('source',sources).in('source_reference',refs);
  if(lookupError)throw new Error('Duplicate check failed: '+lookupError.message);
  const existingKeys=new Set((existing||[]).map(r=>r.source+'::'+r.source_reference));
  const fresh=batch.filter(r=>!existingKeys.has(r.source+'::'+r.source_reference));
  skipped+=batch.length-fresh.length;
  if(fresh.length){const {error}=await db.from('listings').insert(fresh);if(error)throw new Error('Insert failed: '+error.message);inserted+=fresh.length;}
  console.log('Processed '+Math.min(i+100,records.length)+'/'+records.length+'; inserted '+inserted+'; skipped existing '+skipped+'.');
}
console.log('Done. New listings are pending moderation, never auto-published. Inserted: '+inserted+'. Skipped duplicates: '+skipped+'.');
