# V4.0.1

- Fixed production Content-Security-Policy blocking of the globe application by moving the inline application script to `/public/app.js`.
- Keeps CSP `script-src` strict without `unsafe-inline`.

# V4.0.0

- Combined the V3.1.3 3D globe with the V3.4 global timezone engine.
- Introduced one canonical Location contract using latitude/longitude + IANA timezone.
- Search now drives globe rotation, marker position, selected clock and UI from the same object.
- Removed hardcoded Delhi startup state.
- Added browser timezone startup resolution and optional one-time geolocation refinement.
- Added nearest-place spatial lookup on the server to avoid scanning the full place index for each GPS request.
- Added timezone-reference fallback that is explicitly labeled when exact city detection is unavailable.
- Added multi-part search matching across place/region/country fields.
- Kept the tested V3.1.3 motion, marker, 10m LOD and geographic boundary protections.
- Added hosting-aware startup, `PORT` support, rate limiting, security headers and health endpoint.
