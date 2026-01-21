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
    const url = new URL(req.url, `https://${req.headers.host}`);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) return json(res, 400, { error: "missing_id" });

    if (req.method === "PATCH") {
      if (!requireAdmin(req, res)) return;

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const payload = JSON.parse(body || "{}");
          const patch = {};

          if ("name" in payload) patch.name = String(payload.name || "").trim();
          if ("description" in payload) patch.description = String(payload.description || "").trim();
          if ("minecraft_version" in payload) patch.minecraft_version = String(payload.minecraft_version || "").trim();
          if ("fabric_required" in payload) patch.fabric_required = !!payload.fabric_required;
          if ("launchers" in payload) patch.launchers = Array.isArray(payload.launchers) ? payload.launchers.map(String) : [];
          if ("file_name" in payload) patch.file_name = String(payload.file_name || "").trim();
          if ("file_url" in payload) patch.file_url = String(payload.file_url || "").trim();

          const { data, error } = await supabase.from("mods").update(patch).eq("id", id).select("*").single();
          if (error) return json(res, 500, { error: "db_error", details: error.message });

          return json(res, 200, { item: data });
        } catch {
          return json(res, 400, { error: "bad_json" });
        }
      });
      return;
    }

    if (req.method === "DELETE") {
      if (!requireAdmin(req, res)) return;

      const { error } = await supabase.from("mods").delete().eq("id", id);
      if (error) return json(res, 500, { error: "db_error", details: error.message });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "method_not_allowed" });
  } catch (e) {
    return json(res, 500, { error: "server_error", details: String(e.message || e) });
  }
};
