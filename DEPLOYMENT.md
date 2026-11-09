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
4. Choose a harmless test location and tap **iPhone Camera · One photo**. Capture and accept a photo; verify you return to the Work Camera capture page without Photo Details. Then try **Continuous Camera · Several photos**: grant permission, take three shots, verify the viewfinder stays open and close it.
5. In **My Photos**, tap two or more thumbnails and check their selection rings. Use the eye button to preview without changing selection. Try **Select visible**, **Clear**, and switching filters while keeping selections.
6. Tap **Share** from the selection toolbar. Send harmless images to your own compatible target (Messages, Mail or AirDrop), if supported. If sharing a group is unsupported, select fewer photos.
7. Tap **Download** for several selected photos, then **Save ZIP**; confirm the ZIP contains originals organized by building / area, plus `manifest.json`. Single selected images download in their original format. Test **Import from Photos** separately using a harmless image (which remains in the iPhone's personal Photos app).
8. For **Delete**, use disposable test photos only: verify that the app warns about unbacked-up photos and demands typing **DELETE**. Do not delete irreplaceable images.
9. Put the phone into Airplane Mode and reopen the installed app. Test browsing the library and continuous camera offline. The service worker needs one initial online installation.
10. In **Weekly Backup**, press **Prepare ZIP**, then **Save / Share ZIP**; transfer the archive to your computer and inspect all photos.
11. Only after computer verification, check the backup confirmation box and press **Confirm verified batch**. Test the separate **Delete verified local photos** flow on disposable images only.

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

