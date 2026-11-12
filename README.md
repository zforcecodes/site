# ZFORCE Sportz

A responsive, single-page sports gear site featuring an interactive Three.js cricket ball showcase, three currently available ball types, a coming-soon section for tennis balls and shoes, and an email enquiry form.

## Run locally

Requires Node.js 20.19+ or 22.12+.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with `npm run build`.

The enquiry form opens the visitor's default email application with the message addressed to `zforcesportz@gmail.com`. It does not silently store or transmit visitor data; visitors must send the prepared email.

## Publish on GitHub Pages

The included Actions workflow builds and publishes this repository to GitHub Pages whenever changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

The Vite build uses `/site/` as its base path in GitHub Actions, for the `zforcecodes/site` repository.
