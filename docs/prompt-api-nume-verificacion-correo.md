# Tarea: verificación de correo al registrarse (API NUME)

Repo: `C:\Users\andre\Documents\CODEX\API NUME` (NestJS + Drizzle + Neon; correo vía `src/modules/mail`).

## Antes de empezar
- La copia local está en `FEAT/AILS/FORGOTPASS` y tiene cambios sin commit en `package.json` y
  `package-lock.json`. **No los toques.** Trabaja en una rama nueva desde `origin/master`
  (p. ej. `feat/email-verification`), en un worktree si hace falta.
- Revisa cómo se marcan los usuarios importados de WordPress y los creados por `store-webhook`
  (`metadata.created_via`, prefijos de hash `$P$`/`$wp$`, fechas). Lo necesitas para el backfill.

## Problema (hallazgo de seguridad)
`AuthService.register` (`src/modules/auth/auth.service.ts`) crea el usuario y devuelve
`access_token`/`refresh_token` de inmediato, **sin comprobar que el correo sea de quien se registra**.
La tabla `users` no tiene campo de verificación.

La tienda (`TIENDA NUME`) usa esta API para el login de clientes y muestra en `/cuenta` **todos los
pedidos cuyo correo coincide con el de la sesión**: descargas, reportes con nombre y fecha de nacimiento,
y en el checkout precarga teléfono y fecha de nacimiento. Hoy un tercero puede registrarse con el correo
de un cliente que aún no tiene cuenta y ver todo eso.

## Qué hay que construir

### 1. Base de datos
- Columna nueva `users.email_verified_at timestamptz NULL`, con migración de Drizzle
  (`npm run drizzle:generate` y el flujo de migración que use el repo).
- **Backfill** a `now()` (o a `created_at`) para:
  - los usuarios importados de WordPress;
  - los creados por `store-webhook` (su contraseña llegó por correo a esa dirección).
- Los demás usuarios creados con `/auth/register` quedan en `NULL`: tendrán que confirmar.
  Reporta cuántos quedan en cada grupo antes de aplicar en producción.

### 2. Registro
- `register` crea el usuario con `email_verified_at = NULL` y manda un correo de confirmación.
- **Sigue devolviendo la sesión** (no se bloquea el login), pero el usuario sale con `email_verified: false`.
  Quien consuma la API decide qué ocultar mientras no esté verificado.

### 3. Token de verificación
Usa el mismo patrón que `forgotPassword`/`resetPassword`:
- JWT con `type: 'email_verification'` y `sub` = id del usuario, firmado con un secreto del servidor; TTL de 24 h.
- Guarda **solo el hash** (argon2) en `metadata.auth.email_verification_hash`. Pedir un enlace nuevo
  invalida el anterior, y el token es de un solo uso.
- El enlace es `${mailService.appUrl}/verificar-correo?token=...`.

### 4. Endpoints nuevos
- `POST /auth/verify-email` `{ token }`: valida el token (firma, tipo, hash y que no se haya usado),
  fija `email_verified_at = now()`, borra el hash y responde `{ message, email_verified: true }`.
  Si el token es inválido o vencido, responde 401 con un mensaje genérico.
- `POST /auth/resend-verification` (requiere JWT): si el correo ya está verificado, no hace nada;
  si no, reenvía el correo. Siempre da una respuesta genérica. Debe tener rate limit (p. ej. 3 por hora
  por usuario) con el mismo mecanismo de límites que ya usa auth.

### 5. Respuesta de usuario
- `toSafeUser` (lo devuelven `/auth/me`, `/auth/login`, `/auth/register` y `/auth/refresh`) agrega
  `email_verified: boolean` y `email_verified_at: string | null`.
- **Este es el contrato del que depende la tienda:** `/auth/me` → `email_verified`.

### 6. Otros flujos
- `resetPassword` exitoso → marcar `email_verified_at` si estaba en `NULL`: el usuario demostró que
  controla ese buzón.
- `store-webhook`: al crear un usuario nuevo, fijar `email_verified_at = now()`.
- Si existe algún endpoint para cambiar el correo, debe regresar `email_verified_at` a `NULL` y mandar
  una nueva confirmación.

### 7. Correo
- Plantilla `buildEmailVerificationEmail` en `mail.templates.ts`, en español de México y con el mismo
  estilo que `buildPasswordResetEmail`, y su `sendEmailVerificationEmail` en `MailService`. Como el
  resto de los envíos, nunca lanza: registra el error en el log y sigue.

### 8. Swagger y documentación
- Documenta los endpoints nuevos y el campo `email_verified` igual que los existentes en `auth.controller.ts`.

## Fuera de alcance (avisar, no hacer aquí)
- **WEB NUME** (`C:\Users\andre\Documents\CODEX\WEB NUME`) necesitará:
  - la página `app/(auth)/verificar-correo` que llame a `POST /auth/verify-email`;
  - un aviso "Confirma tu correo" con botón de reenviar cuando `email_verified` sea `false`.
  Deja anotado qué falta.
- La tienda ocultará `/cuenta` y el prefill del checkout mientras `email_verified` sea `false`. Eso se
  hace en el repo de la tienda.

## Criterios de aceptación
- [ ] Un registro nuevo devuelve `user.email_verified === false` y envía el correo.
- [ ] `POST /auth/verify-email` con el token del correo → `/auth/me` devuelve `email_verified: true`.
- [ ] Reusar el mismo token, usar uno vencido o usar el anterior tras pedir otro → 401.
- [ ] `resend-verification` respeta el rate limit y no revela nada si el correo ya está verificado.
- [ ] Los usuarios importados de WordPress y los de `store-webhook` salen verificados tras el backfill.
- [ ] Un reset de contraseña exitoso marca el correo como verificado.
- [ ] Typecheck, lint y tests pasan; hay tests de `register`, `verifyEmail` y `resendVerification`.
- [ ] La migración es reversible y se probó en una base que no sea la de producción.

Al terminar: abre un PR hacia la rama base que use el repo e indica en la descripción el conteo del
backfill y el contrato `email_verified` para la tienda.
