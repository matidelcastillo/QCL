# QCL iOS

Shell de Capacitor 8 que carga https://qcl.matidelcastillo.workers.dev

- Bundle ID: `com.quecarajolees.app`
- Nombre en el springboard: `QCL` (`qué carajo lees` no entra)
- iOS 15+, signing automático
- App Icon: `resources/icon.png` (1024 RGB, sin alpha). Regenerar: `bunx capacitor-assets generate --ios --assetPath resources`

## TestFlight

En esta Mac no está instalado Xcode (solo Command Line Tools) y el project de QC no tiene `DEVELOPMENT_TEAM`. Para subir:

1. Instalar Xcode y hacer `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
2. Abrir Xcode, iniciar sesión con la cuenta de Apple que usa QC, y en Signing & Capabilities del target App elegir el mismo Team
3. En App Store Connect, crear la app (bundle `com.quecarajolees.app`, nombre de tienda p. ej. “qué carajo lees”)
4. Archivar y subir: `cd ios/App && xcodebuild -scheme App -destination 'generic/platform=iOS' -archivePath ../../build/QCL.xcarchive archive` y después `xcodebuild -exportArchive ...` o Organizer → Distribute → TestFlight
