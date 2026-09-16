# Architecture

## Browser and request flow

The browser uses native ES modules, semantic HTML, CSS and the History API. A single route renderer covers discovery, Mood Arc, title pages, collection, sources and privacy. The Worker serves the document for application routes and static files for asset paths. There is no frontend framework, client build runtime, advertising script or browser request to a metadata provider.

The Worker queries D1 for catalogue filtering and ranking input. Catalogue data is committed as a reproducible snapshot, so upstream availability does not affect the review site. Updates are an explicit editorial operation, not a promise of a live streaming catalogue.

## API

| Method / path | Behaviour |
| --- | --- |
| `GET /api/catalogue` | Public, bounded parameterised filtering, sorting and metadata |
| `POST /api/session` | Creates an anonymous session or returns its current state |
| `GET /api/state` | Returns only the current session's collection and preferences |
| `PUT /api/entry` | Saves, marks watched, excludes or removes a title with a revision check |
| `PUT /api/preferences` | Saves a validated region and Mood Arc with a revision check |
| `POST /api/recommend` | Applies mood, duration, format, exclusions and rating affinity |
| `GET /api/export` | Downloads the current session's collection as JSON |
| `POST /api/reset` | Deletes the current session and its entries; expires its cookie |

## Persistence and ownership

The cookie is a random 256-bit value. D1 stores its SHA-256 digest rather than the browser credential. Session lookups include the expiry condition. Every entry query is scoped to the resolved session; callers cannot submit another session ID. Cookies are HTTP-only, SameSite=Strict and Secure on HTTPS, and expire after 90 days.

Each title has one collection status: saved, watched or hidden. Marking watched moves a title out of the watchlist. Watched controls open the personal rating editor, preserving history. Explicit removal and exclusion remain reversible through discovery and collection controls.

Mutations require the site's Origin and custom request header. SQL uses prepared bindings and allowlisted sort expressions. Bodies are bounded to 8 KB; search to 100 characters; ratings to integer 0–5. Existing sessions allow up to 90 protected requests per minute. This is a per-session application limit, not a distributed anti-abuse perimeter: a public production service should add edge limits for session creation and broader operational monitoring.

A revision number prevents silent last-write-wins updates across tabs. Entry changes and their conditional revision increments execute together in a D1 batch. A stale revision returns 409; the browser refreshes the current state and asks the visitor to repeat their change. Export responses and personal API data are not cached.

Expired sessions are pruned in batches of up to 100 when new sessions are created. The privacy page accurately describes this lazy cleanup. There is no recovery identity or cross-device account, so clearing the cookie loses access to that anonymous collection.

## Mood Arc

1. Validate starting mood, desired destination, supported time and format.
2. Remove watched and hidden titles. Enforce the duration and format constraints.
3. Rank destination matches first (+100), then starting-energy fit (+20), genres rated at least 4/5 (+8), and existing watchlist interest (+3).
4. Return up to three exact destination matches when available. Otherwise label the result a nearby detour. Empty results remain empty, with actionable recovery.
5. Pair only two distinct, complete films matching the destination and fitting the total time budget. Series never enter double bills.

There are no aggregate audience ratings or simulated popularity figures. Editorial mood, intensity and commentary are distinguished from sourced factual metadata. Recommendations explain their factors rather than presenting an opaque match percentage.

## Rendering and performance

Fonts are self-hosted WOFF2 with `font-display: swap`. Posters are local WebP files, sized at no more than 480×720 and never enlarged during import. Layout reserves poster space. Offscreen artwork loads lazily; hero posters and primary detail posters load eagerly. Browser assets are minified for deployment. Motion uses opacity and transforms, with a reduced-motion override and no autoplay media.

The CSP allows scripts, fonts, images and connections from the same origin. External streaming/trailer links use new tabs with `noopener`. Errors return controlled messages; credentials and server details are not exposed to visitors.

## Tradeoffs and next steps

The curated catalogue is intentionally small, uses editorial rather than community ranking, and has no claim to current platform availability. Series durations are typical episode lengths, not guarantees for every episode. The site does not provide licensed streaming, trailers or verified local age classifications.

For a larger product: obtain a licensed metadata/artwork feed; maintain region-specific content ratings and streaming availability; add optional recoverable accounts; extend the catalogue with editorial tooling; and establish monitoring, scheduled retention cleanup, edge abuse protection and real-device browser testing. These are extensions, not placeholder controls in the current interface.
