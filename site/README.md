# Public website (GitHub Pages)

Homepage, privacy policy and terms of service, as plain static HTML. They are linked from the
Google OAuth consent screen, so **the privacy policy must stay accurate**. Update it in the same
PR as any change to the data the app accesses: OAuth scopes, what's stored where, new network
destinations.

| Page           | URL                                              |
| -------------- | ------------------------------------------------ |
| Homepage       | https://ggeorge76.github.io/track-worth/         |
| Privacy Policy | https://ggeorge76.github.io/track-worth/privacy/ |
| Terms          | https://ggeorge76.github.io/track-worth/terms/   |

GitHub Pages serves the `gh-pages` branch. To publish changes to `site/`:

```bash
git worktree add /tmp/gh-pages gh-pages
cp -R site/. /tmp/gh-pages/ && rm /tmp/gh-pages/README.md
cd /tmp/gh-pages && git add -A && git commit -m "docs(site): update" && git push
cd - && git worktree remove /tmp/gh-pages
```
