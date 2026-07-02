---
"@hudsonkit/ai": patch
---

Realign the package version with the npm registry. 0.2.1 was published out-of-band without committing the bump back to the repo, leaving the checked-in version at 0.1.1 — publishing from CI would have regressed the `latest` dist-tag. This rolls the repo forward past the published version and ships the accumulated unreleased changes.
