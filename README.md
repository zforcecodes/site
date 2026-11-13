# ZFORCE Sportz

A responsive, sketchbook-inspired 3D shop featuring three interactive, procedurally textured Three.js cricket balls. The product showcase uses the renderer in `src/zforce-ball.js`, including its leather grain, recessed seam, stitched thread, ZFORCE badge, studio reflections, and bounce animation.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with `npm run build`.

Selecting a ball updates its product details and enquiry link. The contact form opens the visitor's default email application with the message addressed to `zforcesportz@gmail.com`. It does not silently store or transmit visitor data; visitors must send the prepared email.

The hero mounts `src/zforce-ball.js` on the `#ball-stage` element. Three.js is bundled with the application, not loaded from a third-party CDN. The renderer creates red, white, and pink balls with procedural leather and stitching textures; selecting a lineup item tosses its ball, and clicking a ball spins it.

The stadium and pitch artwork is an original local 2D vector illustration used as the 3D ball showcase backdrop. The header and footer use a close crop of the supplied ZFORCE logo, while the cricket balls retain their existing badge artwork.

## Publish on GitHub Pages

The included Actions workflow builds and publishes this repository to GitHub Pages whenever changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

The Vite build uses `/site/` as its base path in GitHub Actions, for the `zforcecodes/site` repository.
