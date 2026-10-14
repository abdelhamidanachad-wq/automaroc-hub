import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://automaroc-hub.vercel.app",
  "http://localhost:5173",
]);
const demoUsers = [
  { email: "demo.individual@morotto.ma", display_name: "Yassine El Amrani", account_type: "individual", city: "Casablanca" },
  { email: "demo.seller@morotto.ma", display_name: "Salma Auto Occasion", account_type: "dealer", city: "Casablanca" },
  { email: "demo.location@morotto.ma", display_name: "Atlas Location Auto", account_type: "rental_agency", city: "Rabat" },
  { email: "demo.garage@morotto.ma", display_name: "Garage Atlas Services", account_type: "garage", city: "Casablanca" },
  { email: "demo.mechanic@morotto.ma", display_name: "Mehdi Mécanique", account_type: "mechanic", city: "Marrakech" },
  { email: "demo.parts@morotto.ma", display_name: "Pièces Auto Medina", account_type: "parts_seller", city: "Tangier" },
  { email: "demo.partner@morotto.ma", display_name: "MOROTTO Partenaire Démo", account_type: "partner", city: "Casablanca" },
] as const;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://automaroc-hub.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Server configuration missing" }, 500);
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const token = authorization.slice(7);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const { data: roleRows, error: roleError } = await admin.from("user_roles")
      .select("role").eq("user_id", authData.user.id);
    if (roleError || !roleRows?.some((row: { role: string }) => row.role === "superadmin")) {
      return json({ error: "Superadmin access required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 12 || password.length > 128) {
      return json({ error: "Choose a temporary password between 12 and 128 characters." }, 400);
    }

    const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;
    const output: Array<{ email: string; account_type: string; status: string }> = [];
    for (const demo of demoUsers) {
      const existing = usersData.users.find((user) => user.email?.toLowerCase() === demo.email);
      let userId: string;
      if (existing) {
        userId = existing.id;
        const { error } = await admin.auth.admin.updateUserById(userId, {
          password, email_confirm: true,
          user_metadata: { display_name: demo.display_name, account_type: demo.account_type, is_demo: true },
        });
        if (error) throw error;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email: demo.email, password, email_confirm: true,
          user_metadata: { display_name: demo.display_name, account_type: demo.account_type, is_demo: true },
        });
        if (error) throw error;
        userId = data.user.id;
      }

      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId, display_name: demo.display_name, account_type: demo.account_type, city: demo.city,
      }, { onConflict: "id" });
      if (profileError) throw profileError;

      const { error: catalogError } = await admin.from("demo_test_accounts").update({
        auth_user_id: userId, provisioned_at: new Date().toISOString(),
      }).eq("email", demo.email);
      if (catalogError) throw catalogError;
      output.push({ email: demo.email, account_type: demo.account_type, status: existing ? "reset" : "created" });
    }

    return json({
      ok: true,
      message: "Demo accounts are provisioned. The temporary password is not stored or returned.",
      accounts: output,
    });
  } catch (error) {
    console.error("Demo provisioning error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Provisioning failed. Check the Edge Function logs for details." }, 500);
  }
});
