# Google Play listing (draft)

Store text and Play Console form answers for **TrackWorth** (`com.trackworth.app`). Keep the
claims in step with what the app does today (same rule as the landing page). Character limits
are Play's.

## Main store listing

**App name** (max 30): `TrackWorth: Net Worth Tracker` (29)

**Short description** (max 80):
`Track your net worth by hand. Your data stays in your own Google Drive.` (71)

**Full description** (max 4000):

```
TrackWorth is a calm, private way to watch your net worth.

Once in a while, you note what each account holds: savings, investments, property, loans,
credit cards. TrackWorth shows the total and how it changes over time. Typing a balance makes
you look at it; that's the point.

YOUR DATA, IN YOUR DRIVE
• Everything is saved as readable files in a TrackWorth folder in your own Google Drive.
• The app can only see the files it creates: nothing else in your Drive.
• There is no TrackWorth server and no TrackWorth account. The developer never sees your data.

NEVER CONNECTED TO YOUR BANK
• No bank logins, no aggregators, no screen-scraping. You enter balances yourself.

SEE THE TREND
• Net worth over time: 1 month, 6 months, 1 year, or everything, with your financial year
  marked.
• Each account's balance history, with changes since last time, last month and the financial
  year.
• Insights: where your money is, by tag or by liquidity.
• Assets and liabilities side by side; loans and cards shown as what you owe.

MANY CURRENCIES
• Choose a base currency; other currencies are converted with published central-bank
  reference rates.
• Past values use the rate of their month. You can set your own rate any time.
• A converter for quick sums.

WORKS OFFLINE
• Keep updating balances without a connection; changes upload when you're back online.
• If two devices changed the same thing, you choose which to keep. Nothing is overwritten
  silently.

ALSO
• Light, dark, or follow your phone.
• Export everything as JSON, or balances as CSV for a spreadsheet.
• Archive accounts you've closed, without losing their history.
• Also on desktop (macOS, Windows, Linux), with the same data.

PRIVATE BY DESIGN
No ads, no analytics, no tracking, no data selling. Free and open source:
https://github.com/ggeorge76/track-worth
```

**App category**: Finance. **Tags** (chosen from Play's list in the console, up to 5): the
closest to "Personal finance" and "Money tracker". Avoid budgeting or banking tags; the app
does neither.

**Contact details**: email (required, shown publicly): _owner to decide which address_.
Website: `https://ggeorge76.github.io/track-worth/`. Privacy policy:
`https://ggeorge76.github.io/track-worth/privacy/`.

## Graphics checklist

| Asset             | Spec                               | Source                                                                                                                                                      |
| ----------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App icon          | 512×512 PNG, 32-bit                | `assets/branding/` symbol (export at 512)                                                                                                                   |
| Feature graphic   | 1024×500 PNG/JPG, no transparency  | to make: navy background, symbol + "TrackWorth", tagline "Your net worth, in your own Drive"                                                                |
| Phone screenshots | 2–8, 16:9 or 9:16, min 320 px side | from the phone (`adb exec-out screencap`): start page with chart, account details, Insights, Currencies, dark mode. **Use made-up data**, not real balances |

## Play Console forms: draft answers (owner to confirm)

**App access**: all features need a Google account sign-in. Reviewers can sign in with
any Google account; there is no paywall or extra login. Provide these instructions: "Tap Sign
In, choose any Google account and allow access to the files TrackWorth creates. Add an account
with the + button to see charts."

**Ads**: No, the app contains no ads.

**Content rating** (IARC questionnaire): category _Utility, productivity, communication or
other_; no violence, sexuality, gambling, profanity, controlled substances; no user-to-user
interaction or sharing of content; no purchases. Expected: Everyone / PEGI 3.

**Target audience**: 18 and over (finance app; not designed for children).

**News app**: No. **COVID-19 contact tracing**: No. **Government app**: No.

**Financial features** declaration: the app provides **none** of the listed regulated
features (no banking, loans, payments, crypto wallets, trading or investment advice). It is a
personal finance _tracking_ tool where users enter their own figures. Select the "My app
doesn't provide any financial features" option if offered, otherwise "Personal finance:
budgeting / tracking" without transactions.

**Data safety**: conservative and honest. Data the user enters is sent off the device to
their own Google Drive, so we declare it as collected even though the developer never
receives it:

| Data type                                                                 | Collected | Shared | Purpose                                  | Optional |
| ------------------------------------------------------------------------- | --------- | ------ | ---------------------------------------- | -------- |
| Personal info → Name                                                      | Yes       | No     | App functionality (show who's signed in) | No       |
| Personal info → Email address                                             | Yes       | No     | App functionality, Account management    | No       |
| Personal info → (profile photo) _not a Play category; covered by Name_    | n/a       |        |                                          |          |
| Financial info → Other financial info (balances, account names you enter) | Yes       | No     | App functionality                        | No       |

- Is all user data **encrypted in transit**? **Yes** (HTTPS only).
- Can users **request deletion**? **Yes**: delete the TrackWorth folder in Google Drive; sign out
  to remove the device copy; revoke at myaccount.google.com/permissions. (Play asks for a
  deletion URL or instructions: point to the privacy policy, section "Retention and deletion".)
- **Not** collected: location, contacts, photos/videos, files beyond the app's own,
  app activity, web history, device IDs, diagnostics, crash logs.
- Exchange-rate requests (Frankfurter) send only currency codes and dates: not user data.

**Permissions** the app requests on Android: Internet only (Google sign-in via Play services,
Drive, exchange rates). The "Save to…" export uses the system document picker, so there are no
storage permissions.

## Before production

- Add the **Play App Signing SHA-1** to the Android OAuth client (see
  `docs/setup/android.md`).
- Closed test: 12 testers opted in for 14 consecutive days (personal developer accounts).
- Update the landing page ("Android coming soon") once the app is live.
