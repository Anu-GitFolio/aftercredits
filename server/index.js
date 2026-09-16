import { recommend, validateArc } from "./recommend.js";
class ApiError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
const stmt = (db, q, ...args) => db.prepare(q).bind(...args);
const hash = async (s) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
const entries = async (db, id) =>
  (
    await stmt(
      db,
      "SELECT title_id AS titleId,status,rating,updated FROM entries WHERE session_id=? ORDER BY updated DESC",
      id,
    ).all()
  ).results;
const state = async (db, row) => ({
  revision: row.revision,
  region: row.region,
  arc: JSON.parse(row.arc),
  expires: row.expires,
  entries: await entries(db, row.id),
});
async function body(req) {
  if (!req.headers.get("content-type")?.includes("application/json"))
    throw new ApiError("invalid_request", 415);
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError("invalid_request");
  let size = 0,
    parts = [];
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > 8192) {
      await reader.cancel();
      throw new ApiError("too_large", 413);
    }
    parts.push(r.value);
  }
  const b = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    b.set(p, o);
    o += p.length;
  }
  try {
    const v = JSON.parse(new TextDecoder().decode(b));
    if (!v || typeof v !== "object" || Array.isArray(v)) throw 0;
    return v;
  } catch {
    throw new ApiError("invalid_request");
  }
}
async function route(req, env) {
  const url = new URL(req.url),
    p = url.pathname,
    db = env.DB,
    now = Date.now();
  if (p === "/api/catalogue" && req.method === "GET") {
    const params = url.searchParams,
      q = (params.get("q") || "").trim();
    if (q.length > 100) throw new ApiError("invalid_filter");
    let clauses = [],
      values = [];
    for (const k of ["kind", "genre", "energy"]) {
      const v = params.get(k);
      if (v && v !== "all") {
        if (v.length > 40) throw new ApiError("invalid_filter");
        clauses.push(`${k}=?`);
        values.push(v);
      }
    }
    const language = params.get("language");
    if (language && language !== "all") {
      if (language.length > 40) throw new ApiError("invalid_filter");
      clauses.push(
        "EXISTS (SELECT 1 FROM json_each(titles.data,'$.languages') WHERE value=?)",
      );
      values.push(language);
    }
    for (const [key, col, op, min, max] of [
      ["year", "year", ">=", 1900, 2030],
      ["minutes", "runtime", "<=", 1, 600],
    ]) {
      const v = params.get(key);
      if (v && v !== "all") {
        const n = Number(v);
        if (!Number.isInteger(n) || n < min || n > max)
          throw new ApiError("invalid_filter");
        clauses.push(`${col}${op}?`);
        values.push(n);
      }
    }
    if (q) {
      clauses.push(
        "(title LIKE ? ESCAPE '\\' OR json_extract(data,'$.creator') LIKE ? ESCAPE '\\')",
      );
      const v = "%" + q.replace(/[\\%_]/g, "\\$&") + "%";
      values.push(v, v);
    }
    const sort = {
      curated: "rowid ASC",
      newest: "year DESC,title ASC",
      oldest: "year ASC,title ASC",
      shortest: "runtime ASC,title ASC",
      az: "title ASC",
    }[params.get("sort") || "curated"];
    if (!sort) throw new ApiError("invalid_filter");
    const rows = await stmt(
      db,
      `SELECT data FROM titles ${clauses.length ? "WHERE " + clauses.join(" AND ") : ""} ORDER BY ${sort} LIMIT 100`,
      ...values,
    ).all();
    const count = await db.prepare("SELECT count(*) AS n FROM titles").first();
    return json(
      {
        titles: rows.results.map((r) => JSON.parse(r.data)),
        total: count.n,
        verified: "2026-09-16",
      },
      200,
      { "Cache-Control": "public,max-age=120" },
    );
  }
  if (
    req.method !== "GET" &&
    (req.headers.get("Origin") !== url.origin ||
      req.headers.get("X-Requested-With") !== "aftercredits")
  )
    throw new ApiError("forbidden", 403);
  const token = req.headers
    .get("Cookie")
    ?.match(/(?:^|;\s*)aftercredits_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  let sid = token ? await hash(token) : "",
    row = sid
      ? await stmt(
          db,
          "SELECT * FROM sessions WHERE id=? AND expires>?",
          sid,
          now,
        ).first()
      : null,
    cookie;
  if (!row) {
    if (p !== "/api/session" || req.method !== "POST")
      throw new ApiError("session_expired", 401);
    await body(req);
    const fresh = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    sid = await hash(fresh);
    await db.batch([
      stmt(
        db,
        "DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE expires<? LIMIT 100)",
        now,
      ),
      stmt(
        db,
        "INSERT INTO sessions(id,expires) VALUES(?,?)",
        sid,
        now + 90 * 86400000,
      ),
    ]);
    row = await stmt(db, "SELECT * FROM sessions WHERE id=?", sid).first();
    cookie = `aftercredits_session=${fresh}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7776000${url.protocol === "https:" ? "; Secure" : ""}`;
  }
  const respond = async () =>
    json(await state(db, row), 200, cookie ? { "Set-Cookie": cookie } : {});
  if (
    (p === "/api/session" && req.method === "POST") ||
    (p === "/api/state" && req.method === "GET")
  )
    return respond();
  if (p === "/api/export" && req.method === "GET")
    return json(
      { exported: new Date().toISOString(), ...(await state(db, row)) },
      200,
      {
        "Content-Disposition":
          'attachment; filename="aftercredits-collection.json"',
      },
    );
  if (req.method === "GET") throw new ApiError("not_found", 404);
  const rate = await stmt(
    db,
    "UPDATE sessions SET requests=CASE WHEN window<? THEN 1 ELSE requests+1 END,window=CASE WHEN window<? THEN ? ELSE window END WHERE id=? AND (window<? OR requests<90) RETURNING id",
    now - 60000,
    now - 60000,
    now,
    sid,
    now - 60000,
  ).first();
  if (!rate) throw new ApiError("rate_limited", 429);
  const data = await body(req);
  if (p === "/api/recommend" && req.method === "POST") {
    let arc;
    try {
      arc = validateArc(data);
    } catch {
      throw new ApiError("invalid_arc");
    }
    const all = (await db.prepare("SELECT data FROM titles").all()).results.map(
      (r) => JSON.parse(r.data),
    );
    return json(recommend(all, await entries(db, sid), arc));
  }
  if (p === "/api/reset" && req.method === "POST") {
    await stmt(db, "DELETE FROM sessions WHERE id=?", sid).run();
    return json({ deleted: true }, 200, {
      "Set-Cookie":
        "aftercredits_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    });
  }
  if (!Number.isInteger(data.revision) || data.revision !== row.revision)
    throw new ApiError("conflict", 409);
  if (p === "/api/entry" && req.method === "PUT") {
    if (
      typeof data.titleId !== "string" ||
      !["saved", "watched", "hidden", "remove"].includes(data.status) ||
      !Number.isInteger(data.rating ?? 0) ||
      (data.rating ?? 0) < 0 ||
      (data.rating ?? 0) > 5
    )
      throw new ApiError("invalid_request");
    if (
      !(await stmt(
        db,
        "SELECT id FROM titles WHERE id=?",
        data.titleId,
      ).first())
    )
      throw new ApiError("not_found", 404);
    const change =
      data.status === "remove"
        ? stmt(
            db,
            "DELETE FROM entries WHERE session_id=? AND title_id=? AND EXISTS(SELECT 1 FROM sessions WHERE id=? AND revision=?)",
            sid,
            data.titleId,
            sid,
            data.revision,
          )
        : stmt(
            db,
            "INSERT INTO entries(session_id,title_id,status,rating,updated) SELECT id,?,?,?,? FROM sessions WHERE id=? AND revision=? ON CONFLICT(session_id,title_id) DO UPDATE SET status=excluded.status,rating=excluded.rating,updated=excluded.updated",
            data.titleId,
            data.status,
            data.status === "watched" ? (data.rating ?? 0) : 0,
            now,
            sid,
            data.revision,
          );
    const result = await db.batch([
      change,
      stmt(
        db,
        "UPDATE sessions SET revision=revision+1 WHERE id=? AND revision=? RETURNING *",
        sid,
        data.revision,
      ),
    ]);
    if (!result[1].results.length) throw new ApiError("conflict", 409);
    row = result[1].results[0];
    return respond();
  }
  if (p === "/api/preferences" && req.method === "PUT") {
    if (!["ae", "in", "us", "gb"].includes(data.region))
      throw new ApiError("invalid_request");
    let arc;
    try {
      arc = validateArc(data.arc);
    } catch {
      throw new ApiError("invalid_arc");
    }
    row = await stmt(
      db,
      "UPDATE sessions SET region=?,arc=?,revision=revision+1 WHERE id=? AND revision=? RETURNING *",
      data.region,
      JSON.stringify(arc),
      sid,
      data.revision,
    ).first();
    if (!row) throw new ApiError("conflict", 409);
    return respond();
  }
  throw new ApiError("not_found", 404);
}
export default {
  async fetch(req, env) {
    let res;
    try {
      const url = new URL(req.url);
      if (url.pathname.startsWith("/api/")) res = await route(req, env);
      else {
        if (
          !/\.[a-z0-9]+$/i.test(url.pathname) &&
          !url.pathname.startsWith("/__qa/")
        )
          url.pathname = "/";
        res = await env.ASSETS.fetch(new Request(url, req));
      }
    } catch (e) {
      if (!e.status) console.error("Request failed:", e.message);
      res = json(
        { error: e.status ? e.message : "service_unavailable" },
        e.status || 503,
      );
    }
    const r = new Response(res.body, res);
    r.headers.set("X-Content-Type-Options", "nosniff");
    r.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    r.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    r.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'",
    );
    return r;
  },
};
