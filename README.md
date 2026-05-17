# Concord Kung Fu Academy Static Site

Static Cloudflare Pages rebuild of `www.concordkungfu.com` from the captured JSON files in this repository.

## Build

```sh
npm run build
```

The build writes the website to `dist/`.

## Verify

```sh
npm run verify
```

The verifier checks that the default landing page exists, every captured page is generated, local links resolve, required assets exist, and every image URL captured in the JSON docs is represented in the generated HTML.

## Cloudflare Pages

Use these build settings for the connected GitHub repository:

- Build command: `npm run build`
- Build output directory: `dist`
- Production branch: `main`
