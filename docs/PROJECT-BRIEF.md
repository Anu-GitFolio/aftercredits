# Aftercredits

Build a distinctive film-club discovery experience for movies, series and animation. The product should turn the question “what should I watch?” into a considered choice in under a minute.

## Signature experience

Mood Arc starts with how the visitor feels and asks how they want the evening to feel: comforted, curious, exhilarated, moved or transported. Combine this arc with time available and format. Give three ranked recommendations with title-specific editorial reasons. Offer an optional two-film programme with its combined runtime and a clear ordering rationale. Mood descriptions are editorial interpretations, not mental-health promises or plot spoilers.

## Discovery and continuity

Provide combined title/director search, format, genre, year, original language, runtime and intensity filters; sorting; meaningful no-result recovery; detailed spoiler-free title pages; source links; region-aware external streaming searches; clearly labelled trailer searches; curated collections; a surprise pick; comparison of up to three titles; a persistent watchlist; watched history with personal ratings; reversible exclusions; and export/deletion of personal collection data. Series show episode length and are never represented as a complete short watch.

Use a curated catalogue of verified public metadata with visible sources and a review date. Never fabricate aggregate ratings, popularity, urgency or subscription availability. Recommendation ranking must respond to the visitor’s saved, watched and excluded titles without hiding how it works.

## Visual direction

A contemporary cinema programme: oversized condensed type, strong editorial composition, numbered selections, rich poster artwork, a connected “Now → Afterwards” motif and a restrained chartreuse accent. Avoid streaming-platform imitation, decorative glass panels, stock gradients and repetitive cards as the only layout. Design complete light and dark themes. Use purposeful transitions, staggered entrances and hover detail; honour reduced motion and never require animation for understanding.

## Engineering and delivery

Vanilla HTML, CSS and JavaScript with no frontend framework. A JavaScript Cloudflare Worker and D1 database own catalogue filtering and persistent visitor collections. Use unguessable HTTP-only credentials, prepared statements, ownership checks, bounded inputs, write limits and revision checks. Keep secrets out of the repository. Anonymous continuity must be accurately described as browser-specific, without implying cross-device accounts.

Validate at common phone, tablet and desktop widths, keyboard navigation, both themes, reduced motion and enlarged text. Test data persistence, access isolation, filters and recommendation constraints. Optimize images and fonts, lazy-load offscreen artwork, minimize scripts, and record measured results rather than invented performance scores.

Publish to the existing Cloudflare account and a separate repository in the existing GitHub account. Include setup, source attribution, architecture, validation and a short reviewer walkthrough.
