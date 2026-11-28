# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). From the first release on, this file is maintained
by release-please from Conventional Commit messages. Don't edit released sections by hand.

## [0.1.2](https://github.com/ggeorge76/track-worth/compare/v0.1.1...v0.1.2) (2026-11-28)


### Bug Fixes

* **auth:** say when Google refuses Android sign-in instead of "cancelled" ([961c19c](https://github.com/ggeorge76/track-worth/commit/961c19c1964c26265ab2c6f7353168f98f4dd986))
* **auth:** say when Google refuses Android sign-in instead of "cancelled" ([f7b102a](https://github.com/ggeorge76/track-worth/commit/f7b102a7b530ff3c568baf5b3383d1e7a0a67613))

## [0.1.1](https://github.com/ggeorge76/track-worth/compare/v0.1.0...v0.1.1) (2026-11-26)


### Features

* **accounts:** "Update all" screen to update every balance at once ([49be125](https://github.com/ggeorge76/track-worth/commit/49be125a5cff5bb8e4a0a2fa269885f09ecc4537))
* **accounts:** make the Update all link a small pill, not a big button ([1edbc42](https://github.com/ggeorge76/track-worth/commit/1edbc42077eceaf8ca4184675596a464abc395ed))


### Bug Fixes

* **accounts:** source chips instead of a datalist, emoji-aware name sort, remembered list view ([35a91d5](https://github.com/ggeorge76/track-worth/commit/35a91d5331f0f6b1223aebf26bca7625c7553bc8))
* **branding:** Android icon without the name; gradient "Worth" in the logo ([0c3edbc](https://github.com/ggeorge76/track-worth/commit/0c3edbc011b3b65f0c2ae501bc48d9d4bd5c6ac3))

## [0.1.0](https://github.com/ggeorge76/track-worth/releases/tag/v0.1.0) (2026-11-25)


### Features

* **accounts:** account details, update-balance popup, swipe navigation and settings ([d21e2ec](https://github.com/ggeorge76/track-worth/commit/d21e2ec5cec65f9f6962ab38147bc75ab8acf193))
* **accounts:** balance-over-time chart on account details ([339a847](https://github.com/ggeorge76/track-worth/commit/339a8475363e57a1eb90b32813f87033c91ff166))
* **accounts:** delete entries with undo, archive and delete accounts ([ef09800](https://github.com/ggeorge76/track-worth/commit/ef09800f51bf318ebef44e4ab0443d7f1519c498))
* **accounts:** liquidity filter starts all on; a click turns a level off ([d16117b](https://github.com/ggeorge76/track-worth/commit/d16117bfc055b430273f8562695c61e498e5bc38))
* **accounts:** optional opening balance on the create-account screen ([feb4b07](https://github.com/ggeorge76/track-worth/commit/feb4b07e85366e8b6250df897e7fe9af3975b3f5))
* **accounts:** show and edit account type on the details page ([bd47f06](https://github.com/ggeorge76/track-worth/commit/bd47f06dcc480af7e85b39575c20457aa46b10fe))
* **accounts:** start page, filter popup and create-account screen ([e003c4f](https://github.com/ggeorge76/track-worth/commit/e003c4f5a3f07672a2d230055d2e8bb817d13c58))
* **accounts:** visible edit buttons on the account details page ([dfadb68](https://github.com/ggeorge76/track-worth/commit/dfadb688ebe14b471c2179a6d38b3ec5733f33c8))
* **android:** generate the Android project and fit the UI to phone screens ([b4cfd12](https://github.com/ggeorge76/track-worth/commit/b4cfd124f1991a462a30d9d2f60fbe12160f929d))
* **android:** Google sign-in through Play services, with no stored tokens ([6036f28](https://github.com/ggeorge76/track-worth/commit/6036f2832a0eb0977f8f6e8a43b0220f4bc796d1))
* **android:** save exports with Android's "Save to…" picker; release signing ([903b1e3](https://github.com/ggeorge76/track-worth/commit/903b1e3b2794200def91b6eb1a49b7774b3c4275))
* **balances:** fill in the last balance when the date has none ([f9cb054](https://github.com/ggeorge76/track-worth/commit/f9cb0547c5bf2ccc33aac3e244f87cee84a93ce5))
* **balances:** fill in the saved balance for the chosen date ([b70a5c5](https://github.com/ggeorge76/track-worth/commit/b70a5c5990445e92828128f07522dc31b514bf62))
* **dashboard:** net worth over time with change and FY start line ([cf4ba92](https://github.com/ggeorge76/track-worth/commit/cf4ba92bc8fa7c56c1113b40d6af693a2172d83a))
* **dashboard:** net worth, chart and totals follow the account filter ([2485478](https://github.com/ggeorge76/track-worth/commit/24854784761f7863dac27eede0451879d19877c4))
* **data:** data format v2, account/balance operations and conflict-safe saving ([065cf8b](https://github.com/ggeorge76/track-worth/commit/065cf8bb4ea66269af960f9d7322006ce99aebfc))
* **data:** data format v2, account/balance operations and conflict-safe saving ([#2](https://github.com/ggeorge76/track-worth/issues/2)) ([f38baa7](https://github.com/ggeorge76/track-worth/commit/f38baa75ae205832164857482299739416e89df7))
* **domain:** delete/restore balances, archive and delete accounts ([b86f2ec](https://github.com/ggeorge76/track-worth/commit/b86f2ec48aee49dd435f048770eeb4c5ed500b7d))
* **fx:** base currency, conversion with Frankfurter rates, and a Currencies page ([eb0da37](https://github.com/ggeorge76/track-worth/commit/eb0da37b7d0d4caa457969940a51ea4111745128))
* **fx:** convert from any listed currency on the Currencies page ([2331780](https://github.com/ggeorge76/track-worth/commit/2331780ba6b7101faad8efe48fac8f12d2563bb4))
* **header:** account menu with avatar, Settings and Sign out ([2217bd5](https://github.com/ggeorge76/track-worth/commit/2217bd5fa4e5b9777ce0cbf45a7f01b91db2eb31))
* **history:** earlier net-worth history on the chart, with a dev-only CSV import ([b3da055](https://github.com/ggeorge76/track-worth/commit/b3da0552b9071be83ee299f406edd9b8a6a2b98c))
* **insights:** breakdown by tag and liquidity on an Insights page ([d5952c9](https://github.com/ggeorge76/track-worth/commit/d5952c9357a4bee628eaf428ef5b1857304a1073))
* **insights:** donut per section and a Tag | Liquidity switch ([79f0144](https://github.com/ggeorge76/track-worth/commit/79f0144294a1c7703afae73fd9108b46ed33ec70))
* **landing:** landing page before sign-in ([6b4ccae](https://github.com/ggeorge76/track-worth/commit/6b4ccae5507ac8b2d0fd55b1e24f21866c00611b))
* **nav:** main menu: header tabs on desktop, bottom tab bar on phones ([5486849](https://github.com/ggeorge76/track-worth/commit/5486849d44b2b6d9b83f69d850b091654d445631))
* **offline:** edit offline, upload later, and resolve conflicts ([99835f8](https://github.com/ggeorge76/track-worth/commit/99835f839ff6c7511158d64db83e3b36c5d7f2a1))
* **offline:** edit offline, upload later, and resolve conflicts (ADR-0015) ([e1db412](https://github.com/ggeorge76/track-worth/commit/e1db4121b95da52e42b79bb569b1dc00fbba2741))
* **offline:** view data and start the app without a connection ([365e6ff](https://github.com/ggeorge76/track-worth/commit/365e6ff77eb13713f1bad9d69ef8ae5b149b5cd4))
* scaffold TrackWorth desktop app for AI-agent development ([#1](https://github.com/ggeorge76/track-worth/issues/1)) ([d144e98](https://github.com/ggeorge76/track-worth/commit/d144e98104471c79cbeabae6129b728d04e514e7))
* **settings:** believable sample growth; hide the real profile while it shows ([c27ddb7](https://github.com/ggeorge76/track-worth/commit/c27ddb7765d002491190fc272fe4fd72d3849c90))
* **settings:** card layout with icons, export tiles and a clear file drop area ([1751d99](https://github.com/ggeorge76/track-worth/commit/1751d991b58a3a521c7214df7c88f7a187bfe523))
* **settings:** development-only sample data for screenshots ([36e31fc](https://github.com/ggeorge76/track-worth/commit/36e31fcdd26bc5e8e871fdb51d66d0f2b239afca))
* **settings:** development-only sample data with verified backup and restore ([95ea687](https://github.com/ggeorge76/track-worth/commit/95ea68727d6eb81206783df3507e8afbed8f0422))
* **settings:** export everything as JSON and balances as CSV ([d1e43a1](https://github.com/ggeorge76/track-worth/commit/d1e43a1e5c537a42f2a2d31d07842f183bd65798))
* **settings:** sample data on the real account, with verified backup and restore ([ee3a5ed](https://github.com/ggeorge76/track-worth/commit/ee3a5edfc3aa21b01f94108e665ff17f4421ed83))
* **settings:** view the imported net-worth history (dev builds) ([88a6adf](https://github.com/ggeorge76/track-worth/commit/88a6adf45b88ef7eec6c245e6511f577e28c15ea))
* **storage:** data store with per-file saves, local copy and v2 upgrade ([035af88](https://github.com/ggeorge76/track-worth/commit/035af884e095237c6b9ff1a153fb9355ba531b4f))
* **storage:** financial-year file periods, split/assemble and safe write order ([abd2a03](https://github.com/ggeorge76/track-worth/commit/abd2a034b8a769f7fd0a2192a4770e09ec636a6b))
* **storage:** split data into financial-year files with a local copy (ADR-0014) ([668c920](https://github.com/ggeorge76/track-worth/commit/668c920b31f6882be7d9712edf0a952eb65673ba))
* **sync:** offline-first sync engine with pending changes on the device ([6f2f85a](https://github.com/ggeorge76/track-worth/commit/6f2f85a0fc1f70da977d833747a4b2be6b00d026))
* **sync:** three-way merge for offline changes ([34ac4cd](https://github.com/ggeorge76/track-worth/commit/34ac4cdfa73b90b5b776e603e4d9d35f2b57c287))
* **ui:** brighter chart, donut and liquidity colours ([9527184](https://github.com/ggeorge76/track-worth/commit/952718467a1b3d88a83309373d03ce409d12b6d7))
* **ui:** brighter refresh, dark mode, and a net worth that stays in view ([699dff2](https://github.com/ggeorge76/track-worth/commit/699dff23ca8f4744e7fc6968751b777f1e4b5451))


### Bug Fixes

* **app:** let the page handle dropped files (dragDropEnabled: false) ([a241566](https://github.com/ggeorge76/track-worth/commit/a2415669eab4e7007f806d91ac81bdd60d3e5102))
* **auth:** read the keychain at most once per run ([409d330](https://github.com/ggeorge76/track-worth/commit/409d330d35c7130f2fda5da31d31d19bb9f5c7b5))
* **balances:** don't warn about replacing the entry being saved ([eb52ba2](https://github.com/ggeorge76/track-worth/commit/eb52ba24fde31e17bf2aea93b7eea4125e9afdf0))
* **balances:** fill in the saved balance for the chosen date; no false replace warning ([e491af2](https://github.com/ggeorge76/track-worth/commit/e491af265e1642f3399d4d3770d8e3b07ab54692))
* **dashboard:** drop the carry-forward note under the net-worth chart ([78bcab0](https://github.com/ggeorge76/track-worth/commit/78bcab0187517042a2bc47c79e77b6020770aa92))
* fewer keychain prompts; account menu in the header ([51f2d99](https://github.com/ggeorge76/track-worth/commit/51f2d993479bd38be848e6ad090e35eb003167b7))
* **settings:** show developer tools in debug builds, not only the dev server ([bceeffb](https://github.com/ggeorge76/track-worth/commit/bceeffba0a99b3c288784afad89e6ee84f618935))
* **ui:** animated account swipe, pages open at the top, currency flags and grouped amounts ([b5955d2](https://github.com/ggeorge76/track-worth/commit/b5955d23c4d1f01cce5ae7b53001fc5fad7b2385))
* **ui:** show the pointer cursor on all clickable elements ([a763d03](https://github.com/ggeorge76/track-worth/commit/a763d034540b46e018bedfd88e15ecb11883716a))
