const { createClient } = require("@supabase/supabase-js");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function requireAdmin(req, res) {
  const adminKey = process.env.ADMIN_KEY || "";
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!adminKey || token !== adminKey) {
    json(res, 401, { error: "unauthorized" });
    return false;
  }
  return true;
}

module.exports = async (req, res) => {
  try {
    const supabase = getSupabase();

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("mods")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) return json(res, 500, { error: "db_error", details: error.message });
      return json(res, 200, { items: data || [] });
    }

    if (req.method === "POST") {
      if (!requireAdmin(req, res)) return;

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");

          const mod = {
            name: String(payload.name || "").trim(),
            description: String(payload.description || "").trim(),
            minecraft_version: String(payload.minecraft_version || "").trim(),
            fabric_required: !!payload.fabric_required,
            launchers: Array.isArray(payload.launchers) ? payload.launchers.map(String) : [],
            file_name: String(payload.file_name || "").trim(),
            file_url: String(payload.file_url || "").trim()
          };

          if (!mod.name || !mod.minecraft_version || !mod.file_name || !mod.file_url) {
            return json(res, 400, { error: "missing_fields" });
          }

          const { data, error } = await supabase.from("mods").insert(mod).select("*").single();
          if (error) return json(res, 500, { error: "db_error", details: error.message });

          return json(res, 200, { item: data });
        } catch (e) {
          return json(res, 400, { error: "bad_json" });
        }
      });
      return;
    }

    return json(res, 405, { error: "method_not_allowed" });
  } catch (e) {
    return json(res, 500, { error: "server_error", details: String(e.message || e) });
  }
};
