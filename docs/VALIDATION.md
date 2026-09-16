# Validation record

## Automated behaviour checks

All 10 Node test cases passed against both the local Worker and the public Cloudflare deployment. They exercise:

- Combined catalogue filtering, sorting, title/director search, invalid filter rejection and parameterised search input.
- Separate-session collection isolation, persisted changes, stale revisions and simultaneous updates (one succeeds, one returns 409).
- Rating/title validation, collection export, deletion, fresh-session state, request size limits and cross-origin write rejection.
- All 120 destination/format/time combinations, respecting title duration, complete-film pairing budgets and watched/excluded titles.
- Different starting-energy rankings, personal-rating genre affinity, exhausted-catalogue empty states and episode-based short watches.

## Browser checks

The development audit covers eight pages at 320, 360, 390, 430, 768, 1024, 1440 and 1920 CSS pixels in both themes: **128 layout combinations**, with no document-width overflow. It compares scroll width against the usable client width, including scrollbar space.

At 390 and 1440 pixels it also runs axe WCAG 2 A/AA and 2.1 AA checks: **32 scans**, with no reported violations. Automated checks are a useful baseline, not a claim of complete accessibility conformance.

Manual browser checks covered desktop and phone composition, light/dark switching and persistence, Mood Arc submission, double-bill saving, watched history and editable ratings, three-title comparison, native-dialog Escape/focus restoration, multilingual filtering, no-result recovery, and the deployed recommendation flow. The mobile headline was reduced after visual review exposed clipping. Watched controls were revised to preserve existing ratings.

The CSS and result scrolling honour reduced motion. The current browser coverage is Chromium with responsive layouts; physical iOS/Safari and Firefox testing remains a separate release step for a broader commercial launch. No invented Lighthouse score or universal “bug-free” claim is made.

## Build measurements

Measured production assets before HTTP compression:

| Asset | Bytes | Gzip bytes |
| --- | ---: | ---: |
| Browser JavaScript | approximately 35,000 | approximately 13,000 |
| CSS | 36,290 | 8,105 |
| HTML | 1,331 | 686 |
| Both WOFF2 fonts | 59,376 | — |
| All 33 poster WebPs together | 966,064 | — |

Poster dimensions are reserved, and non-hero artwork is lazy-loaded. The production Worker bundle was approximately 10.6 KiB (4.1 KiB gzip), with a reported 2 ms startup at the first deployment. Startup is not a measurement of network latency or page interactivity.

The build excludes `public/__qa`, including the accessibility engine. Dependency audit reported no known vulnerabilities at validation time. Private configuration, local database files, downloaded raw research and dependency directories are excluded from version control.

## Reproduce

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run qa:prepare
npm run dev
# In another terminal:
npm test
npm run format:check
npm run build
```

For layout/accessibility checks, open `http://127.0.0.1:8790/__qa/index.html` and select **Run checks**. The development phone preview is at `/__qa/preview.html`. Prepare the audit assets before starting the server; if new files are added while it is running, restart it.

To exercise a separate deployed copy, set `TEST_URL` to its origin before running `npm test`. The tests create their own anonymous sessions and delete only those sessions. They do not modify the catalogue or another browser's collection.
