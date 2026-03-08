# FeatherNeko 👋

From **Karuifeather** — same family as Featherly and FeatherPad and FeatherLane.

**What it is** — A mobile anime app for discovering, tracking, and streaming anime episodes.

**What it does** — Lets you build a watchlist, track progress, pick up where you left off, and stream episodes. Data from AniList, MyAnimeList, and Kitsu.

**Who it's for** — Anime fans who want their watchlist, progress, and episodes in one place.

---

**Access:** A password is required. Contact [karuifeather.com](https://karuifeather.com) for the app password.

## Get started

1. `yarn install`
2. Copy `.env.example` to `.env` and fill in required values
3. `yarn start`

## Production (Local APK)

1. Set `MAL_CLIENT_ID`, `PASSWORD_HASH`, `ANIMEAPI_URL` in `.env`
2. `npx expo prebuild --platform android --no-install` (once, or when native config changes)
3. `yarn build:android` → outputs `featherneko.apk`

Requires Java 17 and Android SDK.
