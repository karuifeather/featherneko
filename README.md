# FeatherNeko 👋

From **Karuifeather** — same family as Featherly and FeatherPad and FeatherLane.

**What it is** — A mobile anime app for discovering, tracking, and streaming anime episodes.

**What it does** — Lets you build a watchlist, track progress, pick up where you left off, and stream episodes. Data from AniList, MyAnimeList, and Kitsu.

**Who it's for** — Anime fans who want their watchlist, progress, and episodes in one place.

I had this project sitting in my drive for years. Finally got around to publishing it.

---

**Access:** A password is required. Contact [karuifeather.com](https://karuifeather.com) for the app password.

## Get started

1. `yarn install`
2. Copy `.env.example` to `.env` and fill in required values
3. `yarn start`

## Local build (APK)

**Prerequisites:** Java 17, Android SDK. The build script looks for `JAVA_HOME` or Java 17 in `/usr/lib/jvm/`. `ANDROID_HOME` defaults to `~/Android/Sdk`.

1. `yarn install`
2. Copy `.env.example` to `.env`; set `MAL_CLIENT_ID`, `PASSWORD_HASH`, `ANIMEAPI_URL`
3. `npx expo prebuild --platform android --no-install` (once, or when native config/plugins change)
4. `yarn build:android`

Output: `featherneko.apk` at repo root.

**Gotchas:** "Error resolving plugin" → use Java 17 and set `JAVA_HOME`. Re-run prebuild if you change `app.config.js` or Expo plugins. `android/` and `ios/` are gitignored — they exist only after prebuild.
