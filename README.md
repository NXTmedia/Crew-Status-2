# Crew Status 2

An offline-ready dashboard for viewing station crewing levels, personal availability, and Wednesday-to-Tuesday roster forecasts.

## Local development

Prerequisites: Node.js 20 or newer.

```bash
npm install
npm run dev
```

The local preview is served by Vite. No API key or environment file is required.

## Production build

```bash
npm run build
npm test
```

The production site is generated in `dist/`.

## Offline behaviour

- The application shell, icons, JavaScript, and CSS are precached after the first successful visit.
- The most recent validated roster CSV is saved locally and rendered before a network refresh is attempted.
- Validated current and upcoming roster weeks are retained so the on-call view can be recalculated as time advances.
- The following Wednesday-to-Tuesday roster becomes available on Tuesday, once its worksheet date headers match the requested week.
- When connectivity returns, the app refreshes the saved roster automatically.

At least one successful online visit is required before roster data can be shown offline.

## Netlify

The included `netlify.toml` configures Netlify to run `npm run build` and publish `dist/`. Import the GitHub repository into Netlify; no environment variables are required.

## Tests

`npm test` builds the production PWA and runs the offline, roster-boundary, and UI regression suites.
