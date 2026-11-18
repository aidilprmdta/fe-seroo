This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility. The current Expo Router routes live in `app/`; keep non-route code in `src/`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `app/` — every route file there is a screen, `_layout.js` files define navigators. Keep non-route code (components, hooks, utils) in `src/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Seroo product/security rules

- Read `docs/mobile/PRD.md`, `docs/mobile/API-CONTRACT.md`, and `docs/mobile/OPEN-DECISIONS.md` before implementing product behavior.
- Seroo uses individual Crew/Manager/Owner accounts. MVP account creation is Administrator-only. Manager account management of Crew is a future outlet-scoped permission, not an MVP screen/API unless explicitly authorized.
- Online-first limited offline support applies only to POS and waste using Expo SQLite. Do not store credentials/tokens in the local queue. Every operation must retain the same `clientTransactionId` and payload for retries; local queued status is not server success.
- QRIS recorded offline is `PENDING_RECONCILIATION`, never verified/settled. Transfer and stock adjustment require online connectivity on MVP.
- Follow the latest role session policy in `docs/mobile/OPEN-DECISIONS.md`; client timers are UX controls and do not replace backend enforcement.
- Product prices being global across outlets is an unconfirmed temporary assumption. Do not hardcode it as a final business rule.

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
