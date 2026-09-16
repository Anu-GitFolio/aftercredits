export const moods = [
  "comforted",
  "curious",
  "exhilarated",
  "moved",
  "transported",
];
export const starts = ["drained", "restless", "reflective", "open"];
export function validateArc(a) {
  if (
    !a ||
    !starts.includes(a.from) ||
    !moods.includes(a.to) ||
    ![30, 60, 90, 120, 180, 300].includes(a.minutes) ||
    !["any", "movie", "series", "animation"].includes(a.kind)
  )
    throw new Error("invalid_arc");
  return { from: a.from, to: a.to, minutes: a.minutes, kind: a.kind };
}
export function recommend(titles, entries, input) {
  const arc = validateArc(input),
    byId = new Map(entries.map((e) => [e.titleId, e]));
  const affinity = new Set(
    titles
      .filter((t) => {
        const e = byId.get(t.id);
        return e?.status === "watched" && e.rating >= 4;
      })
      .map((t) => t.genre),
  );
  const candidates = titles.filter(
    (t) =>
      !["hidden", "watched"].includes(byId.get(t.id)?.status) &&
      t.runtime <= arc.minutes &&
      (arc.kind === "any" || t.kind === arc.kind),
  );
  const ranked = candidates
    .map((t) => {
      const exact = t.moods.includes(arc.to);
      const energyFit =
        arc.from === "drained"
          ? t.energy === "low"
          : arc.from === "restless"
            ? t.energy === "high"
            : arc.from === "reflective"
              ? t.energy !== "high"
              : true;
      const familiar = affinity.has(t.genre);
      const energyReason = energyFit
        ? arc.from === "drained"
          ? "A gentler pace for a low-energy evening."
          : arc.from === "restless"
            ? "Enough momentum for a restless evening."
            : arc.from === "reflective"
              ? "Room to sit with the story."
              : "A good fit for an open-minded evening."
        : arc.from === "restless"
          ? "A quieter detour than your starting mood, with the destination you chose."
          : "This choice asks for a little more attention.";
      return {
        ...t,
        score:
          (exact ? 100 : 0) +
          (energyFit ? 20 : 0) +
          (familiar ? 8 : 0) +
          (byId.get(t.id)?.status === "saved" ? 3 : 0),
        exact,
        reasons: [
          t.note,
          energyReason,
          ...(familiar
            ? ["Shares a genre with a title you rated highly."]
            : []),
        ],
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const exact = ranked.filter((t) => t.exact),
    results = (exact.length ? exact : ranked).slice(0, 3);
  const films = ranked.filter((t) => t.format === "film");
  let pair = null;
  for (const first of films.filter((t) => t.exact)) {
    const second = films.find(
      (t) =>
        t.id !== first.id &&
        first.runtime + t.runtime <= arc.minutes &&
        t.exact,
    );
    if (second) {
      pair = {
        titles: [first, second],
        minutes: first.runtime + second.runtime,
        reason: `Begin with ${first.title}: ${first.note} Follow it with ${second.title}: ${second.note} Two complete films, both in the mood you chose.`,
      };
      break;
    }
  }
  return {
    arc,
    results,
    exact: exact.length > 0,
    pair,
    eligible: candidates.length,
  };
}
