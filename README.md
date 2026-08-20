# Crew Status 2

An offline-ready dashboard for viewing station crewing levels, personal availability, and Wednesday-to-Tuesday roster forecasts.

Current release: **v2.3.0**

## Features

- Crew view with personal on-call status and a 24-hour availability timeline.
- Station Board with grouped active crew, a tap-only boats-ready trend for the next 24 hours, a selectable 24-hour forecast, and a Wednesday-to-Tuesday seven-day overview.
- Trend details show the crew additions needed to move an amber hour to green or a red hour to amber.
- Crew counts displayed directly in forecast boxes.
- Installable PWA with saved roster data available offline after the first successful online load.

## Roster week and clock changes

- Each worksheet represents a fixed Wednesday-to-Tuesday week containing 168 hourly slots.
- The following week's personal availability remains hidden until Tuesday and is used only after its worksheet dates have been validated.
- Spreadsheet days always map to 24 fixed wall-clock slots (`00` through `23`), including the Sundays when UK clocks change.
- When clocks go forward, the non-existent `01` slot is never marked as the current hour. When clocks go back, both occurrences of `01` use the same spreadsheet slot because the worksheet does not contain a 25th hour.

## Refresh behaviour

The roster is refreshed when the current view opens, the refresh button is pressed, connectivity returns, the app becomes visible or focused, a crew name is saved, or the aligned 15-minute refresh interval is reached.

Only one roster update runs at a time. Extra triggers are collapsed into the latest pending refresh, which runs after the active request finishes. An active request is cancelled when its dashboard unmounts.

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

`npm test` builds the production PWA and runs the offline, roster-boundary, daylight-saving, refresh-queue, and UI regression suites.

## Versioning

`package.json` is the source of truth for the application version. The Settings modal reads this value directly so the displayed version and package release cannot drift apart.
