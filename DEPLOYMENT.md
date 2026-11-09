# Work Camera V3.5 — Deploy and iPhone acceptance checklist

## Deployment

Work Camera is hosted separately from Apartment Finder at:
https://evecima.github.io/work-camera/

The GitHub repository is `evecima/work-camera`, and GitHub Pages publishes `main` / root. Never modify or redeploy `evecima/gb-af-tool` while updating this project.

No Azure, OneDrive or Apple Developer configuration is required for the local-only release.

## iPhone setup

1. Open the public URL using **Safari** on the iPhone.
2. Use the Share menu to **Add to Home Screen**. Keep exactly one icon named **Work Camera**.
3. Open the installed app and check that Home shows **Take Photo** and **My Photos** and **Running version: V3.5.0**. If it does not, keep your photographs and troubleshoot the stale application cache without uninstalling.
4. Choose a harmless test location and tap **iPhone Camera · One photo**. Capture and accept a photo; verify you return to Work Camera's capture page with a saved message. Only after opening **My Photos** and tapping a thumbnail should Photo Details show Share, Download and Delete. Then return to the same location and choose **Continuous Camera · Several photos**, grant camera permission if prompted, tap the shutter three times and confirm the live viewfinder stays open while the saved counter increases. Close continuous mode and verify the three shots are present in My Photos. Quality and advanced native controls vary; continuous mode uses a browser video stream, not Apple's full Camera app.
5. Tap **Share**, select a trusted target such as your own Messages, Mail or AirDrop, and confirm the file can be sent without saving it to Apple Photos. If unsupported, use **Download**. Test **Import from Photos** separately with a harmless image taken in Apple's full Camera app (the original remains in the Photos library).
6. In **My Photos**, select two or more harmless test photos by tapping their thumbnails. Verify a blue selection ring and the fixed action bar. Tap the eye icon to preview without changing the selection. Use **Share** to your own Messages/Mail/AirDrop destination if supported; use **Download** to prepare a ZIP and **Save ZIP** to export it. Open the archive on a computer and check its contents. Test **Clear** and **Select visible**. For Delete, only use disposable test photos and confirm that **DELETE** must be typed; never erase unbacked-up work photos.
11. Put the phone into Airplane Mode and reopen the installed app. Test browsing the library and (where permitted) camera capture offline. The browser may need an initial online load for service-worker installation.
11. In **Weekly Backup** press **Prepare ZIP**, then **Save / Share ZIP**. Choose the local destination explicitly (prefer **On My iPhone** or a local external drive, not iCloud Drive if cloud use is not wanted).
11. Transfer the ZIP to a computer via AirDrop / network share / compatible external drive, open it and confirm the photo files plus `manifest.json` exist.
11. Only after verification, check the confirmation checkbox and press **Confirm verified batch**.
11. For test photos only, verify that **Delete verified local photos** requires an explicit `DELETE` typed confirmation. Do not clear real photos until backed up.

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

