# Credits

The catalogue was checked on 16 September 2026. Records in `data/catalogue.json` include the source page, source name, artwork URL and verification date. Title pages link to their sources.

## Metadata

Film facts and poster references come from the Wikipedia articles linked in the catalogue. Television facts and artwork references come from the [TVmaze API](https://www.tvmaze.com/api).

TVmaze data is supplied under [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/). This catalogue selects and normalises fields and adds editorial descriptions and mood tags. Retain attribution and the applicable share-alike conditions when redistributing TVmaze-derived data.

Synopses, notes, mood and energy tags are editorial descriptions, not official classifications or promises of an emotional outcome.

## Artwork

Poster sources are recorded in each title's `imageSource` field. The local copies are resized WebP images used to identify the titles being discussed. Copyright remains with the respective rights holders. Hosting on Wikipedia or TVmaze does not grant a blanket image licence; obtain suitable rights for commercial reuse. This repository does not relicense the artwork.

## Fonts

Barlow Condensed and DM Sans are self-hosted from Fontsource packages under the SIL Open Font License. Licence notices are included in `public/assets/licenses/`.

## Updating the catalogue

`scripts/catalogue.py` is an optional import utility. Normal development uses the committed snapshot and does not require Python.

To refresh the data, install `scripts/requirements.txt`, run the importer, review the changed facts and artwork sources, update the verification date consistently, then seed the database. The importer stops without replacing the catalogue if a source request fails. SQL upserts preserve existing collection references.
