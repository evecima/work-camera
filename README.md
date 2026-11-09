# Work Camera V3.9 — private, local-only iPhone photo library

**Independent PWA. Apartment Finder (`evecima/gb-af-tool`) remains unchanged.** Live app: https://evecima.github.io/work-camera/

## How it works

One home-screen icon named **Work Camera** opens a simple home screen:

- **Find Apartment Directly** — on **Choose location → Buildings**, below the building dropdown, type only the apartment door number (for example `422`, `422A` or `APT 422 A`). The copied Apartment Finder catalog identifies the exact building and apartment while offline; tap the matching row (or press Enter for an exact match) to update the existing Building, Area=Apartment, Apartment, and photo destination. This does **not** launch the camera automatically; verify the destination first. The original building/area selection remains fully available. Unknown or invalid numbers are not assigned a guessed building.
- **Take Photo** — select a building, apartment/area or facility. Choose **iPhone Camera · One photo** for the familiar iOS system capture interface (it necessarily returns to Work Camera after **Use Photo**); or **Continuous Camera · Several photos** for a live in-app viewfinder that remains open between shots. The app remembers the location and saves each accepted image locally. Photo Details appear only when using the small **eye (View)** button on a saved image in **My Photos**; tapping its thumbnail instead selects or deselects it.
- **Continuous Camera limitations** — uses `getUserMedia()` / canvas JPEG capture, not Apple's full Camera app. Image resolution depends on the iPhone/browser stream and may be lower than native HEIC photos; flash, portrait, Apple image processing and all native controls are not guaranteed. Switch back to iPhone Camera whenever native photo quality or controls matter. Camera permission may be required; the continuous session closes on exit/background.
- **Nested photo folders** — in **My Photos**, the app now opens with a compact directory of locations instead of generating every thumbnail. For **All locations**: choose Building → Area (Boiler Room, Hallways, Exterior, Laundry Room, Apartments, or Office Lease) → if Apartments, the apartment number (e.g., Apt 22C) → photos. When a specific building is chosen in the location dropdown, start directly with that building's area folders. Individual facilities and Current location display their own images directly. Each folder shows its actual saved photo count, and Apartments also shows the number of apartment folders. Use **← Back** to move one level up or return to All locations. Existing multiple-selection Share, Download, and Delete buttons still appear only after selecting images in a leaf; **Select visible** works only for the photos in the open folder. Selections remain while browsing between folders and location filters.
- **My Photos** — the location dropdown shows **only buildings and facilities with stored local photos** by default, labeled with their actual photo counts. **All locations** and **Current location** remain available. Check **Show empty buildings** to display the full building list (and empty facilities) with zero counts. These choices refresh when opening My Photos and after deleting photos; selected photo checkmarks persist across location filters. Tap photo thumbnails to select one or many; the selected photos show a checkmark. **Select visible** selects all photos in the currently displayed filter, while selection remains active across filter changes. **Clear** resets it. A small eye button opens a read-only full-size preview; Photo Details no longer hosts individual Share/Download/Delete actions. Instead use the selection toolbar: **Share** uses the iOS sheet to send original images, **Download** saves one original or prepares a location-organized ZIP for several (tap **Save ZIP** when ready), **Delete** permanently removes only selected records after explicit confirmation and typing `DELETE`.
- **Weekly Backup** — create a ZIP of original photos sorted into folders; copy it to a computer, open and inspect it, explicitly confirm the backup, and only then unlock the delete-verified option.

Photos accepted from the iPhone system capture interface are stored privately in this iPhone web application's **IndexedDB**, not uploaded to any cloud. iOS controls which native capture functions are available: **a PWA cannot demand every feature of the full Apple Camera app**. For advanced photography, take the photo in Apple's Camera app and choose **Import from Photos**; those original shots also remain in the Apple Photos library. System-capture storage behavior should be checked on the user's iOS version. ZIP exports use iOS Share / Save to Files where supported, otherwise browser download. ZIPs are divided into manageable batches (normally up to 80 photos and ~70 MB). Every ZIP contains a `manifest.json` listing the photo paths.

**The application cannot verify files on the user's computer.** “Confirm verified batch” is a **manual user attestation**, not cryptographic or remote verification. ZIP creation, sharing or download alone never authorizes deletion. Confirmed photos are deleted locally only after another explicit `DELETE` confirmation.

## Locations and catalog (unchanged)

- 54 residential buildings, exactly 500 apartments, copied from the original `data/apartments_master_v1.csv` (never modified).
- The building 3615 (Leasing Office) has **Office Lease** and **Boiler Room**; its boiler belongs to the same 16-building boiler list as all others.
- Other residential areas: Apartment, Exterior, Hallways, Laundry Room, and Boiler Room only for the qualifying buildings.
- Independent facilities: 3613 Montessori School, Swimming Pool and Tennis Courts.
- No empty folders are created in advance: they are represented as archive paths when photographs exist.

Example ZIP archive:

```text
Work_Camera_2026-11-06_wc-....zip
├── 3615/Boiler Room/<date>_<id>_WC_....jpg
├── 3615/Office Lease/<date>_<id>_WC_....jpg
├── 3514/Apartment/Apartment 20A/<date>_<id>_WC_....jpg
├── Facilities/3613 - Montessori School/<date>_<id>_WC_....jpg
└── manifest.json
```

## Photo folder navigation

The app derives virtual folders from photo location metadata already stored in IndexedDB; it does **not** move or rename photos, create real iOS folders, or modify the original 500-apartment catalog. At large volumes, it renders compact folder entries first, then thumbnails only for the selected leaf folder. Empty folders are omitted from photo navigation even if **Show empty buildings** is enabled in the dropdown; the latter still allows selecting an empty building and viewing its empty state. Categories in the camera and ZIP backup folder names are unchanged. `All locations` and `Current location` remain filters, and switching a filter resets folder depth. The photo gallery stays local and does not require internet.

## Photo location list behavior

- Counts are computed **on this device** from image blobs in the current Work Camera photo database, not from a network service or the public building catalog. This means a building with 5 actual photos appears as `📷 Building 3525 · 5 photos`.
- By default, empty buildings/facilities are omitted from the **My Photos** location dropdown only. **Show empty buildings** temporarily includes all 54 residential building choices plus the separate 3615 Leasing Office location and all three facilities. The **Take Photo** building/area choices are unchanged.
- If the last photo from a selected building is removed while empty entries are hidden, the gallery returns to `All locations` rather than leaving an invalid filter. `Select visible` continues to select only displayed photos; existing multi-selection across filters remains intact.
- Opening **My Photos** after taking new photos refreshes the counts. No thumbnails are altered, photo blobs are not changed, and IndexedDB schema stays at its original version.

## Descriptive photo names when sharing and exporting

Work Camera V3.9 assigns **human-readable filenames at export time only**. Examples:

```text
Building_3544_Boiler_Room_2026-11-08_19-10-23_abc123def456.jpg
Building_3525_Apt_22C_2026-11-07_15-52-28_c947de23b2a0.heic
Building_3525_Hallways_2026-11-08_18-30-10_0abc293a2f08.jpg
Facility_3613_Montessori_School_2026-11-08_12-45-00_5577c0099b11.jpg
```

- Format: **building/facility + area/apartment (when applicable) + YYYY-MM-DD + HH-mm-ss (24-hour local time) + stable short photo ID + original image extension**.
- Descriptive names are used when sharing **one or multiple images** through the iOS Share menu, downloading a single image, generating a **selected-photos ZIP**, and producing the **Weekly Backup ZIP**. Both ZIPs retain the folder hierarchy and original image bytes.
- The short ID makes filenames distinct even if two photos were accepted in the same second. The original photo filename and image contents remain unchanged inside IndexedDB.
- New photos store the iPhone's UTC-offset-at-save to preserve their local wall-clock time in future exports. For **older photos** without an offset, Work Camera formats the saved timestamp using the device's current local timezone. It does **not** rewrite their timestamps. The original creation timestamp is kept in UTC inside the ZIP's `manifest.json` alongside the newly generated filename and original filename.
- **Time semantics:** the date and time come from when Work Camera **saved/registered** the photo, generally just after `Use Photo` for native captures. For **Import from Photos**, this is the **import time**, not necessarily the original camera shutter time; EXIF capture timestamps are not read. The exact photo time in imported images requires a separate metadata feature.
- Some receiving apps may rename shared attachments; Work Camera supplies the descriptive names in the exported `File` objects and ZIP entries, but cannot force another app to retain them.
- No existing photographs are renamed in the local library; no photo content, backups, camera routes, Apartment Finder data, or IndexedDB schema version are modified.

## Batch action limits and safeguards

- **Share:** direct multi-file sharing can depend on the iOS destination app. For reliability the direct share action is limited to 25 photos or 50 MB per operation. Unsupported groups can be exported as a ZIP. Choosing Share never deletes originals.
- **Download:** one photo exports its original file; two or more create an offline ZIP, organized by building/area and including a manifest. An individual ZIP can contain up to 80 photos or 70 MB. Use Weekly Backup for larger selections. ZIP preparation does not flag photos as verified backups.
- **Delete:** warns explicitly about photos without confirmed computer backups, then requires typing `DELETE`. Unlike Weekly Backup cleanup, this deliberate manual gallery delete **can remove unverified photos**, so verify your copy first. No automatic deletion occurs.
- Photo selection and prepared ZIP data live only in app memory, not in IndexedDB. Existing images, database schema, photography modes, and weekly computer backup workflow are unchanged.

## Important storage and privacy limits

- **No cloud backup. No Azure or Microsoft registration. No additional subscriptions.**
- iOS / Safari may evict website data or clear it when the app or its site data is deleted. IndexedDB should **never** be the sole long-term copy of irreplaceable work photos.
- A newly installed home-screen PWA may have a storage container separate from Safari browser sessions. Do not uninstall existing app icons or clear website data without checking for photos and exporting them.
- The app cannot silently save to arbitrary iPhone folders. The user must confirm sharing or saving the ZIP. Avoid iCloud Drive when choosing Files destinations if you want to remain fully offline.
- For weekly transfers, use an appropriate local method (for example AirDrop to a Mac, a USB drive supported by Files, or a computer network share). Open and inspect every ZIP on the computer before confirming and cleaning.
- The app never uploads photographs to GitHub. **The public GitHub Pages site exposes the code and building catalog**, so consider workplace access/privacy requirements. Follow employer policies and avoid residents' private information or unauthorized photos.

## Install and update

### Version v3.5: safe update troubleshooting

The Home screen shows **Running version: V3.5.0** from the executable JavaScript, plus **Update app**. That button checks the service worker and reloads the app using a fresh URL while keeping the same IndexedDB database. It **does not erase photos, clear website data, or remove the home-screen icon**.

On an installed iPhone PWA, if the visible version is absent or older, ensure the iPhone is online, fully quit Work Camera from the app switcher, reopen it, and check again. If the new version appears, tap **Update app** and check the runtime label. **Do not uninstall the app, delete the icon, or clear Safari data** to force an update; those actions may lose saved work photos.

The intended capture behavior: iPhone Camera **Use Photo** returns to the Work Camera capture page by iOS design; Continuous Camera allows repeated captures without leaving its viewfinder. **Photo Details** appears only after opening **My Photos** and tapping a thumbnail.


1. Open https://evecima.github.io/work-camera/ in Safari on the iPhone.
2. Use **Share → Add to Home Screen** (or **Add to Home Screen → Open as Web App**, depending on iOS). The icon is named **Work Camera**.
3. Open it, confirm you see **Take Photo** and **My Photos**, select a destination, then tap **Take Photo**; the iPhone system capture should open. Accept a harmless photo, check Photo details, and test **Share** to your own app/device. If you need all advanced Camera tools, take a photo in Apple Camera and select **Import from Photos** inside Work Camera.
4. In **Weekly Backup**, prepare a ZIP, save it, inspect the copied archive on a computer, then confirm the verified batch.
5. **Do not delete** the app or its local data until your test and any existing photos are backed up.

The previous OneDrive connector and its test have been removed from the V3 source tree. Historical commits retain the V2 prototype if ever needed. No OneDrive API calls are made.

## Developer checks

```bash
node --check app.js
node --check local-backup.js
node --check service-worker.js
node tests/catalog-smoke.cjs
node tests/local-backup-smoke.cjs
```

The application shell is cached for offline use with `service-worker.js`; photographs remain in IndexedDB. These automated tests check archive structure, CRC and catalog fidelity; **they do not substitute for testing camera, sharing and storage on a real iPhone**.

## Direct apartment search validation
The 500-unit snapshot has exactly 500 unique numeric apartment numbers (1–500), each mapped to one building and one letter suffix. E.g., door `422` or `422A` resolves to **Building 3544 / Apartment 422A**, while `166` resolves to **Building 3695 / Apartment 166A**. Autocomplete may also show suggestions for shorter partial numbers; the app only updates the location after selecting a result. The lookup never queries the network, changes source Apartment Finder data, or writes photos.
