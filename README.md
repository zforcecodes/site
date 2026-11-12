# ZFORCE Sportz

A responsive, Matchball-inspired sports gear site featuring three interactive, procedurally textured Three.js cricket balls. The ball showcase uses the renderer in `src/zforce-ball.js`, including its leather grain, recessed seam, stitched thread, stamped ZFORCE crest, studio reflections, and bounce animation.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with `npm run build`.

The enquiry form opens the visitor's default email application with the message addressed to `zforcesportz@gmail.com`. It does not silently store or transmit visitor data; visitors must send the prepared email.

The hero mounts `src/zforce-ball.js` on the `#ball-stage` element. Three.js is bundled with the application, not loaded from a third-party CDN. The renderer creates red, white, and pink balls with procedural leather and stitching textures; selecting a lineup item tosses its ball, and clicking a ball spins it.

## Publish on GitHub Pages

The included Actions workflow builds and publishes this repository to GitHub Pages whenever changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

The Vite build uses `/site/` as its base path in GitHub Actions, for the `zforcecodes/site` repository.
