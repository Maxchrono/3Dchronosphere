# Chronosphere V4.0.1 — 3D Globe + Timezone Engine

This release combines the proven Chronosphere 3D globe as the visual base with the global GeoNames/IANA timezone engine.

## Core contract

`Search/Locate → Location → Globe + Time Engine + UI`

The single canonical object returned by the API is:

```ts
interface Location {
  id: string;
  name: string;
  type: string;
  region?: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
```

The globe consumes only `latitude`/`longitude`. The time engine consumes only the IANA `timezone`. The UI keeps the human place name separate from the timezone identifier.

## Startup location

1. The browser provides its configured IANA timezone through `Intl.DateTimeFormat().resolvedOptions().timeZone`.
2. Chronosphere uses that timezone to get a timezone reference location immediately.
3. The browser then requests one-time geolocation permission. When granted, the coordinates are resolved to the nearest indexed place in that timezone and the red marker/globe are updated.
4. When geolocation is denied or unavailable, the engine stays on the timezone reference and labels it as such instead of falsely claiming an exact city.

## Search behavior

Search is debounced, rate-limited, normalized and served by the Node API. Multi-part searches such as `Delhi India` and `Tokyo Japan` are matched across place, region and country fields. The result is returned as a canonical `Location` object.

Selecting a result performs all three operations from the same object:

- update the main time/date/offset information;
- move the red live marker to the exact returned coordinates;
- smoothly rotate the globe to the selected longitude/latitude.

The marker is never derived from the timezone name, so two cities sharing `Asia/Kolkata` still appear at their own geographic coordinates.

## Time correctness

The browser/runtime IANA timezone support computes current local time and UTC offset. No manual DST or fixed-offset table is used.

## Production behavior

The server:

- serves the globe assets and API from one origin;
- keeps the GeoNames index server-side;
- rate-limits search/localization endpoints;
- returns security headers;
- serves geo/vendor assets with immutable caching;
- supports gzip for text/JSON;
- accepts the hosting platform's `PORT` environment variable;
- exposes `/api/health` for deployment checks.

The 3D globe uses local `/public/geo` assets when built and only falls back to the pinned Natural Earth GitHub sources during development.

## Local setup

```text
npm install
npm run download:data
npm run build:index
npm run build:geo
npm start
```

`alternateNamesV2.zip` must be complete before `npm run build:index`. The generated GeoNames files are runtime data and should not be downloaded per visitor.

## Hosting

Use a Node.js web service. Set the start command to `npm start`. The platform supplies `PORT` automatically. For repeatable production deployments, generate/import the GeoNames index and build the local map assets during the deployment build step, then start the server.

Geolocation requires a secure context (HTTPS) in production.
