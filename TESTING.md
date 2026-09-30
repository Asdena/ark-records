# Validation — 30 September 2026 (UTC)

## Passed

- JavaScript syntax checks for application modules.
- 9 Node unit/integration tests (`npm test`): record validation and broad search;
  English/Indonesian intents and ambiguous names; concurrent immutable revisions;
  backup structure/media references; unsafe URL/media rejection; CRUD across new
  Drive client instances; social persistence; media round trip; deletion/cleanup;
  stale-session errors; failed uploads; missing media.
- DOM integration (`npm ci && npm run test:ui`): locked initial screen, simulated
  Google connection, add person, social account, searching, assistant result,
  script injection escaping, language switching, logout, disabled backup while
  disconnected. No test data is bundled into the application UI.

These tests use an in-memory fake HTTP implementation of the Drive API. They prove
application behavior against that contract, NOT successful real Google OAuth or
Drive access. The fake only exists under tests; the production app calls Google.

## Not yet verified

- Google OAuth consent/CSP behavior on your actual GitHub Pages origin.
- Real account persistence, cross-device reads, real uploads, quotas and network loss.
- Full backup export/import against a real Drive account with images/video.
- Browser visual QA, touch layout, camera permissions and media codecs on your phone.
  DOM tests have no layout engine, so they cannot verify appearance.
- Optional WebMCP registration in a supporting browser.
- GitHub Pages deployment: you requested to create the repo and push yourself.

## First-run acceptance checklist

Use an unimportant test record before entering real personal information.

1. Configure Google OAuth, restrict Testing to your account, publish on GitHub Pages.
2. Connect, create Sarah with likes Coffee and Instagram @sarah plus profile URL.
3. Upload a small JPG; make it profile photo. Add a short MP4, caption and memory.
4. Save, reload the page, reconnect. Verify all fields and media remain.
5. Open the same link on your phone, connect the same Google account/Client ID.
6. Search coffee; ask "Who likes coffee?" and "Show Sarah's Instagram."
7. Switch language, light/dark theme; open social URL and play video.
8. Edit Sarah from one device, then reload on the other. For simultaneous edits,
   verify both conflicting revisions remain available for explicit selection.
9. Download a backup. Import it and verify a NEW Sarah copy, image and video.
   Do not delete your original data just to test restoration.
10. Delete the test copy, close other devices, run cleanup; verify original remains.
11. Sign out; verify records are hidden. In a private browser window the page alone
    must not expose records. Attempt another Google account: Testing must reject it.
12. Deny OAuth access and disconnect internet while saving: no false success message.

## Known boundaries

Whole media are uploaded in one request (up to 50 MB); video loaded on demand.
Backups are JSON with base64 originals, max 100 MB; this is a browser-memory cap,
not 15 GB Drive support for one export. Thumbnails are recreated after import.
Photo originals aren't recompressed; only thumbnail copies are resized.

A cleanup requires all other editors closed and no unsaved drafts: it permanently
removes unreferenced media and old revisions. Do not run it concurrently with edits.
Delete writes a stripped tombstone, so after cleanup the deleted person's content
is gone but the ID/timestamps remain to prevent an older revision resurfacing.
Import is additive, not atomic across people. A failed partial import is reported;
review duplicates before repeating. No biometric/PIN or offline cache is included.
