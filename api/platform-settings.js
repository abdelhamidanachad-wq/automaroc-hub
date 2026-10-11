import { getAdminSupabase } from "../server/integration-vault.js";
const DEFAULTS={siteName:"MOROTTO",maintenanceMode:false,allowSignups:true,defaultCity:"Casablanca",inventoryPageSize:24};
export default async function handler(req,res){
 res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=300");
 if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed."});}
 try{const db=getAdminSupabase();const {data,error}=await db.from("platform_settings").select("setting_value").eq("setting_key","platform").maybeSingle();if(error)return res.status(200).json(DEFAULTS);const value=data?.setting_value||{};return res.status(200).json({...DEFAULTS,siteName:String(value.siteName||DEFAULTS.siteName),maintenanceMode:value.maintenanceMode===true,allowSignups:value.allowSignups!==false,defaultCity:String(value.defaultCity||DEFAULTS.defaultCity),inventoryPageSize:Math.min(100,Math.max(12,Number(value.inventoryPageSize)||24))});}catch(e){console.error("Public platform settings error:",e);return res.status(200).json(DEFAULTS);}
}