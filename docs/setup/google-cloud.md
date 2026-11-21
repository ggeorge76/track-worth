# Google Cloud setup (OAuth + Drive API)

You need this once so that sign-in works. It takes about 10 minutes.

## 1. Create a project and enable the Drive API

1. Go to https://console.cloud.google.com/ and create a project, for example `trackworth`.
2. Open **APIs & Services → Library**, search for **Google Drive API** and click **Enable**.

## 2. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen** (shown as "Google Auth Platform" in newer consoles):

- User type: **External**.
- App name **TrackWorth**, plus support email and developer contact.
- **App domain links** (served by GitHub Pages from `site/`, see `site/README.md`):
  - Home page: `https://ggeorge76.github.io/track-worth/`
  - Privacy policy: `https://ggeorge76.github.io/track-worth/privacy/`
  - Terms of service: `https://ggeorge76.github.io/track-worth/terms/`
- **Authorized domains:** `ggeorge76.github.io`.
- **App logo (optional):** `assets/branding/trackworth-logo-120.png` (120×120 px, about 20 KB).
  Uploading a logo triggers Google's _brand verification_, which requires proving you own
  `ggeorge76.github.io` in [Google Search Console](https://search.google.com/search-console)
  (add a URL-prefix property for `https://ggeorge76.github.io/track-worth/` and verify it with
  the HTML-file method by putting the file in `site/`). You can skip the logo and add it later.
- **Data access / Scopes:** add `openid`, `.../auth/userinfo.profile`, `.../auth/userinfo.email`
  and `.../auth/drive.file`. All of these are non-sensitive, so no Google verification or
  security assessment is needed (ADR-0004).
- **Audience:** while in **Testing**, add your Google account (and any testers) as test users.
  Refresh tokens for apps in Testing **expire after 7 days**, so you'll be asked to sign in again
  weekly. Publish to **Production** to avoid that. With only non-sensitive scopes, this doesn't
  require verification.

## 3. Create the OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- Application type: **Desktop app**
- Name: `TrackWorth desktop`

No redirect URIs are needed. Desktop clients automatically allow the loopback address
(`http://127.0.0.1:<any port>`) that the app uses.

Copy the **Client ID** and **Client secret**. For Desktop clients, Google states the secret
isn't confidential: it ships inside every copy of the app, and PKCE protects the sign-in. Still,
keep both out of the repo so forks use their own client.

## 4. Configure the app

**Locally:**

```bash
cp .env.example .env.local
# set TRACKWORTH_GOOGLE_CLIENT_ID and TRACKWORTH_GOOGLE_CLIENT_SECRET
bun run app:dev
```

`src-tauri/build.rs` compiles these into the app. After changing them, the next `app:dev` or
`app:build` picks them up automatically.

**For releases:** add both as **repository secrets** (Settings → Secrets and variables →
Actions → Secrets): `TRACKWORTH_GOOGLE_CLIENT_ID` and `TRACKWORTH_GOOGLE_CLIENT_SECRET`. See
[releasing.md](releasing.md).

## Android (later)

Android needs its own OAuth client type (package name + SHA-1 of the signing key) when that
work starts (ADR-0009).
