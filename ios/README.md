# QCL iOS

Shell de Capacitor 8 que carga https://qcl.matidelcastillo.workers.dev

- Bundle ID: `com.quecarajolees.app`
- Nombre en el springboard: `QCL` (`qué carajo lees` no entra)
- iOS 15+, signing automático
- App Icon: `resources/icon.png` (1024 RGB, sin alpha). Regenerar: `bunx capacitor-assets generate --ios --assetPath resources`

## TestFlight

La subida corre en GitHub Actions (`.github/workflows/ios-release.yml`). No hace falta Xcode en esta Mac.

Secretos del repo (valores nuevos para QCL, no copiar los de QC):

- `APPLE_TEAM_ID`
- `APPSTORE_API_KEY_ID`
- `APPSTORE_API_ISSUER_ID`
- `APPSTORE_API_KEY_P8_BASE64`

Después, en GitHub: Actions → iOS Release to TestFlight → Run workflow.
