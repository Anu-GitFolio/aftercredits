const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${{ arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>', search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="m5 12 4 4L19 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>', moon: '<path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/>', bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>', shuffle: '<path d="m17 3 4 4-4 4m0 2 4 4-4 4M3 7h3l12 10h3M3 17h3L18 7h3"/>', play: '<path d="m8 4 13 8-13 8V4Z"/>', menu: '<path d="M4 8h16M4 16h16"/>', compare: '<rect x="3" y="5" width="7" height="14" rx="1"/><rect x="14" y="5" width="7" height="14" rx="1"/>' }[name] || ""}</svg>`;
let theme = "dark";
try {
  theme = localStorage.getItem("aftercredits-theme") || "dark";
} catch {}
document.documentElement.dataset.theme = theme;
let catalogue = [],
  listed = [],
  session = { revision: 0, region: "ae", arc: {}, entries: [] },
  online = false,
  busy = false,
  compare = [],
  collectionTab = "saved",
  arcResult = null,
  dialogOpener = null,
  searchTimer,
  requestId = 0;
let arc = { from: "drained", to: "transported", minutes: 120, kind: "any" };
const moodNames = {
  comforted: "Comforted",
  curious: "Curious",
  exhilarated: "Energised",
  moved: "Moved",
  transported: "Somewhere else",
};
const moodCopy = {
  comforted: "A little warmth.",
  curious: "Something to untangle.",
  exhilarated: "A change of pace.",
  moved: "Something that stays.",
  transported: "A world to fall into.",
};
const fromNames = {
  drained: "A little drained",
  restless: "Restless",
  reflective: "In my feelings",
  open: "Open to anything",
};
const type = (t) =>
  t.kind === "animation"
    ? t.format === "series"
      ? "Animated series"
      : "Animated film"
    : t.kind === "movie"
      ? "Film"
      : "Series";
const length = (t) =>
  t.format === "series" ? `${t.runtime} min / episode` : `${t.runtime} min`;
const entry = (id) => session.entries.find((e) => e.titleId === id);
const title = (id) => catalogue.find((t) => t.id === id);
const listLink = (id) => `/title/${id}`;
const link = (href, text, cls = "") =>
  `<a href="${href}" data-link class="${cls}">${text}</a>`;
const empty = (
  heading,
  body,
  cta = "Explore the programme",
  href = "/explore",
) =>
  `<div class="empty"><span class="asterisk">✳</span><h2>${heading}</h2><p>${body}</p>${link(href, cta + icon("arrow"), "button")}</div>`;
const errorText = (e) =>
  ({
    conflict:
      "Your collection changed in another tab. We refreshed it—please try again.",
    session_expired:
      "Your session has expired. Reload to start a new collection.",
    rate_limited: "A little too quick. Please wait a minute and try again.",
    invalid_arc: "Choose a mood, format and time to continue.",
    too_large: "That request is too large.",
  })[e] ||
  "We couldn’t save that just now. Your previous choices are safe. Please try again.";
async function api(path, method = "GET", data) {
  const r = await fetch("/api/" + path, {
    method,
    headers:
      method === "GET"
        ? {}
        : {
            "Content-Type": "application/json",
            "X-Requested-With": "aftercredits",
          },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "service_unavailable");
  return d;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 3800);
}
function focusKey() {
  const e = document.activeElement;
  return e?.id
    ? { id: e.id }
    : e?.dataset.action
      ? { action: e.dataset.action, idValue: e.dataset.id }
      : null;
}
function restoreFocus(k) {
  if (!k) return;
  const el = k.id
    ? document.getElementById(k.id)
    : $$("[data-action]").find(
        (e) => e.dataset.action === k.action && e.dataset.id === k.idValue,
      );
  el?.focus({ preventScroll: true });
}
function closeDialog() {
  const d = $("#dialog");
  if (d.open) d.close();
  document.body.classList.remove("locked");
  restoreFocus(dialogOpener);
}
function openDialog(html) {
  const d = $("#dialog");
  if (!d.open) dialogOpener = focusKey();
  d.innerHTML = `<button class="icon-button dialog-close" data-action="close" aria-label="Close dialog">${icon("close")}</button>${html}`;
  d.setAttribute("aria-labelledby", "dialog-title");
  d.showModal();
  d.querySelector(".dialog-close").focus();
  document.body.classList.add("locked");
}
function shell() {
  const path = location.pathname;
  $("#header").innerHTML =
    `<div class="wrap nav">${link("/", "aftercredits<span>✳</span>", "wordmark")}<nav aria-label="Main navigation">${link("/explore", "Discover", path === "/explore" ? "current" : "")}${link("/mood-arc", 'Mood Arc <span class="mini-tag">OUR THING</span>', path === "/mood-arc" ? "current" : "")}${link("/collection", "My collection" + ` <span class="nav-count">${session.entries.filter((e) => e.status === "saved").length}</span>`, path === "/collection" ? "current" : "")}</nav><div class="nav-tools"><button class="icon-button" data-action="search" aria-label="Search titles">${icon("search")}</button><button class="icon-button" data-action="theme" aria-label="Switch to ${theme === "dark" ? "light" : "dark"} mode">${icon(theme === "dark" ? "sun" : "moon")}</button><button class="icon-button mobile-menu" data-action="menu" aria-label="Open menu">${icon("menu")}</button></div></div>`;
  $("#footer").innerHTML =
    `<div class="wrap footer-top"><div>${link("/", "aftercredits<span>✳</span>", "wordmark")}<p>For the love of a good ending.<br>And everything that comes before.</p></div><div class="footer-links">${link("/explore", "The programme")}${link("/mood-arc", "Find your Mood Arc")}${link("/about", "About & sources")}${link("/privacy", "Privacy & your data")}</div><div class="footer-signoff">LESS SCROLLING.<br>MORE CINEMA.<span>AN INDEPENDENT DISCOVERY PROJECT</span></div></div><div class="wrap footer-bottom"><span>Curated, not exhaustive. ${catalogue.length} titles, a few good places to start.</span><span>Metadata: Wikipedia & TVmaze · 16 Sep 2026</span></div>`;
  $("#compare-tray").innerHTML = compare.length
    ? `<div class="compare-tray"><span>${compare.length} / 3 on the shortlist</span><button class="button small" data-action="compare-open">Compare ${icon("compare")}</button><button class="icon-button" data-action="compare-clear" aria-label="Clear comparison">${icon("close")}</button></div>`
    : "";
}
function poster(t, cls = "", eager = false) {
  return `<div class="poster ${cls}"><span class="poster-fallback" aria-hidden="true">${esc(t.title)}</span><img src="${t.poster}" alt="${esc(t.title)} poster" width="480" height="720" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`;
}
function collectionControl(t, presentation = "compact") {
  const status = entry(t.id)?.status;
  const saved = status === "saved",
    watched = status === "watched";
  const label = watched
    ? "Edit your rating for " + t.title
    : saved
      ? "Remove " + t.title + " from watchlist"
      : "Save " + t.title;
  const text = watched
    ? "Watched · edit rating"
    : saved
      ? "On your watchlist"
      : "Add to watchlist";
  return `<button class="collection-control ${presentation === "compact" ? "save-button" : presentation} ${saved ? "saved" : ""}" data-presentation="${presentation}" data-action="${watched ? "rate" : "save"}" data-id="${t.id}" aria-label="${esc(label)}" ${watched ? "" : `aria-pressed="${saved}"`}>${presentation === "compact" ? "" : text}${icon(saved || watched ? "check" : "plus")}</button>`;
}
function card(t, index = 0) {
  const e = entry(t.id);
  return `<article class="film-card"><div class="card-art">${link(listLink(t.id), poster(t), "poster-link")}${collectionControl(t)}<span class="type-badge">${type(t)}</span></div><div class="card-meta"><span>${t.year} <span class="dot">·</span> ${length(t)}</span><button class="compare-button ${compare.includes(t.id) ? "active" : ""}" data-action="compare" data-id="${t.id}" aria-pressed="${compare.includes(t.id)}" aria-label="Compare ${esc(t.title)}">${icon("compare")}</button></div><h3>${link(listLink(t.id), esc(t.title))}</h3><p class="card-note">${esc(t.note)}</p></article>`;
}
function home() {
  const picks = [
    "arrival",
    "grand-budapest",
    "spirited-away",
    "severance",
    "past-lives",
  ]
    .map(title)
    .filter(Boolean);
  return `<div class="wrap"><section class="hero"><div class="hero-copy"><span class="eyebrow"><i></i> YOUR EVENING, WELL SPENT</span><h1>LESS SCROLLING.<br>MORE <span class="outline-word">CINEMA.</span><span class="hero-star" aria-hidden="true">✳</span></h1><p>A film that gets you. A series to get lost in.<br>Find something that feels right for <em>tonight.</em></p><div class="hero-actions">${link("/mood-arc", "Find my next watch " + icon("arrow"), "button")}${link("/explore", "Or, take a look around", "text-link")}</div><div class="hero-foot"><span>FILMS / SERIES / ANIMATION</span><span>GOOD STORIES. NO ALGORITHM FOG.</span></div></div><div class="hero-art" aria-label="A selection from the programme"><div class="orbit-label">A LITTLE OUT OF THE ORDINARY ↗</div>${[
    "grand-budapest",
    "spirited-away",
    "arrival",
  ]
    .map((id, i) => {
      const t = title(id);
      return t
        ? link(
            listLink(id),
            poster(t, "", true) +
              `<span class="cover-caption">0${i + 1} — ${esc(t.title)}</span>`,
            `hero-cover cover-${i}`,
          )
        : "";
    })
    .join(
      "",
    )}<div class="ticket"><span>ADMIT ONE</span><strong>A GOOD<br>EVENING.</strong><span>NO WRONG ANSWERS ↗</span><div class="ticket-bars" aria-hidden="true"></div></div><div class="hero-art-bottom"><span>THE AFTERCREDITS EDIT</span><span>VOL. 01 / ALWAYS CURIOUS</span></div></div></section><section class="arc-strip"><div><span class="eyebrow">MEET MOOD ARC</span><h2>Don't pick a genre.<br>Pick a <em>feeling.</em></h2></div><div class="arc-preview"><span>A little drained</span><span class="arc-path" aria-hidden="true">⤳</span><span>Somewhere else</span></div>${link("/mood-arc", "Build your arc " + icon("arrow"), "text-link")}<p>Where you are → where you want the story to take you.</p></section><section class="section"><div class="section-heading"><div><span class="eyebrow">01 / A FEW GOOD STARTING POINTS</span><h2>WORTH YOUR EVENING.</h2></div>${link("/explore", "The whole programme " + icon("arrow"), "text-link")}</div><div class="film-grid home-grid">${picks.map(card).join("")}</div></section><section class="shelves section"><div class="section-heading"><div><span class="eyebrow">02 / FOLLOW A FEELING</span><h2>WHAT KIND OF NIGHT?</h2></div><span class="small muted">No pressure to know the title.</span></div><div class="shelf-grid">${[
    [
      "comforted",
      "01",
      "THE WORLD CAN WAIT.",
      "Gentle company. A softer landing.",
      "totoro",
    ],
    [
      "curious",
      "02",
      "ONE MORE QUESTION.",
      "For the curious. And the overthinkers.",
      "severance",
    ],
    [
      "transported",
      "03",
      "ANYWHERE BUT HERE.",
      "Different worlds. A change of scenery.",
      "howls-castle",
    ],
  ]
    .map(([m, n, h, p, id]) =>
      link(
        "/explore?mood=" + m,
        `<span class="shelf-number">${n}</span><h3>${h}</h3><p>${p}</p><span class="shelf-arrow">${icon("arrow")}</span>${title(id) ? poster(title(id)) : ""}`,
        "shelf",
      ),
    )
    .join(
      "",
    )}</div></section><section class="surprise-panel"><span class="asterisk">✳</span><div><span class="eyebrow">OVERTHINKING IT?</span><h2>LET SERENDIPITY<br>HAVE A SAY.</h2><p>One unseen pick from the programme. Nothing you've ruled out.</p></div><button class="button outline" data-action="surprise">Deal me a film ${icon("shuffle")}</button></section></div>`;
}
function filterSelect(label, name, options, value) {
  return `<label class="filter"><span>${label}</span><select name="${name}" aria-label="${label}">${options.map(([v, l]) => `<option value="${v}" ${String(v) === String(value) ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
}
function explore() {
  const p = new URLSearchParams(location.search),
    m = p.get("mood");
  return `<div class="wrap page"><div class="page-heading"><span class="eyebrow">THE PROGRAMME / ${catalogue.length} CONSIDERED PICKS</span><h1>${m ? esc(moodNames[m] || "Discover") + "." : "YOUR NEXT<br>GOOD STORY."}</h1><p>Follow a hunch. Narrow it down. Leave room for a surprise.</p></div><form id="filters" class="filters"><label class="search-input">${icon("search")}<input id="catalogue-search" name="q" type="search" placeholder="A title or a director…" aria-label="Search title or director" value="${esc(p.get("q") || "")}" maxlength="100"><kbd>/</kbd></label><div class="filter-grid">${filterSelect(
    "Format",
    "kind",
    [
      ["all", "Everything"],
      ["movie", "Films"],
      ["series", "Series"],
      ["animation", "Animation"],
    ],
    p.get("kind") || "all",
  )}${filterSelect("Genre", "genre", [["all", "Any genre"], ...[...new Set(catalogue.map((t) => t.genre))].sort().map((v) => [v, v])], p.get("genre") || "all")}${filterSelect(
    "Time per watch",
    "minutes",
    [
      ["all", "Any length"],
      [30, "Up to 30 min"],
      [60, "Up to 1 hour"],
      [90, "Up to 90 min"],
      [120, "Up to 2 hours"],
      [180, "Up to 3 hours"],
    ],
    p.get("minutes") || "all",
  )}${filterSelect(
    "Released",
    "year",
    [
      ["all", "Any year"],
      [2020, "2020 onward"],
      [2010, "2010 onward"],
      [2000, "2000 onward"],
    ],
    p.get("year") || "all",
  )}${filterSelect("Language", "language", [["all", "Any language"], ...[...new Set(catalogue.flatMap((t) => t.languages || [t.language]))].sort().map((v) => [v, v])], p.get("language") || "all")}${filterSelect(
    "Intensity",
    "energy",
    [
      ["all", "Any intensity"],
      ["low", "Gentle"],
      ["medium", "A little momentum"],
      ["high", "Full attention"],
    ],
    p.get("energy") || "all",
  )}</div><div class="filter-bottom"><p>Series time is per episode, not the full run. Intensity is our editorial view.</p><button type="button" class="text-link" data-action="filters-clear">Clear filters ${icon("close")}</button></div></form><div class="results-toolbar"><span id="results-count" role="status">Finding your stories…</span><label>Sort by <select id="sort" name="sort" aria-label="Sort titles"><option value="curated">Our edit</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="shortest">Shortest first</option><option value="az">A–Z</option></select></label></div><div id="catalogue-results" aria-busy="true"><div class="loading-row">Pulling up the programme…</div></div></div>`;
}
async function loadExplore() {
  const id = ++requestId,
    p = new URLSearchParams(location.search);
  $("#catalogue-results")?.setAttribute("aria-busy", "true");
  if ($("#results-count"))
    $("#results-count").textContent = "Finding your stories…";
  const sort = $("#sort");
  if (sort) sort.value = p.get("sort") || "curated";
  try {
    const data = await api("catalogue?" + p);
    if (id !== requestId || location.pathname !== "/explore") return;
    listed = data.titles.filter(
      (t) => !p.get("mood") || t.moods.includes(p.get("mood")),
    );
    $("#results-count").textContent =
      `${listed.length} ${listed.length === 1 ? "story" : "stories"} on the programme`;
    $("#catalogue-results").innerHTML = listed.length
      ? `<div class="film-grid">${listed.map(card).join("")}</div>`
      : empty(
          "NOT THIS COMBINATION.",
          "Try a little more time, a different format or fewer filters. The catalogue is a considered selection, not every title ever made.",
          "Reset the filters",
          "/explore",
        );
    $("#catalogue-results").setAttribute("aria-busy", "false");
    bindImages();
  } catch {
    $("#catalogue-results")?.replaceChildren();
    if ($("#catalogue-results")) {
      $("#catalogue-results").setAttribute("aria-busy", "false");
      $("#catalogue-results").innerHTML = empty(
        "AN INTERMISSION.",
        "The programme could not load. Try again in a moment.",
        "Try again",
        "/explore",
      );
    }
  }
}
function moodArc() {
  return `<div class="wrap page"><div class="arc-page-heading"><div><span class="eyebrow">OUR SIGNATURE / MOOD ARC</span><h1>WHERE DO YOU<br>WANT TO <span class="accent-text">END UP?</span></h1></div><p>Start with your mood.<br>Let a story take it somewhere.<br><span class="muted small">Editorial instinct. A clear reason for every pick.</span></p></div><form id="arc-form" class="arc-builder"><div class="arc-endpoints"><fieldset><legend><span>01</span> RIGHT NOW, I'M…</legend><div class="mood-options">${Object.entries(
    fromNames,
  )
    .map(
      ([v, l]) =>
        `<label class="mood-option"><input type="radio" name="from" value="${v}" ${arc.from === v ? "checked" : ""}><span>${l}</span></label>`,
    )
    .join(
      "",
    )}</div></fieldset><div class="arc-connector" aria-hidden="true"><span>THE STORY IN BETWEEN</span><svg viewBox="0 0 280 100"><path d="M0 70C80 70 75 20 140 20S200 70 265 70"/><path d="m248 54 18 16-18 15"/></svg></div><fieldset><legend><span>02</span> TAKE ME SOMEWHERE…</legend><div class="mood-options destination">${Object.entries(
    moodNames,
  )
    .map(
      ([v, l]) =>
        `<label class="mood-option"><input type="radio" name="to" value="${v}" ${arc.to === v ? "checked" : ""}><span>${l}<small>${moodCopy[v]}</small></span></label>`,
    )
    .join("")}</div></fieldset></div><div class="arc-controls">${filterSelect(
    "03 / I have",
    "minutes",
    [
      [30, "30 minutes"],
      [60, "An hour"],
      [90, "90 minutes"],
      [120, "2 hours"],
      [180, "3 hours"],
      [300, "A whole evening · 5h"],
    ],
    arc.minutes,
  )}${filterSelect(
    "04 / I’m open to",
    "kind",
    [
      ["any", "Anything"],
      ["movie", "A film"],
      ["series", "A series episode"],
      ["animation", "Animation"],
    ],
    arc.kind,
  )}<button class="button" type="submit">Find my arc ${icon("arrow")}</button></div><p class="arc-note">We skip titles you've watched or ruled out. Series fit one episode, not a whole season. Mood notes describe tone, not endings.</p></form><div id="arc-results" aria-live="polite">${arcResult ? arcResults() : `<div class="arc-before"><span>NOW</span><div></div><span>A STORY</span><div></div><span>AFTERWARDS ✳</span></div>`}</div></div>`;
}
function arcResults() {
  if (!arcResult) return "";
  const r = arcResult;
  return `<section class="section arc-result"><div class="section-heading"><div><span class="eyebrow">${esc(fromNames[r.arc.from])} → ${esc(moodNames[r.arc.to])}</span><h2>${r.results.length ? (r.exact ? "YOUR EVENING, REFRAMED." : "A NEARBY DETOUR.") : "LET’S WIDEN THE FRAME."}</h2></div><span class="small muted">${r.exact ? "A mood match, not a guarantee." : "No exact mood match with these limits."}</span></div>${r.results.length ? `<div class="arc-result-grid">${r.results.map((t, i) => `<article class="recommendation"><span class="rec-number">0${i + 1} / ${i === 0 ? "START HERE" : "ANOTHER WAY IN"}</span>${card(t)}<div class="why"><span>WHY THIS, TONIGHT</span><p>${esc(t.reasons[1])}</p>${t.reasons[2] ? `<p>${esc(t.reasons[2])}</p>` : ""}</div></article>`).join("")}</div>${r.pair ? `<div class="double-bill"><div><span class="eyebrow">MAKE A NIGHT OF IT / ${r.pair.minutes} MIN TOTAL</span><h3>THE DOUBLE BILL.</h3><p>${esc(r.pair.reason)}</p><button class="text-link" data-action="pair-save">Save both to watchlist ${icon("plus")}</button></div><div class="pair-posters">${r.pair.titles.map((t) => link(listLink(t.id), poster(t))).join("<span>+</span>")}</div></div>` : `<p class="muted small pairing-note">Want a double bill? Give yourself a whole evening. We only pair complete films that fit your total time.</p>`}` : empty("NO UNSEEN PICKS FIT YET.", "Try more time, another format or restore a title from “Not for me” in your collection.", "See my collection", "/collection")}</section>`;
}
function details(t) {
  if (!t)
    return empty(
      "THIS ONE ISN’T IN THE EDIT.",
      "Find another starting point in the programme.",
    );
  const e = entry(t.id),
    similar = catalogue
      .filter(
        (x) =>
          x.id !== t.id &&
          (x.genre === t.genre || x.moods.some((m) => t.moods.includes(m))),
      )
      .slice(0, 4);
  return `<div class="wrap page"><div class="breadcrumb">${link("/explore", "← Back to the programme")}<span>${type(t)} / ${t.year}</span></div><section class="detail"><div class="detail-poster">${poster(t, "", true)}<span class="poster-credit">Poster reference · ${esc(t.sourceName)}</span></div><div class="detail-copy"><span class="eyebrow">${esc(t.genre)} / ${esc((t.languages || [t.language]).join(" / "))}</span><h1>${esc(t.title)}</h1><div class="detail-facts"><span>${t.year}</span><span>${length(t)}</span><span>${t.energy === "low" ? "Gentle" : t.energy === "medium" ? "Moderate" : "High"} intensity</span></div>${t.format === "series" ? `<p class="series-note">${t.seasons} season${t.seasons === 1 ? "" : "s"} listed · ${t.status === "Ended" ? "Completed series" : "Status: " + esc(t.status)}<br>Time shown is a typical episode, not the complete series.</p>` : ""}<p class="synopsis">${esc(t.description)}</p>${t.creator ? `<p class="credit-line">DIRECTED BY <strong>${esc(t.creator)}</strong></p>` : ""}<div class="curator-note"><span>THE AFTERCREDITS TAKE</span><p>“${esc(t.note)}”</p></div><div class="mood-tags">${t.moods.map((m) => link("/explore?mood=" + m, moodNames[m], "tag")).join("")}</div><div class="detail-actions">${collectionControl(t, "button")}${e?.status === "watched" ? "" : `<button class="button outline" data-action="rate" data-id="${t.id}">I’ve watched this</button>`}</div><div class="secondary-actions"><button class="text-link" data-action="compare" data-id="${t.id}">${icon("compare")}${compare.includes(t.id) ? "On your shortlist" : "Compare this"}</button><button class="text-link" data-action="hide" data-id="${t.id}">${e?.status === "hidden" ? "Restore this title" : "Not for me"}</button></div><div class="watch-links"><h2>MAKE IT A WATCH.</h2><label>Search availability in <select id="region" aria-label="Streaming search region">${[
    ["ae", "United Arab Emirates"],
    ["in", "India"],
    ["gb", "United Kingdom"],
    ["us", "United States"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${session.region === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select></label><div><a href="https://www.justwatch.com/${session.region}/search?q=${encodeURIComponent(t.title)}" target="_blank" rel="noopener" id="watch-provider">Search streaming options ↗</a><a href="https://www.youtube.com/results?search_query=${encodeURIComponent(t.title + " " + t.year + " official trailer")}" target="_blank" rel="noopener">Search trailers ↗</a></div><p>External searches, not confirmed availability. Check the exact title and your local content rating before watching.</p></div><p class="source-line">Facts: <a href="${t.source}" target="_blank" rel="noopener">${esc(t.sourceName)} ↗</a> · Checked ${t.verified}. Mood and intensity notes are editorial.</p></div></section><section class="section"><div class="section-heading"><div><span class="eyebrow">KEEP FOLLOWING THE THREAD</span><h2>IN A SIMILAR ORBIT.</h2></div></div><div class="film-grid">${similar.map(card).join("")}</div></section></div>`;
}
function collection() {
  const counts = Object.fromEntries(
    ["saved", "watched", "hidden"].map((s) => [
      s,
      session.entries.filter((e) => e.status === s).length,
    ]),
  );
  const items = session.entries
    .filter((e) => e.status === collectionTab)
    .map((e) => ({ t: title(e.titleId), e }))
    .filter((x) => x.t);
  return `<div class="wrap page"><div class="page-heading collection-heading"><div><span class="eyebrow">YOUR OWN LITTLE FILM CLUB</span><h1>THE KEEPERS.<br>THE BEEN-THERES.</h1><p>A place for your next watch, and the stories you've already met.</p></div><div class="collection-stamp">${counts.watched}<span>STORIES<br>WATCHED</span></div></div>${!online ? '<p class="error">Your collection is unavailable right now. Reload to reconnect.</p>' : ""}<div class="collection-tabs" role="group" aria-label="Collection view">${[
    ["saved", "Watchlist"],
    ["watched", "Watched"],
    ["hidden", "Not for me"],
  ]
    .map(
      ([v, l]) =>
        `<button data-action="collection-tab" data-id="${v}" class="${collectionTab === v ? "active" : ""}" aria-pressed="${collectionTab === v}">${l}<span>${counts[v]}</span></button>`,
    )
    .join(
      "",
    )}</div>${items.length ? `<div class="film-grid">${items.map(({ t, e }) => `<div>${card(t)}<div class="collection-actions">${e.status === "watched" ? `<button class="text-link" data-action="rate" data-id="${t.id}">${e.rating ? "★".repeat(e.rating) + " · Edit rating" : "Add a personal rating"}</button>` : e.status === "saved" ? `<button class="text-link" data-action="rate" data-id="${t.id}">Mark watched ${icon("check")}</button>` : ""}<button class="text-link" data-action="remove" data-id="${t.id}">${e.status === "hidden" ? "Restore title" : "Remove"}</button></div></div>`).join("")}</div>` : empty(collectionTab === "saved" ? "YOUR NEXT FAVOURITE IS OUT THERE." : collectionTab === "watched" ? "THE STORY STARTS HERE." : "NOTHING RULED OUT.", "Save a title with +, mark it watched, or rule it out from its detail page. Your choices make the next recommendation more personal.")}<div class="collection-bottom"><p>Saved privately in this browser for 90 days. No account, no cross-device sync. Highly rated genres gently influence Mood Arc; watched and ruled-out titles stay out of its results.</p><div><a href="/api/export" download class="text-link">Export my collection ↗</a>${link("/privacy", "Manage my data " + icon("arrow"), "text-link")}</div></div></div>`;
}
function about() {
  return `<article class="wrap prose page"><span class="eyebrow">A NOTE FROM THE PROGRAMME</span><h1>GOOD STORIES.<br>LESS GUESSWORK.</h1><p class="lead">Aftercredits is an independent, curated discovery project for people who want to spend more of the evening watching, and less of it deciding.</p><h2>WHY MOOD ARC?</h2><p>“Comedy” is a shelf. “I’m drained, take me somewhere else” is an evening. Mood Arc combines your starting point, an editorial mood destination and available time. It prioritises that destination, then adjusts for energy and genres you have rated highly. It never promises an emotional result.</p><h2>A SMALLER, MORE CONSIDERED EDIT.</h2><p>The launch programme contains ${catalogue.length} titles. It is intentionally curated, not a complete film database. Films use full running time. Series use typical episode duration, with season count and a clear commitment note. We do not invent audience scores, trending status or subscription availability.</p><h2>SOURCES & ARTWORK.</h2><p>Movie facts and poster references are sourced from <a href="https://en.wikipedia.org" target="_blank" rel="noopener">Wikipedia</a>; television facts and artwork references from <a href="https://www.tvmaze.com/api" target="_blank" rel="noopener">TVmaze</a>. Every title links to its source. Data was checked on 16 September 2026 and may change.</p><p>TVmaze data is used under CC BY-SA. Editorial synopses, notes and mood tags are written for this programme. Posters identify the works discussed and remain the property of their respective rights holders; they are not covered by a blanket open-source licence. This project is not affiliated with any studio or streaming service.</p><h2>A LITTLE ROOM FOR YOU.</h2><p>Your watchlist, history, personal ratings and exclusions are stored privately on the server using an anonymous browser cookie. There are no advertising trackers, paid placements or fabricated reviews. You can export or delete your data whenever you like.</p>${link("/mood-arc", "Find your first arc " + icon("arrow"), "button")}</article>`;
}
function privacy() {
  return `<article class="wrap prose page"><span class="eyebrow">YOUR COLLECTION, YOUR CALL</span><h1>NO ACCOUNT.<br>NO FOLLOWING YOU.</h1><p class="lead">Just enough memory to help you find your next good story.</p><h2>WHAT’S SAVED</h2><p>An essential HTTP-only cookie identifies your private collection on this browser. The database stores saved, watched and ruled-out titles, personal ratings, your latest Mood Arc, region preference and an expiry date. No name, email or payment details are requested.</p><p>The cookie expires after 90 days. Clearing it loses access to this anonymous collection. We do not offer cross-device recovery. Expired records are removed in bounded batches when new sessions are created; this is not an immediate scheduled deletion guarantee.</p><h2>LOCAL PREFERENCES & EXTERNAL LINKS</h2><p>Your theme is saved locally. There are no advertising analytics. Hosting providers process technical connection information to serve the site. Trailer and streaming searches open external services under their own privacy policies.</p><h2>TAKE IT WITH YOU. OR LET IT GO.</h2><div class="detail-actions"><a href="/api/export" download class="button outline">Export collection ↗</a><button class="button danger" data-action="reset-confirm">Delete my data</button></div><p class="small muted">Deletion removes this browser’s server-side collection, ratings and preferences. This cannot be undone.</p></article>`;
}
async function render() {
  shell();
  const p = location.pathname;
  $("#main").innerHTML =
    p === "/"
      ? home()
      : p === "/explore"
        ? explore()
        : p === "/mood-arc"
          ? moodArc()
          : p === "/collection"
            ? collection()
            : p.startsWith("/title/")
              ? details(title(p.slice(7)))
              : p === "/about"
                ? about()
                : p === "/privacy"
                  ? privacy()
                  : empty(
                      "A LITTLE OFF SCRIPT.",
                      "That page isn’t in the programme.",
                    );
  document.title =
    (p.startsWith("/title/")
      ? title(p.slice(7))?.title
      : p === "/mood-arc"
        ? "Mood Arc"
        : p === "/explore"
          ? "The programme"
          : p === "/collection"
            ? "My collection"
            : "Something worth your evening") + " — Aftercredits";
  if (p === "/explore") loadExplore();
  bindImages();
}
function bindImages() {
  $$("img").forEach((img) =>
    img.addEventListener("error", () => img.classList.add("broken"), {
      once: true,
    }),
  );
}
function navigate(href) {
  closeDialog();
  history.pushState({}, "", href);
  render();
  window.scrollTo({ top: 0, behavior: "instant" });
  $("#main").focus({ preventScroll: true });
}
async function mutate(id, status, rating = 0) {
  if (busy) return false;
  if (!online) {
    toast("Your collection is offline. Reload to reconnect.");
    return false;
  }
  busy = true;
  const focus = focusKey();
  try {
    session = await api("entry", "PUT", {
      titleId: id,
      status,
      rating,
      revision: session.revision,
    });
    if (!["saved", "remove"].includes(status)) arcResult = null;
    return true;
  } catch (e) {
    if (e.message === "conflict")
      session = await api("state").catch(() => session);
    toast(errorText(e.message));
    return false;
  } finally {
    busy = false;
    shell();
    if (
      location.pathname.startsWith("/title/") ||
      location.pathname === "/collection"
    )
      await render();
    document
      .querySelectorAll(`.collection-control[data-id="${id}"]`)
      .forEach((b) => {
        b.outerHTML = collectionControl(title(id), b.dataset.presentation);
      });
    restoreFocus(focus);
  }
}
function rateDialog(id) {
  const t = title(id),
    e = entry(id);
  openDialog(
    `<span class="eyebrow">ROLL THE CREDITS</span><h2 id="dialog-title">${esc(t.title)}</h2><p>Your personal rating. Optional, always editable.</p><form id="rating-form" data-id="${id}"><fieldset class="rating-options"><legend class="sr-only">Rating out of five</legend>${[0, 1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rating" value="${n}" ${(e?.rating || 0) === n ? "checked" : ""}><span>${n ? n + " ★" : "No rating"}</span></label>`).join("")}</fieldset><button class="button" type="submit">Mark as watched ${icon("check")}</button></form>`,
  );
}
function compareDialog() {
  const ts = compare.map(title);
  openDialog(
    `<span class="eyebrow">SIDE BY SIDE</span><h2 id="dialog-title">THE SHORTLIST.</h2><div class="comparison">${ts.map((t) => `<article>${poster(t)}<h3>${link(listLink(t.id), esc(t.title))}</h3><dl><dt>Format</dt><dd>${type(t)}</dd><dt>Time</dt><dd>${length(t)}</dd><dt>Language</dt><dd>${esc((t.languages || [t.language]).join(" / "))}</dd><dt>Intensity</dt><dd>${t.energy}</dd><dt>Good for</dt><dd>${t.moods.map((m) => moodNames[m]).join(", ")}</dd></dl>${collectionControl(t, "text-link")}</article>`).join("")}</div>`,
  );
}
function searchDialog() {
  openDialog(
    `<span class="eyebrow">FOLLOW A NAME</span><h2 id="dialog-title">WHAT'S ON YOUR MIND?</h2><form id="quick-search"><label class="search-input">${icon("search")}<input id="quick-query" type="search" name="q" aria-label="Search the programme" placeholder="A title or a director…" maxlength="100" autofocus></label><button class="button" type="submit">Search programme ${icon("arrow")}</button></form><p class="small muted">Search our ${catalogue.length}-title edit. Not sure? Mood Arc is a good place to start.</p>`,
  );
  $("#quick-query").focus();
}
document.addEventListener("click", async (e) => {
  const a = e.target.closest("a[data-link]");
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault();
    navigate(a.getAttribute("href"));
    return;
  }
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const act = b.dataset.action,
    id = b.dataset.id;
  if (act === "theme") {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("aftercredits-theme", theme);
    } catch {}
    shell();
    $('[data-action="theme"]')?.focus();
  }
  if (act === "retry") start();
  if (act === "close") closeDialog();
  if (act === "search") searchDialog();
  if (act === "menu")
    openDialog(
      `<h2 id="dialog-title">THE PROGRAMME.</h2><nav class="mobile-links">${link("/explore", "Discover")}${link("/mood-arc", "Mood Arc")}${link("/collection", "My collection")}${link("/about", "About Aftercredits")}</nav>`,
    );
  if (act === "save") {
    if (entry(id)?.status === "watched") {
      rateDialog(id);
      return;
    }
    const s = entry(id)?.status === "saved" ? "remove" : "saved";
    if (await mutate(id, s))
      toast(
        s === "saved"
          ? "Added to your watchlist."
          : "Removed from your watchlist.",
      );
  }
  if (act === "rate") rateDialog(id);
  if (act === "remove") {
    if (await mutate(id, "remove"))
      toast("Removed. You can find it in the programme anytime.");
  }
  if (act === "hide") {
    const s = entry(id)?.status === "hidden" ? "remove" : "hidden";
    if (await mutate(id, s))
      toast(
        s === "hidden"
          ? "Ruled out. Restore it in your collection anytime."
          : "Back in the mix.",
      );
  }
  if (act === "collection-tab") {
    collectionTab = id;
    render();
    $(`[data-action="collection-tab"][data-id="${id}"]`)?.focus();
  }
  if (act === "compare") {
    if (compare.includes(id)) compare = compare.filter((x) => x !== id);
    else if (compare.length < 3) compare.push(id);
    else {
      toast("Three is a good shortlist. Remove one before adding another.");
      return;
    }
    shell();
    $$('[data-action="compare"]').forEach((el) => {
      el.classList.toggle("active", compare.includes(el.dataset.id));
      el.setAttribute("aria-pressed", compare.includes(el.dataset.id));
    });
    toast(
      compare.includes(id)
        ? "Added to your comparison."
        : "Removed from comparison.",
    );
  }
  if (act === "compare-clear") {
    compare = [];
    render();
  }
  if (act === "compare-open") compareDialog();
  if (act === "surprise") {
    const candidates = catalogue.filter(
      (t) =>
        t.format === "film" &&
        !["hidden", "watched"].includes(entry(t.id)?.status),
    );
    if (candidates.length)
      navigate(
        listLink(
          candidates[
            crypto.getRandomValues(new Uint32Array(1))[0] % candidates.length
          ].id,
        ),
      );
    else
      toast(
        "You’ve seen this film edit. Try a series or restore an excluded film.",
      );
  }
  if (act === "filters-clear") navigate("/explore");
  if (act === "pair-save" && arcResult?.pair) {
    const ids = arcResult.pair.titles.map((t) => t.id);
    let ok = true;
    for (const tid of ids) if (!(await mutate(tid, "saved"))) ok = false;
    if (ok) toast("Both films are on your watchlist.");
  }
  if (act === "reset-confirm")
    openDialog(
      `<h2 id="dialog-title">A CLEAN SLATE?</h2><p>This permanently deletes this browser’s collection, ratings and preferences from the server.</p><div class="detail-actions"><button class="button danger" data-action="reset">Delete my data</button><button class="button outline" data-action="close">Keep my collection</button></div>`,
    );
  if (act === "reset") {
    if (busy) return;
    busy = true;
    try {
      await api("reset", "POST", {});
      session = await api("session", "POST", {});
      arcResult = null;
      arc = { from: "drained", to: "transported", minutes: 120, kind: "any" };
      compare = [];
      closeDialog();
      render();
      toast("Your collection and preferences have been deleted.");
    } catch (err) {
      toast(errorText(err.message));
    } finally {
      busy = false;
    }
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "quick-search") {
    const q = new FormData(f).get("q");
    navigate("/explore?q=" + encodeURIComponent(q));
  }
  if (f.id === "filters") applyFilters();
  if (f.id === "rating-form") {
    const rating = Number(new FormData(f).get("rating"));
    if (await mutate(f.dataset.id, "watched", rating)) {
      closeDialog();
      toast("Logged. Here’s to the next good story.");
    }
  }
  if (f.id === "arc-form") {
    if (busy) return;
    busy = true;
    const d = new FormData(f);
    arc = {
      from: d.get("from"),
      to: d.get("to"),
      minutes: Number(d.get("minutes")),
      kind: d.get("kind"),
    };
    const button = f.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Finding your stories…";
    try {
      arcResult = await api("recommend", "POST", arc);
      if (!$("#arc-results")) return;
      $("#arc-results").innerHTML = arcResults();
      bindImages();
      $("#arc-results").scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
      try {
        session = await api("preferences", "PUT", {
          arc,
          region: session.region,
          revision: session.revision,
        });
      } catch (err) {
        if (err.message === "conflict")
          session = await api("state").catch(() => session);
        toast("Your picks are ready; preferences could not be saved.");
      }
    } catch (err) {
      toast(errorText(err.message));
    } finally {
      busy = false;
      button.disabled = false;
      button.innerHTML = "Find my arc " + icon("arrow");
    }
  }
});
function applyFilters() {
  const form = $("#filters");
  if (!form) return;
  const p = new URLSearchParams(new FormData(form));
  p.set("sort", $("#sort").value);
  const mood = new URLSearchParams(location.search).get("mood");
  if (mood) p.set("mood", mood);
  for (const [k, v] of [...p])
    if (!v || v === "all" || v === "curated") p.delete(k);
  history.replaceState({}, "", "/explore" + (p.size ? "?" + p : ""));
  loadExplore();
}
document.addEventListener("input", (e) => {
  if (e.target.id === "catalogue-search") {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 220);
  }
});
document.addEventListener("change", async (e) => {
  if (e.target.closest("#filters") || e.target.id === "sort") applyFilters();
  if (e.target.id === "region") {
    const value = e.target.value;
    try {
      session = await api("preferences", "PUT", {
        region: value,
        arc,
        revision: session.revision,
      });
      const t = title(location.pathname.slice(7));
      if ($("#watch-provider"))
        $("#watch-provider").href =
          `https://www.justwatch.com/${value}/search?q=${encodeURIComponent(t.title)}`;
    } catch (err) {
      e.target.value = session.region;
      toast(errorText(err.message));
    }
  }
});
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName) &&
    !$("#dialog").open
  ) {
    e.preventDefault();
    searchDialog();
  }
});
$("#dialog").addEventListener("close", () => {
  document.body.classList.remove("locked");
  restoreFocus(dialogOpener);
});
$("#dialog").addEventListener("click", (e) => {
  if (e.target === $("#dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeDialog();
  }
});
window.addEventListener("popstate", () => {
  closeDialog();
  render();
});
async function start() {
  try {
    const [c, s] = await Promise.all([
      api("catalogue"),
      api("session", "POST", {}).catch(() => null),
    ]);
    catalogue = c.titles;
    if (s) {
      session = s;
      online = true;
      if (s.arc.from) arc = s.arc;
    }
    await render();
    if (!online)
      toast(
        "Discovery is ready. Collection storage is temporarily unavailable.",
      );
  } catch {
    shell();
    $("#main").innerHTML = empty(
      "A BRIEF INTERMISSION.",
      "We couldn’t load the programme. Please reload in a moment.",
      "Reload the programme",
      "/",
    )
      .replace(
        '<a href="/" data-link class="button">',
        '<button data-action="retry" class="button">',
      )
      .replace("</a>", "</button>");
  }
}
start();
