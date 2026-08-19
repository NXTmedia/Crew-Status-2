<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Itgwob3jnklCGp1snQWvYMpesKdNqEcj

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Offline behaviour

- The application shell, icons, JavaScript, and CSS are precached after the first successful visit.
- The most recent roster CSV is saved locally and rendered before a network refresh is attempted.
- Current and upcoming roster weeks are retained so the on-call view can be recalculated as time advances.
- When connectivity returns, the app refreshes the saved roster automatically.

At least one successful online visit is required before roster data can be shown offline.

## Tests

Run the production build and offline test suite with:

`npm test`

The tests verify cache-only roster rendering, hourly on-call recalculation, offline fallback without network requests, missing-cache behaviour, application-shell precaching, and removal of internet-hosted UI dependencies.
