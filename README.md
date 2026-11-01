# Work Camera V2.1 — independent PWA + OneDrive-ready connector

**Standalone project. Apartment Finder remains unchanged.** This package does not edit or depend on the original repository while running. The copied catalog has 500 distinct apartments across 54 residential buildings. The CSV is retained under `data/`. Special building 3615 and facilities 3613, Swimming Pool, Tennis Courts are extra destinations; 3615 is not a residential building in the master CSV.

## Features implemented

- Dark mobile-first Locations → Camera → Gallery → Storage navigation.
- Building selection: 54 residential buildings + 3615 Leasing Office, with exact apartment list from copied Apartment Finder data.
- Residential categories: Apartments, Exterior, Hallways, Laundry Room, Boiler Room only for the 15 qualifying residential buildings.
- 3615 supports only Office Lease and Boiler Room, the latter integrated with the 16-building list.
- Facilities: 3613 Montessori School, Swimming Pool, Tennis Courts. School heat comes from 3615, but photo directories are separate.
- In-app photo capture, fallback system camera/file input, device-local IndexedDB, persistent last-selected location, gallery filter, photo export and delete confirmation.
- **Opt-in OneDrive personal App Folder authentication** with OAuth 2.0 authorization code + PKCE and Microsoft Graph via HTTPS, plus a pending-photo queue.
- Folder creation in the OneDrive App Folder, file-name uniqueness, upload sessions for files over 8 MiB, server metadata readback (ID/name/byte length), and verified/not-yet-backed-up status.
- Manual “Free local space” affects only verified photo blobs and **keeps cloud-only gallery entries**. It never deletes OneDrive files.
- OAuth tokens are kept **in memory only**, not in localStorage or source code. The Microsoft Application (client) ID is stored locally (public ID, not a secret). OAuth PKCE verifier/state temporarily live in sessionStorage for the redirect.

## Important: not ready for real work data yet

- **No Microsoft account has been connected or used in a live test.** No cloud backup has yet been verified against the user's own OneDrive.
- **Independent private GitHub repository created:** `evecima/work-camera` (`main`). **HTTPS hosting is not yet deployed**, so Microsoft OAuth is not configured and photos are not backed up.
- Camera / photo library has **not been physically tested on iOS/Safari**. The browser automation environment blocked local navigation; syntax and isolated logic tests passed.
- Web app storage (IndexedDB) can be cleared by a browser/OS. Until cloud verification, do not treat it as the only copy of important photos.
- iOS may restrict operation when the PWA is closed; sync runs when the app is open, signed in, and online. There is no promise of background sync.
- `Files.ReadWrite.AppFolder` delegated permission has *preview* status and should be validated with this personal Microsoft account. OneDrive app folder normally appears under `Apps/<App name>`; our photos live inside its `Work Camera Photos` directory. Its exact placement depends on Microsoft.
- Metadata readback checks the remote ID, filename and byte size, **not a cryptographic checksum**. After deployment, test reconnect, offline mode, an interrupted upload, and cloud-only gallery state.
- Ask workplace management for authorization before sending photos from occupied apartments or workplace facilities to a personal cloud account. Avoid resident faces, IDs, documents, and sensitive possessions.

## Publish as a separate project

1. The independent private repository is now **`evecima/work-camera`**. Do not place these files in `evecima/gb-af-tool` and do not modify Apartment Finder.
2. The V2.1 source files have been committed to `main`, including `onedrive.js` and `data/`.
3. Publish through an HTTPS hosting service **with suitable access controls**. A static HTTPS site serves the code but does not by itself restrict access to the building/unit catalog. Never embed OAuth client secrets. Review hosting visibility and employer privacy requirements.
4. Open the deployed app and record the exact **SPA redirect URI** displayed in Storage. It is `location.origin + location.pathname` and must match Microsoft Entra registration exactly.

## Connect Microsoft OneDrive (personal Hotmail account)

1. Sign into Microsoft Entra admin center at `https://entra.microsoft.com/` with an account allowed to register applications.
2. Create an **app registration** called `Work Camera`, selecting **Accounts in any organizational directory and personal Microsoft accounts** or a personal-accounts-only option when available.
3. Under **Authentication**, add a **Single-page application (SPA)** platform, using the deployed HTTPS redirect URI shown under Work Camera → Storage. For desktop development `http://localhost` may be supported, but the iPhone needs HTTPS hosting.
4. Under **API permissions**, request delegated Microsoft Graph `Files.ReadWrite.AppFolder`. No application secret is needed for this SPA. Do not request `Files.ReadWrite.All` or an administrator scope for this project.
5. Copy **Application (client) ID** (a public GUID), paste it into Work Camera → Storage, and select **Connect OneDrive**. This starts Microsoft-hosted sign-in; never type your Microsoft password into a custom Work Camera form.
6. Sign in to the intended personal account and confirm permission. The app should return to Storage and show *Connected for this session*.
7. Photograph a harmless test object. Open Storage → **Sync pending photos**; wait for `cloud-verified`. Inspect your OneDrive App Folder to confirm the file is in the intended building / area folder. Then test disconnect, reconnect, and retry.

**Note:** This workflow is code-prepared but **requires** real app registration and deployment before live OneDrive sign-in can work. Microsoft sign-in redirects might need particular validation when running an installed iPhone PWA.

## Examples of cloud paths (under the app's own folder)

```text
Work Camera Photos/
  3845/
    Apartments/Apt 20A/WC_2026-...jpg
    Exterior/
    Hallways/
    Laundry Room/
    Boiler Room/
  3615/
    Office Lease/
    Boiler Room/
  Facilities/
    3613 - Montessori School/
    Swimming Pool/
    Tennis Courts/
```

Folders are created *on demand*, not as hundreds of empty directories. The UI permits changing location before/during consecutive captures. The stored photo destination is the snapshot selected when the photo is taken.

## Local development / validation

Start a local server (from this directory) with `python3 -m http.server 8000`. Navigate to `http://localhost:8000` on the same computer. To test the camera on a physical iPhone, deploy the files on a separate HTTPS origin.

Syntax and offline logic tests:

```bash
node --check app.js
node --check onedrive.js
node --check service-worker.js
node tests/onedrive-smoke.cjs
```

Test harness mocks Microsoft authorization and Graph endpoints — it is **not evidence of live cloud connectivity**. Do not store production photos until a physical-device end-to-end upload is confirmed.

## V2.1 packaging notes

- Added GitHub Pages-ready `.nojekyll` file and a GitHub Actions validation workflow.
- Corrected the service worker cleanup to remove **only Work Camera-owned** caches. Other apps hosted on the same GitHub Pages origin retain their own cache entries.
- The source and assets stay separate from `evecima/gb-af-tool`; never upload or commit them there.
- Public GitHub Pages serves both the app code **and apartment/building catalog** publicly. Photos stay in the device's IndexedDB and the user's OneDrive App Folder, not in GitHub files. Prefer private repository + access-controlled hosting, since the app itself has no password gate.
- See `DEPLOYMENT.md` for step-by-step GitHub and Microsoft instructions.
