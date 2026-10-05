# Chronosphere V3.1.3 Test Report

Date: 2026-08-30

## Automated tests

PASS — `npm test`

- Coordinate convention: PASS
- 10-second runaway-spin regression: PASS at 30/60/120 FPS and irregular frame intervals
- Inertia hard-cap stress: PASS
- Interior-hole / small-circle regression: PASS
- India POV build wiring: PASS
- Disputed-boundary layer wiring: PASS
- Delhi marker surface/size regression: PASS
- LOD cross-fade bounds: PASS
- Production server health: PASS
- HTML JavaScript syntax: PASS
- Geographic build script syntax: PASS
- Server syntax: PASS

## Extended simulations

- 10-minute idle simulation at 30 FPS: PASS
- 10-minute idle simulation at 60 FPS: PASS
- 10-minute idle simulation at 120 FPS: PASS
- 10,000 drag stress cycles: PASS
- 600-frame LOD enter/exit stress: PASS

## Geographic engineering checks

- Both LOD build sources use Natural Earth `ne_*_admin_0_countries_lakes.geojson`, the dedicated country layers without boundary lakes.
- Regression checks reject accidental reintroduction of the lake-inclusive `ne_*_admin_0_countries.geojson` sources.
Both 50m and 10m production sources use Natural Earth `countries_lakes` datasets, which omit boundary lakes. The runtime also strips interior polygon holes from the India POV fallback. The 10m rendering path now uses only polygon exterior rings for coastline rendering. Interior holes are not rendered as coastlines, preventing small lake-like circles from becoming visible map outlines.

India uses Natural Earth's India POV dataset consistently in both LODs. The 50m representation uses a simplified copy of the same India POV geometry so the India outline does not switch worldview when the LOD changes.

Natural Earth's disputed-boundary line dataset is emitted as a separate overlay. Disputed boundaries are therefore not silently represented as ordinary settled international borders.

## Environment limitation

The sandbox did not have outbound network access from the container, so the live Natural Earth download step (`npm run build:geo`) could not be executed here. The build script was syntax-checked and its source URLs/data transformations were statically validated. The production ZIP therefore does not falsely contain fabricated geographic assets; after `npm install`, run `npm run build:geo` to generate the real Natural Earth assets.
