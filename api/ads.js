import { getAdminSupabase } from "../server/integration-vault.js";

export default async function handler(req,res) {
  res.setHeader("Cache-Control","public, s-maxage=60, stale-while-revalidate=300");
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({error:"Method not allowed."});}
  const placement=String(req.query?.placement||"global");
  const city=String(req.query?.city||"").slice(0,100);
  const allowed=new Set(["global","home","buy","rent","community","mechanic","insurance","map","learn","pro","vehicle_detail","listing_sidebar","footer"]);
  if(!allowed.has(placement))return res.status(400).json({error:"Invalid placement."});
  try {
    const db=getAdminSupabase();
    const now=new Date().toISOString();
    const [local,settings]=await Promise.all([
      db.from("ad_campaigns").select("id,advertiser_name,placement,mode,title,body,image_url,click_url,city,google_ad_slot,priority").eq("active",true).eq("mode","local").in("placement",[placement,"global"]).or("starts_at.is.null,starts_at.lte."+now).or("ends_at.is.null,ends_at.gte."+now).order("priority",{ascending:true}).limit(30),
      db.from("platform_settings").select("setting_value").eq("setting_key","platform").maybeSingle()
    ]);
    if(local.error||settings.error)return res.status(200).json({ad:null,fallback:"none"});
    const match=(local.data||[]).find(x=>!x.city||!city||x.city.toLowerCase()===city.toLowerCase());
    if(match)return res.status(200).json({ad:match,fallback:"none"});
    const platform=settings.data?.setting_value||{};
    const google=(await db.from("ad_campaigns").select("google_ad_slot,placement").eq("active",true).eq("mode","google").in("placement",[placement,"global"]).order("priority",{ascending:true}).limit(1)).data?.[0];
    return res.status(200).json({ad:null,fallback:platform.adsenseClientId&&google?.google_ad_slot?"google":"none",clientId:platform.adsenseClientId||null,slot:google?.google_ad_slot||null});
  } catch(error) { console.error("Public ads endpoint failed:",error); return res.status(200).json({ad:null,fallback:"none"}); }
}
