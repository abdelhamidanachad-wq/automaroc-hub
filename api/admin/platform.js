import { getAdminSupabase, requireSuperadmin } from "../../server/integration-vault.js";

const DEFAULTS = { siteName: "MOROTTO", maintenanceMode: false, supportEmail: "", defaultCity: "Casablanca", allowSignups: true, inventoryPageSize: 24 };
const PLACEMENTS = ["global","home","buy","rent","community","mechanic","insurance","map","learn","pro","vehicle_detail","listing_sidebar","footer"];
function send(res, status, body) { return res.status(status).json(body); }
function safeUrl(value) { return !value || /^https?:\/\//i.test(String(value)); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET","POST","DELETE"].includes(req.method)) { res.setHeader("Allow","GET, POST, DELETE"); return send(res,405,{error:"Method not allowed."}); }
  try {
    const db = getAdminSupabase();
    const auth = await requireSuperadmin(req, db);
    if (auth.error) return send(res, auth.status, {error:auth.error});
    if (req.method === "GET") {
      const [settings, ads] = await Promise.all([
        db.from("platform_settings").select("setting_value").eq("setting_key","platform").maybeSingle(),
        db.from("ad_campaigns").select("*").order("priority",{ascending:true}).order("created_at",{ascending:false}).limit(200),
      ]);
      if (settings.error || ads.error) return send(res,500,{error:"Platform settings unavailable. Apply migration 008."});
      return send(res,200,{settings:{...DEFAULTS,...(settings.data?.setting_value||{})},ads:ads.data||[],placements:PLACEMENTS});
    }
    const body = req.body || {};
    if (body.action === "save_settings" && req.method === "POST") {
      const settings = body.settings || {};
      const value = {
        siteName: String(settings.siteName || "MOROTTO").trim().slice(0,80),
        maintenanceMode: settings.maintenanceMode === true,
        supportEmail: String(settings.supportEmail || "").trim().slice(0,254),
        defaultCity: String(settings.defaultCity || "Casablanca").trim().slice(0,80),
        allowSignups: settings.allowSignups !== false,
        inventoryPageSize: Math.min(100, Math.max(12, Math.trunc(Number(settings.inventoryPageSize)||24))),
        adsenseClientId: String(settings.adsenseClientId || "").trim().slice(0,160),
      };
      if (value.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.supportEmail)) return send(res,400,{error:"Support email is invalid."});
      const {error}=await db.from("platform_settings").upsert({setting_key:"platform",setting_value:value,updated_by:auth.user.id,updated_at:new Date().toISOString()},{onConflict:"setting_key"});
      if(error)return send(res,500,{error:"Could not save platform settings."});
      return send(res,200,{ok:true,settings:value});
    }
    if (body.action === "save_ad" && req.method === "POST") {
      const a=body.ad||{};
      if(!String(a.advertiser_name||"").trim()||!PLACEMENTS.includes(a.placement)||!["local","google","disabled"].includes(a.mode)) return send(res,400,{error:"Advertiser, valid placement and ad mode are required."});
      if(!safeUrl(a.image_url)||!safeUrl(a.click_url)) return send(res,400,{error:"Ad image and click URLs must use HTTP or HTTPS."});
      const row={
        advertiser_name:String(a.advertiser_name).trim().slice(0,160), placement:a.placement, mode:a.mode,
        title:String(a.title||"").trim().slice(0,160), body:String(a.body||"").trim().slice(0,500),
        image_url:a.image_url||null, click_url:a.click_url||null, city:String(a.city||"").trim().slice(0,100)||null,
        google_ad_slot:String(a.google_ad_slot||"").trim().slice(0,100)||null, active:a.active===true,
        priority:Math.min(10000,Math.max(0,Math.trunc(Number(a.priority)||100))),
        starts_at:a.starts_at||null, ends_at:a.ends_at||null, created_by:auth.user.id, updated_at:new Date().toISOString()
      };
      if(row.mode==="local"&&(!row.title||!row.click_url))return send(res,400,{error:"Local ads need a title and destination URL."});
      if(row.mode==="google"&&!row.google_ad_slot)return send(res,400,{error:"Google ads need an AdSense slot ID."});
      const query=a.id?db.from("ad_campaigns").update(row).eq("id",a.id):db.from("ad_campaigns").insert(row);
      const {error}=await query;
      if(error)return send(res,500,{error:"Could not save ad campaign."});
      return send(res,200,{ok:true});
    }
    if (body.action === "delete_ad" && req.method === "POST") {
      const {error}=await db.from("ad_campaigns").delete().eq("id",String(body.id||""));
      if(error)return send(res,500,{error:"Could not delete ad campaign."});
      return send(res,200,{ok:true});
    }
    return send(res,400,{error:"Unknown admin action."});
  } catch(error) {
    console.error("Platform admin API error:",error);
    return send(res,500,{error:"Platform admin service failed."});
  }
}
