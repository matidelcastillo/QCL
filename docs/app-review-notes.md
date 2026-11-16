# Notas para App Review / Review notes

Usar en App Store Connect → App Review Information (y en TestFlight → Test Information). Copiar la cuenta demo desde `/Users/Shared/REPOS/QCL/.env-review` (archivo local, no está en git). No pegar la contraseña en este documento.

## Español

QCL (qué carajo lees) es una app para guardar tu biblioteca de libros y ver qué leen otras personas de la app. El bundle es `com.quecarajolees.app`.

Para revisar la app, entrá con la cuenta demo indicada en App Review Information. Adentro vas a ver una lista propia, el feed “Qué lee la gilada”, y en Agregar podés buscar un libro o escanear el ISBN con la cámara.

La cuenta se crea por email. Para borrarla: andá a Vos (Tu racconto) → Eliminar cuenta → confirmá. Eso borra el usuario, el perfil y todos los libros de esa cuenta.

La política de privacidad está en:
https://qcl.matidelcastillo.workers.dev/privacidad
También hay un enlace en Entrar y en Vos.

La cámara solo se usa para leer el código ISBN; no guardamos la foto.

## English

QCL (“qué carajo lees”) is a book-list app: you keep your own library and can see what other people in the app are reading. Bundle ID: `com.quecarajolees.app`.

Please sign in with the demo account in App Review Information. You will see a personal library, the “Qué lee la gilada” feed, and on Agregar you can search for a book or scan an ISBN with the camera.

Accounts are created with email. To delete an account: go to Vos (Tu racconto) → Eliminar cuenta → confirm. That deletes the user, their profile, and all of their books.

Privacy policy:
https://qcl.matidelcastillo.workers.dev/privacidad
The same link is on the sign-in screen and on Vos.

The camera is used only to read the ISBN barcode; the photo is not stored.
