# Work Camera V3.10.1 — Deploy and iPhone acceptance checklist

## Deployment

Work Camera is hosted separately from Apartment Finder at:
https://evecima.github.io/work-camera/

The GitHub repository is `evecima/work-camera`, and GitHub Pages publishes `main` / root. Never modify or redeploy `evecima/gb-af-tool` while updating this project.

No Azure, OneDrive or Apple Developer configuration is required for the local-only release.

## iPhone setup

1. Open the public URL using **Safari** on the iPhone.
2. Use the Share menu to **Add to Home Screen**. Keep exactly one icon named **Work Camera**.
3. Open the installed app and check that Home shows **Take Photo** and **My Photos** and **Running version: V3.10.1**. If it does not, keep your photographs and troubleshoot the stale application cache without uninstalling.
4. In **Choose location → Buildings**, under the Building selector, enter `422` (or `422A`) in **Find Apartment Directly**. Tap the matching **Apt 422A — Building 3544** row. Check that Building, Area=Apartment, apartment dropdown and photo destination all update. Repeat with `166`, expected Building 3695 / Apt 166A. Enter `999` or `422B` and confirm no building is invented. Changing the Building manually must still work and reset the quick search.
5. Choose a harmless test location and tap **iPhone Camera · One photo**. Capture and accept a photo; verify you return to the Work Camera capture page without Photo Details. Then try **Continuous Camera · Several photos**: grant permission, take three shots, verify the viewfinder stays open and close it.
6. In **My Photos**, verify **All locations** shows building folders instead of thumbnails. Open a building, then **Boiler Room** or **Hallways**, and verify only photos from that area appear. Use **← Back** to return to the categories, then the buildings. For an apartment building, open **Apartments → Apt 22C → photos** (or an apartment with real test photos) and check photo counts at each level. Check **Select visible** is disabled on folder listings and only selects images inside the opened photo folder. Then open the location selector. By default, confirm that only buildings/facilities with actual photos are shown, each with a count, plus All locations and Current location. Toggle **Show empty buildings** to display zero-photo buildings as well. Toggle off to hide them again. Confirm Take Photo still lists all buildings. Then tap two or more thumbnails and check their selection rings. Use the eye button to preview without changing selection. Try **Select visible**, **Clear**, and switching filters while keeping selections.
7. Tap **Share** from the selection toolbar. On a single photo, check the iOS share sheet shows its descriptive file name. Send the file to your own WhatsApp or Messages chat and verify Work Camera no longer supplies an extra text message. The recipient may still see an inline photo without its filename; this is controlled by WhatsApp or Messages. Test several selected photos as well. **Copy location + date + time** stays entirely optional and does not send text unless you paste it yourself. For stronger filename preservation, save to Files and attach in WhatsApp as Document (not Photo), or transfer a ZIP. Verify each attached original image uses a descriptive filename containing the building/facility, area or apartment, date and hour (with a short ID). The destination app may still rename the attachment. Repeat with a single image, then several. Send harmless images to your own compatible target (Messages, Mail or AirDrop), if supported. If sharing a group is unsupported, select fewer photos.
8. Tap **Download** for several selected photos, then **Save ZIP**; check that every JPEG/HEIC image entry in the ZIP has its descriptive filename and that `manifest.json` records `originalFilename`, `exportedFilename` and UTC date. Repeat with a single photo to validate its descriptive download filename. confirm the ZIP contains originals organized by building / area, plus `manifest.json`. Single selected images download in their original format. Test **Import from Photos** separately using a harmless image (which remains in the iPhone's personal Photos app).
9. For **Delete**, use disposable test photos only: verify that the app warns about unbacked-up photos and demands typing **DELETE**. Do not delete irreplaceable images.
10. Put the phone into Airplane Mode and reopen the installed app. Test browsing the library and continuous camera offline. The service worker needs one initial online installation.
11. In **Weekly Backup**, press **Prepare ZIP**, then **Save / Share ZIP**; transfer the archive to your computer and inspect all photos.
12. Only after computer verification, check the backup confirmation box and press **Confirm verified batch**. Test the separate **Delete verified local photos** flow on disposable images only.

**Important**: Saved photo timestamps reflect when Work Camera registered the picture; imported photos may have been taken earlier. Pre-V3.9 photos without saved timezone offsets use the device's local timezone for exported filenames. Always verify an export before removing photos.

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

