# Chronosphere V4.0.1 — 3D Globe + Global Timezone Engine

Chronosphere V4 combines the tested 3D globe foundation with the global GeoNames place search/timezone engine.

## What is connected

```text
Search / User location
        ↓
   Canonical Location
        ↓
 ┌──────┴─────────┐
 ↓                ↓
3D Globe       Time Engine
lat/lon        IANA timezone
 ↓                ↓
Marker +     Live local time,
rotation     date + UTC offset
 └──────┬─────────┘
        ↓
       UI
```

The UI uses the globe as the visual base. The selected place name remains separate from the timezone name.

## V4 behavior

- Searching a place rotates the globe to that place and moves the red live marker to its coordinates.
- The startup marker is no longer hardcoded to Delhi.
- The browser's configured IANA timezone is resolved first so the app can start without waiting for GPS.
- One-time browser geolocation can refine the startup location to the nearest indexed place. This requires user permission and HTTPS on hosted sites.
- When geolocation is unavailable or denied, the UI explicitly labels the result as a timezone reference instead of claiming an exact city.
- Search supports multi-part queries such as `Delhi India` and alias searches such as `Calcutta` → Kolkata when the GeoNames alternate-name index contains the alias.
- The same canonical `Location` object drives the globe, marker, selected clock and UI.
- The globe continues to use the V3.1.3 motion/inertia/LOD protections.
- Natural Earth 50m/10m local map assets remain the production path; CDN fallback is development-only.
- The server accepts a hosting provider's `PORT` variable, applies rate limits/security headers, serves gzip where appropriate, and exposes `/api/health`.

## Data model

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

GeoNames is used for geographic place data and aliases. IANA timezone rules are used by the runtime for actual local time/offset behavior. The app does not maintain a manual city → fixed UTC offset table or manually calculate DST.

## Local development

From the project root:

```text
npm install
npm run download:data
npm run build:index
npm run build:geo
npm start
```

Then open `http://localhost:3000`.

`alternateNamesV2.zip` must be a complete archive before `npm run build:index`. Do not repeatedly re-download it if you have already downloaded it successfully.

## Production hosting

Use a Node.js web service. Start command:

```text
npm start
```

The server reads the `PORT` environment variable supplied by the host.

For a repeatable production deployment, run the data import and map build during the deploy/build phase, then start the server. Visitors do not download GeoNames files and do not run npm commands.

The final production instance should contain:

```text
/data/index/places.json
/public/geo/world-50m.topojson
/public/geo/world-10m.topojson
/public/geo/disputed-boundaries-10m.topojson
/public/vendor/three.min.js
/public/vendor/topojson-client.min.js
```

## Privacy / location detection

The exact physical city cannot be inferred from an IANA browser timezone alone. Chronosphere therefore uses timezone detection immediately and optionally asks for browser geolocation to refine the city. The server receives coordinates only when the browser grants permission.

## Tests

```text
npm test
```

The V4 test suite covers globe coordinate convention, motion stability, the canonical location contract, multi-part search, aliases, timezone-reference localization, GPS nearest-place localization, and production health/version behavior.
