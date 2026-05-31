# Budgetra Progressive SaaS Architecture

This project stays a static HTML, CSS, and JavaScript app deployed on Vercel. The migration strategy is additive: keep the existing dashboard working, then move behavior into modules in small slices.

## Current Safe Structure

```text
src/
  ai/             Local free AI insight and assistant modules
  components/     Reusable UI/template factories and current app shell
  config/         App and Tailwind configuration
  firebase/       Shared Firebase app/config setup
  layouts/        Future page layout factories
  pages/          Future page renderers
  scripts/        Existing classic app scripts during migration
  services/       Auth, database, analytics, organization, notifications
  styles/         Existing CSS plus SaaS enhancement CSS
  utils/          Storage, currency, dates, pure helpers
```

## What Remains Unchanged

- `index.html`, `auth.html`, and `vercel.json` remain the deployed entry points.
- Firebase project credentials stay the same.
- Existing localStorage keys stay the same: `exp_tracker_v3`, `exp_user`, `exp_theme`, and `sb_data`.
- Existing dashboard behavior remains in `src/scripts/app.js` while it is migrated gradually.

## What Was Modernized First

- Firebase config moved to `src/firebase/config.js`.
- Auth behavior now goes through `src/services/auth-service.js`.
- Dashboard Firebase startup imports the shared config.
- Local AI insights were added without external paid APIs.
- Tailwind CDN was added with preflight disabled, so existing CSS is not reset.
- SaaS-ready services were added for analytics, notifications, organizations, roles, and database access.

## Safe Migration Steps

1. Move one feature at a time out of `src/scripts/app.js`.
2. For each feature, create a service in `src/services/` for data rules.
3. Create a component in `src/components/` for UI rendering.
4. Keep old function names as thin wrappers until all inline handlers are removed.
5. Convert `app.js` to `type="module"` only after inline `onclick` and generated global handlers are gone.
6. When moving to React or Next.js, reuse `services/`, `firebase/`, `utils/`, and `ai/` directly.

## Recharts Note

Recharts is a React charting library. The current vanilla app should keep its existing chart behavior until the dashboard shell moves to React. `src/services/chart-service.js` is the adapter layer for that future swap.

## Free AI Strategy

The current AI assistant is local and free. It does not send user financial data to any external API. A future provider can be added behind `src/ai/assistant.js` if you later choose a free-tier API and move secrets to a backend/serverless function.
