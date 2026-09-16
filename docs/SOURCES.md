# Metadata, artwork and fonts

The catalogue snapshot was checked on **16 September 2026**. Every record in `data/catalogue.json` includes its page URL, source name, image source and verification date. Every detail page links to the relevant source.

- **Films:** factual fields and poster references from the individual Wikipedia film articles linked in the data file. No article passages were copied into the synopses. Titles, dates, directors, running times and languages are factual metadata.
- **Television:** factual fields and artwork references from the [TVmaze API](https://www.tvmaze.com/api). TVmaze data is supplied under [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/). The catalogue normalizes field names, selects a small subset and supplements records with editorial descriptions and mood tags. Keep source attribution and the applicable share-alike conditions when redistributing the TVmaze-derived data.
- **Editorial content:** premises, commentary, genre selection, mood and intensity tags are specific to this programme. They are interpretations rather than official classifications or promises of an emotional outcome.
- **Posters:** source assets are identified in `imageSource`, optimized to WebP and displayed to identify the films and programmes being discussed. Copyright belongs to the respective rights holders. Wikipedia or TVmaze hosting does not grant a blanket image licence. The artwork is excluded from any claim of ownership or open-source relicensing. Obtain suitable rights before reusing it outside this editorial portfolio context.
- **Barlow Condensed and DM Sans:** self-hosted from Fontsource packages under the SIL Open Font License. Full licence notices are retained under `public/assets/licenses/`.

`scripts/catalogue.py` is an optional editorial import utility. Local development uses the committed snapshot and does not require Python. For source refreshes, install `scripts/requirements.txt`, run the import, review factual changes and artwork rights, update the checked date consistently, then seed the database. The importer stops without replacing the catalogue when a source request fails. Its SQL uses upserts so refreshing title data preserves existing collection references.

Raw fetched source documents remain local and are excluded from version control. There is no dependency on upstream APIs during normal site use.
