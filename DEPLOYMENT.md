# Work Camera V3.3 — Deploy and iPhone acceptance checklist

## Deployment

Work Camera is hosted separately from Apartment Finder at:
https://evecima.github.io/work-camera/

The GitHub repository is `evecima/work-camera`, and GitHub Pages publishes `main` / root. Never modify or redeploy `evecima/gb-af-tool` while updating this project.

No Azure, OneDrive or Apple Developer configuration is required for the local-only release.

## iPhone setup

1. Open the public URL using **Safari** on the iPhone.
2. Use the Share menu to **Add to Home Screen**. Keep exactly one icon named **Work Camera**.
3. Open the installed app and check that Home shows **Take Photo** and **My Photos** and **Running version: V3.3.0**. If it does not, keep your photographs and troubleshoot the stale application cache without uninstalling.
4. Select a harmless test location and tap **Take Photo**. The iPhone should open its system camera capture UI. Accept a test photo; verify the camera screen stays visible with a saved message. Only after opening **My Photos** and tapping that photo should **Photo Details** show Share, Download and Delete.
5. Tap **Share**, select a trusted target such as your own Messages, Mail or AirDrop, and confirm the file can be sent without saving it to Apple Photos. If unsupported, use **Download**. Test **Import from Photos** separately with a harmless image taken in Apple's full Camera app (the original remains in the Photos library).
6. Put the phone into Airplane Mode and reopen the installed app. Test browsing the library and (where permitted) camera capture offline. The browser may need an initial online load for service-worker installation.
7. In **Weekly Backup** press **Prepare ZIP**, then **Save / Share ZIP**. Choose the local destination explicitly (prefer **On My iPhone** or a local external drive, not iCloud Drive if cloud use is not wanted).
8. Transfer the ZIP to a computer via AirDrop / network share / compatible external drive, open it and confirm the photo files plus `manifest.json` exist.
9. Only after verification, check the confirmation checkbox and press **Confirm verified batch**.
10. For test photos only, verify that **Delete verified local photos** requires an explicit `DELETE` typed confirmation. Do not clear real photos until backed up.

**Critical**: this is an iOS PWA. IndexedDB can be evicted or deleted; transferring pictures weekly reduces but does not eliminate loss risk between exports. Export critical photos promptly. An installed PWA can use storage separate from Safari, so inspect existing devices/app icons before replacing one.

## Safe app refresh

The new **Update app** button is network-dependent: it checks for a service-worker update and navigates to a fresh query URL on the **same origin**. It does not clear IndexedDB. Version-tagged scripts/CSS ensure Safari does not silently reuse an old asset URL. The service worker uses network-first `no-store` requests while keeping a versioned offline cache.

Do not advise deleting installed Work Camera or Safari website data to force a refresh when real photos may exist. Keep the same installed home-screen icon.

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

