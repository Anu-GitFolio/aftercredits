# Aftercredits

A film discovery site for movies, series and animation. Built with HTML, CSS and JavaScript, a Cloudflare Worker and D1.

[Open the site](https://aftercredits-film-club.raees-atelier-concept.workers.dev)

Mood Arc starts with your mood, where you want a story to take you, and how much time you have. It returns up to three recommendations with reasons for each choice. When two complete films fit the evening, it also suggests a double bill.

The catalogue contains 33 titles. Search by title or creator, combine filters, compare up to three picks, and keep a watchlist. Watched history and personal ratings influence later recommendations. Light and dark themes are available throughout.

## Local development

Requires Node.js 22 or later and npm. Local development does not need a metadata API key or Cloudflare login.

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://127.0.0.1:8790`. The catalogue seed uses upserts so existing title references are preserved.

## Tests and builds

Keep the development server running for the API tests:

```sh
npm test
npm run format:check
npm run build
```

`npm run test:unit` runs the recommendation tests without a server. API tests cover filtering, visitor isolation, persistence, concurrent updates, export and deletion.

For browser checks, run `npm run qa:prepare`, then open `/__qa/index.html` for layout and accessibility checks or `/__qa/state.html` for interaction regressions. Audit files are excluded from production. Existing browser coverage is Chromium; Safari, Firefox and real-device checks remain outstanding.

## Code layout

| Path | Purpose |
| --- | --- |
| `public/app.js` | Routes, filters, themes, dialogs and collection controls |
| `public/style.css` | Responsive layouts, typography and theme colours |
| `server/index.js` | API routes, catalogue queries, sessions and persistence |
| `server/recommend.js` | Recommendation scoring and double-bill selection |
| `data/` | Catalogue snapshot and database seed |
| `migrations/` | D1 schema |
| `tests/` | Recommendation and API tests |
| `scripts/catalogue.py` | Optional metadata import utility |

## How Mood Arc works

The server first removes watched and hidden titles, then enforces the requested runtime and format. Eligible titles receive these scores:

| Factor | Points |
| --- | ---: |
| Requested destination mood | 100 |
| Starting-energy fit | 20 |
| Genre of a watched title rated at least 4 out of 5 | 8 |
| Already on the watchlist | 3 |

Exact destination matches are returned when available. Otherwise, the results are labelled as alternatives. Ties are sorted by title. Double bills contain two distinct, complete films that match the destination and fit the combined time budget. Series durations refer to one typical episode.

The ranking uses editorial tags and explicit rules. It does not use machine learning or aggregate audience ratings.

## Saved collections

D1 holds the catalogue, anonymous sessions and collection entries. Each entry has one status: saved, watched or hidden, with an optional personal rating. Marking a title watched removes it from the watchlist and future recommendations.

A random HTTP-only cookie identifies the browser for 90 days; the database stores its hash. Writes use prepared SQL, input limits, origin checks and revision numbers. A stale update returns a conflict and refreshes the browser's state. Personal responses are not cached.

Export downloads the current collection as JSON. Delete removes the session and its entries. There are no accounts or cross-device recovery; clearing the cookie loses access to that collection. Expired sessions are cleaned up in batches when new sessions are created.

## Deploy

For a separate deployment, change the Worker name in `wrangler.production.jsonc`, create a D1 database and put its ID in the `DB` binding:

```sh
npx wrangler login
npx wrangler d1 create your-database-name
npx wrangler d1 migrations apply DB --remote --config wrangler.production.jsonc
npx wrangler d1 execute DB --remote --config wrangler.production.jsonc --file data/catalogue.sql
npm run deploy
```

The build bundles the Worker and minifies browser assets into `dist/`. GitHub stores the source; deployment is performed with Wrangler.

## Catalogue sources

Metadata is a reviewed snapshot from Wikipedia and TVmaze, checked on 16 September 2026. Ordinary browsing does not call either provider. Mood tags and short recommendations are editorial interpretations.

Streaming and trailer links open external searches. They do not establish current regional availability, and the site does not stream video. See [CREDITS.md](CREDITS.md) for metadata attribution, artwork sources and font licences.
