# Production vendor assets

Run `npm install` followed by `npm run prepare:vendor` to copy pinned Three.js and TopoJSON client builds here.

The application falls back to the pinned CDN URLs only when local vendor assets are unavailable, which keeps development convenient without making the final architecture depend on a CDN.
