# Card Asset Generation

This note defines the local workflow for replacing runtime tarot card images.

Runtime card assets in `apps/web/public/cardsV2/` must remain full-bleed portrait PNG
files close to `1:1.7`. Every image must be registered in
`data/decks/card-asset-manifest.json` with its actual dimensions and a matching SHA-256
hash.

## Local Replacement Workflow

Use the local procedural generator:

```bash
npm run generate:assets
```

This command:

- reads `data/decks/rider-waite-smith.json`
- renders 78 card fronts and one card back from native portrait SVGs
- writes PNG files into `apps/web/public/cards/`
- rewrites `data/decks/card-asset-manifest.json`

The generator does not call any external API. It uses `sharp` from the web package to
render SVGs into production PNGs.

After every generation run, validate the runtime assets:

```bash
npm run validate:assets
```

The validator checks manifest coverage, portrait aspect ratio, `fullBleed`, source kind,
visual review status, recorded dimensions, and SHA-256 hashes.

## Style Guardrails

Generated cards should match AetherTarot's Paper / Midnight design language:

- warm editorial tarot, reflective rather than predictive
- full-bleed portrait-native card art
- restrained symbolic marks instead of crowded illustrative scenes
- suit-specific color families for cups, wands, swords, and pentacles
- no runtime dependency on square art, remote images, or API-generated files

Frontend UI remains responsible for card names, spread positions, and interpretation
structure. Card images should provide atmosphere and symbolic orientation without making
the output protocol depend on in-image text.

For image-model batches that should retain English titles and use a medieval European
visual language, use `docs/70-ops/medieval-europe-card-image-prompts.md` as the
self-contained prompt source.
