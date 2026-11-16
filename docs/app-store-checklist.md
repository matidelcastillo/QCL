# Checklist de revisión: QCL iOS (TestFlight y App Store)

Documento de control para no fallar en TestFlight App Review ni en App Review. No cambia el comportamiento de la app. Fuentes: solo documentación oficial de Apple, consultada el 16 de noviembre de 2026 (America/Buenos_Aires). Las [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) vigentes están actualizadas al 16 de octubre de 2026.

**Estado al 16 de noviembre de 2026 (America/Buenos_Aires).** Worker `qcl` desplegado, versión `0b5ea06e-b4bf-4c1d-9762-fedf1e403c99` (`https://qcl.matidelcastillo.workers.dev`). Contacto de la política: `matidelcastillo@gmail.com` (email de la cuenta Cloudflare del usuario; no se usó el mail del agente).

**App:** shell Capacitor 8 (`com.quecarajolees.app`) que carga `https://qcl.matidelcastillo.workers.dev`. Alta por email (Supabase), biblioteca personal, feed de lecturas de otras personas, escáner de ISBN con cámara.

**Leyenda**

- **Cumple:** está en el repo o en el binario iOS, con evidencia.
- **Falta:** no está en el código ni hay un artefacto publicable en el repo. Hay que hacerlo antes de enviar a revisión.
- **Parcial:** existe, pero no llega al criterio oficial.
- **Riesgo:** puede rechazarse aunque “funcione”. No se resuelve solo con un campo en App Store Connect.
- **App Store Connect:** no vive en el repo; hay que cargarlo en la ficha de la app.

---

## 1. Funcionalidad mínima y wrapper web — **Mitigado (riesgo residual)**

**Qué pide Apple.** La app tiene que tener funciones, contenido y UI que la eleven por encima de un sitio web empaquetado. Si no es útil, única o “app-like”, no corresponde al App Store. Salvo catálogos, no debe ser principalmente material de marketing, recortes web, agregadores o una colección de enlaces.

**Fuentes**

- [Guideline 4.2 Minimum Functionality](https://developer.apple.com/app-store/review/guidelines/)
- [Guideline 4.2.2](https://developer.apple.com/app-store/review/guidelines/)

**En el repo.** El binario iOS empaqueta la UI en `capacitor-web` (ya no hay `server.url` remoto). Las APIs van al worker por HTTPS. Plugins: App, Keyboard, StatusBar y `@capacitor/barcode-scanner` (oficial, con `Package.swift`, compatible con el proyecto SPM y con `codemagic.yaml`). En la web se sigue usando el escáner de `app/src/components/scanner.tsx`.

**Riesgos oficiales relacionados**

- La [introducción de las Guidelines](https://developer.apple.com/app-store/review/guidelines/) dice que el App Store no es el mejor canal para una app que solo querés mostrar a familia y amigos (sugiere instalación con Xcode o distribución Ad Hoc). El [guideline 2.2](https://developer.apple.com/app-store/review/guidelines/) exige que una beta en TestFlight esté pensada para distribución pública y cumpla las mismas guidelines.
- [Guideline 2.5.2](https://developer.apple.com/app-store/review/guidelines/): la app debe ser autocontenida y no descargar ni ejecutar código que introduzca o cambie funciones. Hoy todo el JS de la UI se baja de Workers en cada arranque.
- [Guideline 4.2.3(ii)](https://developer.apple.com/app-store/review/guidelines/): si hace falta bajar recursos extra para funcionar en el primer arranque, hay que informar el tamaño y avisar antes. El shell no lo hace.

**Para no fallar (sin implementar en este commit).** En las notas de revisión, describir con precisión las funciones (biblioteca propia, feed de lecturas, escáner de ISBN con cámara) y no presentar QCL como “app privada para un grupo chico”. El camino más seguro contra 4.2 / 2.5.2 es empaquetar la web en el bundle o sumar capacidad nativa real (por ejemplo el escáner) para que el binario no sea solo un visor de un URL.

---

## 2. Eliminación de cuenta en la app (5.1.1(v)) — **Cumple**

**Qué pide Apple.** Si la app permite crear cuenta, también debe permitir iniciar la eliminación de esa cuenta *dentro de la app*. La opción tiene que ser fácil de encontrar (en general, en ajustes de cuenta). Tiene que borrar el registro y los datos personales asociados, no solo desactivar. Confirmar la intención está bien; mandar a un flujo de soporte (mail, teléfono, chat) no, salvo industrias muy reguladas. Si hace falta terminar el proceso en la web, el enlace debe ir directo a esa página.

**Fuentes**

- [Guideline 5.1.1(v) Account Sign-In](https://developer.apple.com/app-store/review/guidelines/)
- [5.1.1(v) — Offering account deletion in your app](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/)

**En el repo.** En `vos.tsx` está “Eliminar cuenta” con confirmación. La app llama al RPC `public.delete_own_account()`, una función `SECURITY DEFINER` que borra solo los libros, el perfil y el usuario de Auth de `auth.uid()`. No usa service role en el browser ni en el worker.

---

## 3. Política de privacidad: URL en App Store Connect y enlace en la app — **Hecho en la app; falta cargar la URL en App Store Connect**

**Qué pide Apple.** Toda app debe tener un enlace a su política de privacidad en el campo de metadata de App Store Connect *y* dentro de la app, de forma fácil de encontrar. La política tiene que decir qué datos se recogen, cómo y para qué; que terceros (SDKs, analítica, etc.) den la misma protección; y las reglas de retención/borrado y cómo revocar consentimiento o pedir el borrado. La URL es obligatoria para iOS.

**Fuentes**

- [Guideline 5.1.1(i) Privacy Policies](https://developer.apple.com/app-store/review/guidelines/)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)
- [App privacy — propiedades](https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy/)

**En el repo.** Existe `/privacidad` (`app/src/routes/privacidad.tsx`), enlazada desde Entrar y Vos. URL pública: `https://qcl.matidelcastillo.workers.dev/privacidad`. Falta cargarla en App Store Connect.

---

## 4. Etiquetas de App Privacy (Privacy Nutrition Labels) — **Falta (App Store Connect)**

**Qué pide Apple.** Para enviar la app al App Store hay que declarar en App Store Connect las prácticas de datos propias y de terceros cuyo código esté integrado. “Collect” es transmitir datos fuera del dispositivo y conservarlos más de lo necesario para atender el pedido en tiempo real.

**Fuentes**

- [App privacy details on the App Store](https://developer.apple.com/app-store/app-privacy-details/)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)

**En el repo / ASC.** No hay cuestionario respondido en el repo. Por el código, como mínimo habría que revisar y declarar (si se conservan): email y nombre del alta (`entrar.tsx`), identificador de usuario de Supabase, y el contenido de la biblioteca. El escáner procesa el fotograma en el dispositivo (`scanner.tsx` + `barcode-reader.ts`) y después busca el ISBN; si no se sube la imagen, no declarar fotos/video solo por usar la cámara. Confirmar también Google Fonts y las APIs de catálogo/tapas.

---

## 5. Cumplimiento de exportación / `ITSAppUsesNonExemptEncryption` — **Cumple** (confirmar la exención)

**Qué pide Apple.** Si la app usa cifrado y se va a subir, hay que determinar el cumplimiento de exportación. Se pueden responder las preguntas en App Store Connect o declarar la clave en `Info.plist` para no repetirlas en cada envío.

**Fuentes**

- [Overview of export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/)

**En el repo.** `ios/App/App/Info.plist` ya tiene `ITSAppUsesNonExemptEncryption` = `false` (no usa cifrado no exento). Es el caso habitual si solo se usa HTTPS/TLS y la criptografía del sistema. No es asesoramiento legal: confirmar que QCL no incorpora cifrado propietario o no estándar antes de enviar.

---

## 6. Privacy manifest (`PrivacyInfo.xcprivacy`) — **Cumple**

**Qué pide Apple.** El manifiesto (`PrivacyInfo.xcprivacy`) describe prácticas de privacidad de la app o de un SDK y declara las Required Reason APIs con un motivo aprobado. App Store Connect rechaza manifiestos inválidos. Desde el 1 de mayo de 2024 hay requisitos de manifiesto, firmas y motivos para ciertos SDKs de terceros de uso común; Apple indicó que los motivos requeridos se ampliarían a todo el binario.

**Fuentes**

- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Adding a privacy manifest to your app or third-party SDK](https://developer.apple.com/documentation/bundleresources/adding-a-privacy-manifest-to-your-app-or-third-party-sdk)
- [TN3183: Adding required reason API entries](https://developer.apple.com/documentation/technotes/tn3183-adding-required-reason-api-entries-to-your-privacy-manifest)
- [Reminder: Privacy requirement for app submissions starts May 1](https://developer.apple.com/news/?id=pvszzano)

**En el repo.** Está `ios/App/App/PrivacyInfo.xcprivacy` en el target `App`, con `NSPrivacyTracking` en falso, tipos de datos (email, nombre, user ID, contenido de usuario) y UserDefaults `CA92.1`. Si al archivar Xcode señala otras Required Reason APIs, hay que sumar el motivo aprobado que corresponda.

---

## 7. Cuenta demo para revisión — **Cuenta creada; falta cargarla en App Store Connect**

**Qué pide Apple.** Si hay login, hay que incluir una cuenta demo vigente y dejar el backend encendido, o un modo demo con aprobación previa de Apple que muestre todas las funciones. Las credenciales no pueden vencer antes de la revisión. Lo mismo aplica en la información de revisión (y conviene repetirlo para TestFlight externo).

**Fuentes**

- [Guideline 2.1(a) App Completeness](https://developer.apple.com/app-store/review/guidelines/)
- [Provide information for a complete review](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)

**En el repo.** La app sigue pidiendo sesión (salvo `/entrar` y `/privacidad`). Hay una cuenta demo estable (`3f8qjpxx+revision@mail.grokbot.com`, tres libros). Las credenciales están solo en `.env-review`. Falta cargarlas en App Review Information.

---

## 8. Purpose string de cámara — **Cumple**

**Qué pide Apple.** Antes de usar la cámara hay que pedir permiso con un purpose string que describa de forma clara y completa el uso: una oración breve, en voz activa, con el resultado concreto, no un mero “para usar la cámara”.

**Fuentes**

- [Guideline 5.1.1(ii) Permission](https://developer.apple.com/app-store/review/guidelines/)
- [5.1.1(ii) — Write clear purpose strings](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-purpose-strings/)

**En el repo.** `NSCameraUsageDescription` quedó en `QCL usa la cámara para escanear el código ISBN del libro.` En nativo se usa `@capacitor/barcode-scanner` (SPM). En la web se sigue el escáner de `app/src/components/scanner.tsx`.

---

## 9. Ícono de la app — **Cumple**

**Qué pide Apple.** Ícono de 1024×1024 en el asset catalog, cuadrado, sin transparencia. El sistema aplica la máscara de esquinas; no pre-redondear.

**Fuentes**

- [Human Interface Guidelines — App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Configuring your app icon using an asset catalog](https://developer.apple.com/documentation/xcode/configuring-your-app-icon)

**En el repo.** `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (y la fuente `resources/icon.png`) es PNG 1024×1024, espacio RGB, `hasAlpha: no`. El target usa `ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon`.

---

## 10. Launch screen — **Cumple**

**Qué pide Apple.** La app debe declarar una launch screen (storyboard `UILaunchStoryboardName` o clave `UILaunchScreen`).

**Fuentes**

- [Specifying your app’s launch screen](https://developer.apple.com/documentation/xcode/specifying-your-apps-launch-screen)
- [TN3208: Preparing your app’s launch screen to meet App Store requirements](https://developer.apple.com/documentation/technotes/tn3208-preparing-your-apps-launch-screen-to-meet-app-store-requirements)

**En el repo.** `Info.plist` tiene `UILaunchStoryboardName = LaunchScreen`. Existe `ios/App/App/Base.lproj/LaunchScreen.storyboard` con el imageset `Splash` (incluye variantes light/dark).

---

## 11. TestFlight externo — proceso y metadata — **Falta (App Store Connect)**

**Qué pide Apple.** El primer build de un grupo externo pasa por TestFlight App Review (los siguientes de la misma versión pueden no requerir revisión completa). La beta debe cumplir las App Store Review Guidelines y estar pensada para distribución pública (2.2). Hay que completar Test Information (descripción de la beta, email de feedback, y el resto de datos de contacto que pida la ficha) antes de invitar testers externos.

**Fuentes**

- [Guideline 2.2 Beta Testing](https://developer.apple.com/app-store/review/guidelines/)
- [Invite external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/)
- [Provide test information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/)
- [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

**En el repo.** Hay workflow de subida (`.github/workflows/ios-release.yml`), pero no está la metadata de Test Information ni una cuenta demo. La política de privacidad (ítem 3) también hace falta para la ficha, incluida la distribución beta.

---

## 12. Completeness y metadata de App Store — **Falta (App Store Connect)**

**Qué pide Apple.** El envío tiene que ser una versión final, con URLs que funcionen, sin placeholders, probada en dispositivo, backend encendido y notas de revisión específicas (no genéricas). En App Store Connect hacen falta, entre otros, URL de privacidad, etiquetas de datos, y las propiedades de versión (por ejemplo Support URL, capturas, descripción, categoría, clasificación por edad).

**Fuentes**

- [Guideline 2.1(a) y 2.3 Accurate Metadata](https://developer.apple.com/app-store/review/guidelines/)
- [Provide information for a complete review](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/)
- [Required, localizable, and editable properties](https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties/)

**En el repo.** No hay capturas, Support URL, texto de ficha ni notas de revisión versionadas.

---

## Implementado en el repo (16 nov 2026)

- **4.2.** El shell iOS ya no apunta `server.url` a la web en vivo. `webDir` es `capacitor-web` (build estático generado por `bun run ios:prepare`). Las llamadas a `/api/libros`, `/api/tapa` y `/api/genero` van a `https://qcl.matidelcastillo.workers.dev` cuando la app corre en `capacitor://localhost`. CORS se envía solo a ese origin y solo en esas rutas. El escáner nativo usa `@capacitor/barcode-scanner` (plugin oficial con SPM; `cap sync ios` lo enlaza y `codemagic.yaml` sigue usando `App.xcodeproj`). En la web se mantiene el escáner anterior. Queda un riesgo residual de 4.2, menor que un WebView vacío.
- **5.1.1(v).** En Vos hay “Eliminar cuenta” con confirmación. La app llama `rpc('delete_own_account')`. La función (migración `20261116183452_delete_own_account`) borra solo la fila de `auth.uid()`. No hace falta un secret de service role en el worker.
- **Privacidad.** Página `/privacidad` en el mismo dominio, enlazada desde Entrar y Vos. Texto con los datos reales de la app. Contacto: `matidelcastillo@gmail.com`. Falta pegar esa URL en App Store Connect.
- **PrivacyInfo.xcprivacy.** Incluido en el target `App`: sin tracking; email, nombre, user ID y contenido de usuario para funcionalidad de la app; UserDefaults `CA92.1`.
- **Cuenta demo.** `3f8qjpxx+revision@mail.grokbot.com`, con tres libros. Credenciales solo en `.env-review` (gitignore). Falta cargarlas en App Review Information.
- **Cámara.** `NSCameraUsageDescription` = `QCL usa la cámara para escanear el código ISBN del libro.`
- **Notas de revisión.** Ver `docs/app-review-notes.md`.
- **Auditoría 390×844.** /privacidad, /entrar y /vos (cuenta demo, confirmación de borrado y Cancelar) sin overflow horizontal. El borrado de cuenta se prueba de punta a punta con un usuario temporal que después se elimina.

## Resumen rápido

| Ítem | Estado |
| --- | --- |
| 4.2 wrapper web / utilidad “app-like” | Mitigado (riesgo residual) |
| 5.1.1(v) borrar cuenta en la app | Cumple |
| 5.1.1(i) política de privacidad (URL + enlace in-app) | Hecho en la app; falta la URL en ASC |
| Etiquetas App Privacy | Falta (ASC) |
| `ITSAppUsesNonExemptEncryption` | Cumple |
| `PrivacyInfo.xcprivacy` | Cumple |
| Cuenta demo para revisión | Creada; falta cargarla en ASC |
| `NSCameraUsageDescription` | Cumple |
| Ícono 1024 RGB sin alpha | Cumple |
| Launch screen | Cumple |
| TestFlight Test Information + primer review externo | Falta (ASC) |
| Metadata / Support URL / capturas / notas 2.1–2.3 | Falta (ASC); hay borrador en `docs/app-review-notes.md` |
