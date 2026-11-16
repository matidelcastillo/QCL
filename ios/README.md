# QCL iOS

Shell de Capacitor 8. La UI va empaquetada en la app (`webDir`: `capacitor-web`); las APIs van a https://qcl.matidelcastillo.workers.dev.

Preparar el web shell y sincronizar iOS: `bun run ios:prepare` (desde la raíz del repo). El escáner ISBN nativo es `@capacitor/barcode-scanner` (plugin oficial con SPM). `cap sync ios` lo enlaza en `CapApp-SPM`; Codemagic sigue compilando `App.xcodeproj`.

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
