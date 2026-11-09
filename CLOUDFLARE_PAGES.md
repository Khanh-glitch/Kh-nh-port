# ORBITA — Deploy to Cloudflare Pages

This repository contains two distinct outputs:
- **`/index.html` at repository root:** the integrated, deployable ORBITA standalone site, including Colossus V3, Ragnarok weather, Grand Piano Reality Rewrite and VNG Gallery.
- **`/source/`:** editable Vite/React code. Do **not** set Cloudflare Pages' root to `source` or run `npm run build` there for this deployment: that would build a different artifact from the tested integrated root HTML.

## First deployment (GitHub → Pages)

1. Sign in to [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git / Import existing Git repository**.
2. Authorize GitHub and select **`Khanh-glitch/Kh-nh-port`**.
3. Set the following values **exactly**:

| Cloudflare field | Value |
|---|---|
| Production branch | `main` |
| Framework preset | `None` (or no framework) |
| Root directory (advanced) | Leave blank — repository root |
| Build command | `node scripts/build-pages.mjs` |
| Build output directory | `dist-pages` |
| Environment variables | None required |

4. Select **Save and Deploy**. Cloudflare allocates your site's **`<your-project-name>.pages.dev`** URL after the first successful deployment. Do not assume the name is free or that the domain exists before Cloudflare shows it.

## Existing Pages project

Go to its **Settings → Builds and deployments / Build configuration**, set the same command and output directory, verify production branch `main`, and trigger **Retry deployment** or push a new commit. Do not switch a Cloudflare *Worker* project to a Pages configuration.

## Why this uses a Node build command rather than Vite

The custom build step has **zero npm dependencies**: it validates the integrated `/index.html`, rejects untransformed Vite-only `import.meta.glob`, and creates `dist-pages/index.html` plus public 3D assets, root media and files from `source/public`. It does not replace any of the 3D experiences. Reference ZIPs and development files are excluded from public output.

The website's ESM/Three.js runtime uses external JavaScript CDNs, and Google Fonts also require Internet from the visitor's browser.

## Checks / troubleshooting

- `node scripts/build-pages.mjs` locally should print `Build output: dist-pages`; verify `dist-pages/index.html` exists.
- **404 on pages.dev**: output directory must be `dist-pages`, **not** `source/dist` or `/`.
- **Build command not found**: root directory was likely set to `source`. Clear it.
- **Site loads but 3D is blank**: inspect browser DevTools → Console/Network for blocked `esm.sh` imports or WebGL errors; these are client-runtime issues, not necessarily a Pages build failure.
- **Old Colossus / missing Piano / VNG**: ensure deployment used the root `index.html` and the latest `main` commit, not a Vite rebuild of the development folder.
- **Real songs/videos missing**: production rights and source media are not included yet; those remain placeholders until user media are supplied.

Official references: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/ and https://developers.cloudflare.com/pages/configuration/git-integration/.
