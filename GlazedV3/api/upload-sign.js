const { createClient } = require("@supabase/supabase-js");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
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
    if (req.method !== "POST") return json(res, 405, { error: "method_not_allowed" });
    if (!requireAdmin(req, res)) return;

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) return json(res, 500, { error: "missing_supabase_env" });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      let payload;
      try { payload = JSON.parse(body || "{}"); }
      catch { return json(res, 400, { error: "bad_json" }); }

      const original = String(payload.file_name || "").trim();
      if (!original) return json(res, 400, { error: "missing_file_name" });

      // Safe-ish path
      const stamp = Date.now();
      const safe = original.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${stamp}_${safe}`;

      const { data, error } = await supabase.storage.from("mods").createSignedUploadUrl(path);
      if (error) return json(res, 500, { error: "sign_error", details: error.message });

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/mods/${encodeURIComponent(path)}`;

      return json(res, 200, {
        path,
        signed_url: data.signedUrl,
        token: data.token,
        public_url: publicUrl
      });
    });
  } catch (e) {
    return json(res, 500, { error: "server_error", details: String(e.message || e) });
  }
};
