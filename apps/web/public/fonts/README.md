# Share Card Font

This directory contains the subset Chinese serif font used only by the share-card feature.

## Font

- **Family**: Source Han Serif CN VF / AetherSerif
- **Style**: Regular
- **Source package**: `@chinese-fonts/syst`
- **Original font license**: SIL Open Font License 1.1
- **Package license**: MIT

## How the files are produced

The font files are copied from `@chinese-fonts/syst` by `apps/web/scripts/copy-share-font.js`.
The script:

1. Reads `node_modules/@chinese-fonts/syst/dist/SourceHanSerifCN/result.css`.
2. Rewrites the `font-family` from `"Source Han Serif CN VF"` to `"AetherSerif"`.
3. Copies all `.woff2` subset files into this directory.
4. Writes `aether-serif.meta.json` with version and license metadata.

## Regenerate

```bash
cd apps/web
npm install -D @chinese-fonts/syst
node scripts/copy-share-font.js
```

## Note

If the font CSS is missing at runtime, the share card falls back to the system serif stack defined in `globals.css`.
