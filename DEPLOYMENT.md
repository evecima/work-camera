# Work Camera V3 — Deploy and iPhone acceptance checklist

## Deployment

Work Camera is hosted separately from Apartment Finder at:
https://evecima.github.io/work-camera/

The GitHub repository is `evecima/work-camera`, and GitHub Pages publishes `main` / root. Never modify or redeploy `evecima/gb-af-tool` while updating this project.

No Azure, OneDrive or Apple Developer configuration is required for the local-only release.

## iPhone setup

1. Open the public URL using **Safari** on the iPhone.
2. Use the Share menu to **Add to Home Screen**. Keep exactly one icon named **Work Camera**.
3. Open the installed app and check that Home shows **Take Photo** and **My Photos**.
4. Select a harmless test location and take a test photo with the in-app camera. Check the photo in **My Photos** under that location.
5. Put the phone into Airplane Mode and reopen the installed app. Test browsing the library and (where permitted) camera capture offline. The browser may need an initial online load for service-worker installation.
6. In **Weekly Backup** press **Prepare ZIP**, then **Save / Share ZIP**. Choose the local destination explicitly (prefer **On My iPhone** or a local external drive, not iCloud Drive if cloud use is not wanted).
7. Transfer the ZIP to a computer via AirDrop / network share / compatible external drive, open it and confirm the photo files plus `manifest.json` exist.
8. Only after verification, check the confirmation checkbox and press **Confirm verified batch**.
9. For test photos only, verify that **Delete verified local photos** requires an explicit `DELETE` typed confirmation. Do not clear real photos until backed up.

**Critical**: this is an iOS PWA. IndexedDB can be evicted or deleted; transferring pictures weekly reduces but does not eliminate loss risk between exports. Export critical photos promptly. An installed PWA can use storage separate from Safari, so inspect existing devices/app icons before replacing one.

## Diagnostics

GitHub Actions workflow `.github/workflows/validate.yml` checks catalog integrity, JavaScript syntax and ZIP folder/CRC structure.

```sh
node --check app.js
node --check local-backup.js
node --check service-worker.js
node tests/catalog-smoke.cjs
node tests/local-backup-smoke.cjs
```

Automatic deletion is disabled. A backup is only *manually confirmed* by the user after checking the copy on their computer; no remote file verification is possible in a local-only app.

The public site contains the building/unit catalog. No captured photo blobs are published to GitHub or transmitted to OneDrive.

