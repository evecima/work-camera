# Work Camera V3 — private, local-only iPhone photo library

**Independent PWA. Apartment Finder (`evecima/gb-af-tool`) remains unchanged.** Live app: https://evecima.github.io/work-camera/

## How it works

One home-screen icon named **Work Camera** opens a simple home screen:

- **Take Photo** — select a building, apartment/area or facility. Confirming the location immediately invokes iPhone's system photo capture interface (`input type=file accept=image/* capture=environment`), without Work Camera's former web-video viewfinder. It remembers the latest location. After accepting a photo, Work Camera saves it and stays on the capture screen; details appear only when the user opens **My Photos** and taps a saved photo.
- **My Photos** — browse local work photos by building, area and apartment; filter locations; use **Share** to invoke the iPhone share sheet for Messages, Mail, AirDrop or other compatible targets, **Download** to export the file, or **Delete** with confirmation. Shares are initiated by the user and do not constitute a backup.
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

## Important storage and privacy limits

- **No cloud backup. No Azure or Microsoft registration. No additional subscriptions.**
- iOS / Safari may evict website data or clear it when the app or its site data is deleted. IndexedDB should **never** be the sole long-term copy of irreplaceable work photos.
- A newly installed home-screen PWA may have a storage container separate from Safari browser sessions. Do not uninstall existing app icons or clear website data without checking for photos and exporting them.
- The app cannot silently save to arbitrary iPhone folders. The user must confirm sharing or saving the ZIP. Avoid iCloud Drive when choosing Files destinations if you want to remain fully offline.
- For weekly transfers, use an appropriate local method (for example AirDrop to a Mac, a USB drive supported by Files, or a computer network share). Open and inspect every ZIP on the computer before confirming and cleaning.
- The app never uploads photographs to GitHub. **The public GitHub Pages site exposes the code and building catalog**, so consider workplace access/privacy requirements. Follow employer policies and avoid residents' private information or unauthorized photos.

## Install and update

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
