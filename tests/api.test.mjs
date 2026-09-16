import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_URL || "http://127.0.0.1:8790";
function client() {
  let cookie = "";
  return async (path, method = "GET", data, headers = {}) => {
    const r = await fetch(base + "/api/" + path, {
      method,
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(method !== "GET"
          ? {
              "Content-Type": "application/json",
              Origin: base,
              "X-Requested-With": "aftercredits",
            }
          : {}),
        ...headers,
      },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
    if (r.headers.has("set-cookie"))
      cookie = r.headers.get("set-cookie").split(";")[0];
    return { status: r.status, body: await r.json(), headers: r.headers };
  };
}
test("catalogue supports combined filtering, safe search, sort and validation", async () => {
  const api = client(),
    all = await api("catalogue");
  assert.equal(all.status, 200);
  assert.equal(all.body.titles.length, 33);
  const f = await api("catalogue?kind=animation&minutes=100&sort=shortest");
  assert.ok(f.body.titles.length);
  assert.ok(
    f.body.titles.every((t) => t.kind === "animation" && t.runtime <= 100),
  );
  assert.deepEqual(
    f.body.titles.map((t) => t.runtime),
    f.body.titles.map((t) => t.runtime).sort((a, b) => a - b),
  );
  assert.equal((await api("catalogue?q=Villeneuve")).body.titles.length, 2);
  assert.equal(
    (await api("catalogue?q=%27%20OR%201%3D1%20--")).body.titles.length,
    0,
  );
  assert.equal((await api("catalogue?sort=invalid")).status, 400);
  assert.equal((await api("catalogue?minutes=-1")).status, 400);
});
test("collections are private, concurrent updates conflict safely, export and deletion work", async () => {
  const a = client(),
    b = client();
  assert.equal((await a("state")).status, 401);
  const initial = await a("session", "POST", {});
  assert.equal(initial.status, 200);
  assert.match(initial.headers.get("set-cookie"), /HttpOnly; SameSite=Strict/);
  await b("session", "POST", {});
  try {
    const save = await a("entry", "PUT", {
      titleId: "arrival",
      status: "saved",
      revision: 0,
    });
    assert.equal(save.status, 200);
    assert.equal(save.body.revision, 1);
    assert.equal((await b("state")).body.entries.length, 0);
    assert.equal(
      (
        await a("entry", "PUT", {
          titleId: "totoro",
          status: "saved",
          revision: 0,
        })
      ).status,
      409,
    );
    assert.equal((await a("state")).body.entries.length, 1);
    const concurrent = await Promise.all(
      ["totoro", "dune"].map((titleId) =>
        a("entry", "PUT", { titleId, status: "saved", revision: 1 }),
      ),
    );
    assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
    const current = (await a("state")).body;
    assert.equal(current.entries.length, 2);
    assert.equal(current.revision, 2);
    assert.equal(
      (
        await a("entry", "PUT", {
          titleId: "arrival",
          status: "watched",
          rating: 9,
          revision: 2,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await a("entry", "PUT", {
          titleId: "unknown",
          status: "saved",
          revision: 2,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await a("entry", "PUT", {
          titleId: "arrival",
          status: "watched",
          rating: 5,
          revision: 2,
        })
      ).status,
      200,
    );
    const r = await a("recommend", "POST", {
      from: "drained",
      to: "curious",
      minutes: 180,
      kind: "any",
    });
    assert.equal(r.status, 200);
    assert.ok(r.body.results.every((t) => t.id !== "arrival"));
    const exported = await a("export");
    assert.equal(exported.body.entries.length, 2);
    assert.match(exported.headers.get("content-disposition"), /attachment/);
    assert.equal(
      (
        await a(
          "entry",
          "PUT",
          { titleId: "arrival", status: "remove", revision: 3 },
          { Origin: "https://unrelated.example" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await a("preferences", "PUT", {
          region: "ae",
          arc: { from: "open", to: "moved", minutes: 120, kind: "any" },
          revision: 3,
        })
      ).status,
      200,
    );
  } finally {
    assert.equal((await a("reset", "POST", {})).status, 200);
    await b("reset", "POST", {});
  }
  assert.equal((await a("state")).status, 401);
  const fresh = await a("session", "POST", {});
  assert.equal(fresh.body.entries.length, 0);
  await a("reset", "POST", {});
});
test("invalid, oversized and cross-origin requests fail without changing data", async () => {
  const a = client();
  await a("session", "POST", {});
  try {
    assert.equal(
      (
        await a("recommend", "POST", {
          from: "open",
          to: "unknown",
          minutes: 120,
          kind: "any",
        })
      ).status,
      400,
    );
    assert.equal(
      (await a("entry", "PUT", { padding: "x".repeat(9000) })).status,
      413,
    );
    assert.equal(
      (await a("recommend", "POST", {}, { "X-Requested-With": "wrong" }))
        .status,
      403,
    );
    assert.equal((await a("state")).body.entries.length, 0);
  } finally {
    await a("reset", "POST", {});
  }
});
