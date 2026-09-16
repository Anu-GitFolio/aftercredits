import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recommend, validateArc } from "../server/recommend.js";
const titles = JSON.parse(
  await readFile(new URL("../data/catalogue.json", import.meta.url)),
);
const arc = { from: "drained", to: "transported", minutes: 120, kind: "any" };
test("rejects unsupported moods, durations and formats", () => {
  for (const patch of [
    { from: "sad" },
    { to: "happy" },
    { minutes: 121 },
    { minutes: "120" },
    { kind: "podcast" },
  ])
    assert.throws(() => validateArc({ ...arc, ...patch }));
});
test("changing starting energy changes first choice for the same destination", () => {
  const low = recommend(titles, [], arc),
    high = recommend(titles, [], { ...arc, from: "restless" });
  assert.equal(low.results[0].energy, "low");
  assert.equal(high.results[0].energy, "high");
  assert.notEqual(low.results[0].id, high.results[0].id);
});
test("watched and excluded titles stay out of all recommendations and pairs", () => {
  const entries = [
    { titleId: "totoro", status: "watched", rating: 5 },
    { titleId: "portrait-lady", status: "hidden", rating: 0 },
  ];
  const r = recommend(titles, entries, { ...arc, minutes: 300 });
  for (const t of [...r.results, ...(r.pair?.titles || [])])
    assert.ok(!entries.some((e) => e.titleId === t.id));
});
test("all combinations respect format, time and exact destination labels", () => {
  for (const kind of ["any", "movie", "series", "animation"])
    for (const minutes of [30, 60, 90, 120, 180, 300])
      for (const to of [
        "comforted",
        "curious",
        "exhilarated",
        "moved",
        "transported",
      ]) {
        const r = recommend(titles, [], { ...arc, kind, minutes, to });
        assert.ok(r.results.length <= 3);
        for (const t of r.results) {
          assert.ok(t.runtime <= minutes);
          assert.ok(kind === "any" || kind === t.kind);
          if (r.exact) assert.ok(t.moods.includes(to));
        }
        if (r.pair) {
          assert.equal(
            r.pair.minutes,
            r.pair.titles.reduce((s, t) => s + t.runtime, 0),
          );
          assert.ok(r.pair.minutes <= minutes);
          assert.equal(new Set(r.pair.titles.map((t) => t.id)).size, 2);
          for (const t of r.pair.titles) {
            assert.equal(t.format, "film");
            assert.ok(t.moods.includes(to));
          }
        }
      }
});
test("high ratings influence unseen titles in that genre", () => {
  const input = { from: "open", to: "comforted", minutes: 180, kind: "any" };
  const r = recommend(
    titles,
    [{ titleId: "kiki", status: "watched", rating: 5 }],
    input,
  );
  assert.equal(r.results[0].genre, "Fantasy");
  assert.ok(r.results[0].reasons.some((s) => s.includes("rated highly")));
});
test("an exhausted catalogue returns an honest empty result", () => {
  const r = recommend(
    titles,
    titles.map((t) => ({ titleId: t.id, status: "watched", rating: 0 })),
    arc,
  );
  assert.deepEqual(r.results, []);
  assert.equal(r.pair, null);
  assert.equal(r.eligible, 0);
});
test("short sessions consider episodes and cannot offer a whole-film double bill", () => {
  const r = recommend(titles, [], { ...arc, minutes: 30 });
  assert.ok(r.results.length);
  assert.ok(r.results.every((t) => t.format === "series"));
  assert.equal(r.pair, null);
});
