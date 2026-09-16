# Aftercredits ✳

**Something worth your evening.** A film-club discovery site for movies, series and animation, built with vanilla HTML, CSS and JavaScript, a Cloudflare Worker, and D1.

[Open the live site](https://aftercredits-film-club.raees-atelier-concept.workers.dev) · [Project brief](docs/PROJECT-BRIEF.md)

Instead of asking visitors to choose from another endless grid, **Mood Arc** asks where they are starting, where they want a story to take them, and how much time they have. Three recommendations explain their fit. When the time allows, a double bill pairs two complete films within the same budget.

## Try the experience

1. Open **Mood Arc**, choose “A little drained → Somewhere else” and two hours.
2. Change to “Restless” to see the ranking respond to your starting energy.
3. Choose a whole evening for a two-film programme. Save both to the watchlist.
4. Mark a title watched and give it a personal rating. It leaves future recommendations; highly rated genres gently influence subsequent picks.
5. Compare three titles, try combined discovery filters, and switch between light and dark themes.

The programme contains 33 sourced titles. Streaming and trailer links are clearly labelled external searches, rather than claims of live availability. Personal collections are anonymous and specific to the browser that created them.

## Run locally

Requires Node.js 22 or later and npm. No metadata API key or Cloudflare sign-in is needed for local development.

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://127.0.0.1:8790`.

```sh
npm test          # API integration tests require the local server above
npm run build    # Minified client assets and bundled Worker in dist/
```

The browser has no framework or third-party runtime scripts. Wrangler, esbuild, Prettier, fonts and the accessibility audit engine are development dependencies.

## What is implemented

- Combined title/director, format, genre, release period, language, duration and intensity filters; five sort orders.
- Movie and series detail pages with spoiler-free premises, editorial notes, source attribution and regional streaming searches.
- Mood Arc ranking, explanations, two-film programmes and unseen surprise picks.
- Watchlist, watched history, editable personal ratings, reversible exclusions, three-title comparison and collection export/deletion.
- Light/dark themes, keyboard-operable native dialogs, visible focus, reduced-motion support, local WebP posters and self-hosted fonts.
- Server-side filtering and persistence, opaque HTTP-only cookies, prepared database statements, input limits, origin checks, per-session write limits and optimistic concurrency checks.

## Structure

| Path | Purpose |
| --- | --- |
| `public/` | Browser application, CSS, fonts and artwork |
| `server/index.js` | HTTP API, session ownership, persistence and asset serving |
| `server/recommend.js` | Pure ranking and double-bill logic |
| `data/` | Sourced catalogue and idempotent database seed |
| `migrations/` | D1 schema |
| `tests/` | Ranking constraints and HTTP integration tests |
| `public/__qa/` | Development-only responsive/accessibility audit; excluded from deployment |
| `docs/` | Product brief, architecture, attribution and validation |

## Deploy your own copy

The production configuration targets the portfolio deployment. To publish a separate copy, create your own D1 database, change the Worker name and database binding in `wrangler.production.jsonc`, then run:

```sh
npx wrangler login
npx wrangler d1 create your-database-name
# Paste the returned database ID into your production configuration.
npx wrangler d1 migrations apply DB --remote --config wrangler.production.jsonc
npx wrangler d1 execute DB --remote --config wrangler.production.jsonc --file data/catalogue.sql
npm run deploy
```

This architecture fits Cloudflare's Workers and D1 free tiers for a small review site. Account-wide usage limits still apply: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/). No subscription changes are required by the application.

Read the [architecture](docs/ARCHITECTURE.md), [validation record](docs/VALIDATION.md), [project brief](docs/PROJECT-BRIEF.md) and [source/asset notes](docs/SOURCES.md). Third-party artwork and metadata have their own terms; they are not relicensed by this repository.
