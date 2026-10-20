# react-autoql docs site

The public documentation for react-autoql, built with [Docusaurus](https://docusaurus.io/) and published to GitHub Pages from `master` (see `.github/workflows/docs.yml`).

## Run it locally

Needs Node 18 or newer (`.nvmrc` pins 20). The library itself is unaffected.

```bash
cd docs
npm install
npm start
```

## How the prop tables work

`npm start` and `npm run build` first run `scripts/generate-props.mjs`. It reads each documented component's `propTypes` and `defaultProps` with [react-docgen](https://react-docgen.dev/) and writes `src/data/props/<Component>.json`, which `<PropsTable component="..." />` renders.

- Describe a prop with a `/** */` comment directly above it in `propTypes`. `//` comments are not read.
- Hide a prop from the docs with `/** @internal */`. It keeps working; it just isn't advertised.
- The documented components are listed in `DOCUMENTED_COMPONENTS` in the script.
