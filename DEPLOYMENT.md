# Work Camera — publication checklist (V2.1)

## Repository (never modify Apartment Finder)

1. Sign in to GitHub as `evecima` and open <https://github.com/new>.
2. Create a **new private repository** named `work-camera` (safer default for workplace building and apartment catalog). Select **Add a README file** to initialize the `main` branch (this lets ChatGPT upload the prepared files through the GitHub connection). Do not make the repository public without explicitly reviewing employer/privacy implications.
3. Once the repo exists, ask ChatGPT to upload the prepared files through its connected GitHub tool (it will update the starter README). Alternatively, upload the **unzipped contents**, not the ZIP itself, into the root of the repository.
4. Check the repo contains `index.html`, `app.js`, `onedrive.js`, `data/apartments.js`, `icons/`, `manifest.webmanifest`, `service-worker.js`, `.nojekyll` and `.github/workflows/validate.yml`.
5. **Publication decision:** GitHub Free Pages requires a public repository and published pages are publicly reachable. Do **not** enable public Pages with the real workplace catalog by default. Use a controlled hosting option with access restrictions (or obtain explicit approval to publish the source/catalog). For an approved public prototype only: choose **Settings → Pages → Build and deployment → Source: Deploy from a branch → main / (root) → Save**.
6. After the selected hosting is deployed, use its **actual HTTPS URL** as the exact OAuth SPA redirect URI. If, and only if, GitHub Pages was explicitly chosen and deployed, the URL will normally be `https://evecima.github.io/work-camera/`.

## Microsoft OneDrive authorization (personal account)

1. In the browser, go to <https://entra.microsoft.com/> and create a Microsoft Entra **App registration** named `Work Camera`. Choose personal Microsoft accounts support.
2. Under Authentication register the **exact deployed HTTPS URL** shown by Work Camera → Storage as a **SPA** redirect URI (not a Web/Confidential redirect). Do not create or share client secrets.
3. Under Microsoft Graph delegated API permissions request only `Files.ReadWrite.AppFolder` (preview status for delegated permission; verify acceptance with the actual account).
4. Copy the **Application (client) ID** into the Work Camera Storage screen. It is a public identifier, **not** a password. Press Connect OneDrive and use Microsoft’s login page.
5. Test with a photo of a non-sensitive object and select `3615 → Boiler Room`. Synchronize and check the remote photo under `Apps/Work Camera/Work Camera Photos/3615/Boiler Room/`.
6. Verify offline behavior, reconnect, restore and that a cloud-only gallery entry still opens after **Free local space**. Never free local space until the remote photo has been manually inspected.

## Critical warnings

- A GitHub Pages website has a public URL; it is not access-controlled. It must not host work photos or credentials. If the repo is public, its building/unit catalog is also public. Prefer a private repository and access-controlled hosting for any employer catalog.
- Photos remain in browser IndexedDB until successfully synced; iOS may erase web storage, so do not treat it as reliable long-term retention.
- OAuth tokens are held in memory only; reconnect after reload. Auto sync while the app is closed is **not** implemented.
- Do not upload resident or workplace photos to a personal Microsoft account without management authorization.
- OneDrive authorization and iPhone photo capture must be live-tested before using the app for important work.
