# QCL iOS

Shell de Capacitor 8. El WebView carga el host fijo `https://qcl.matidelcastillo.workers.dev` (`server.url` en `capacitor.config.ts`). El `webDir` es `capacitor-shell`: una pantalla local de “Sin conexión.” (`errorPath`: `offline.html`) por si el remoto no carga. Los cambios web salen con un deploy del worker; no hace falta un build nativo.

Sincronizar iOS: `bun run ios:prepare` (desde la raíz del repo; solo `cap sync ios`). El escáner ISBN nativo es `@capacitor/barcode-scanner` (plugin oficial con SPM). `cap sync ios` lo enlaza en `CapApp-SPM`; Codemagic sigue compilando `App.xcodeproj`. No agregar `WKAppBoundDomains` (bloquea la inyección del puente si no está configurado con el flag y `localhost`).

- Bundle ID: `com.quecarajolees.app`
- Nombre en el springboard: `QC Lee` (`qué carajo lees` no entra)
- iOS 15+, signing automático
- App Icon: `resources/icon.png` (1024 RGB, sin alpha). Regenerar: `bunx capacitor-assets generate --ios --assetPath resources`

## TestFlight

La subida corre en Codemagic (`codemagic.yaml`, workflow "iOS Release to TestFlight"), desde `main`. No hace falta Xcode en esta Mac.
