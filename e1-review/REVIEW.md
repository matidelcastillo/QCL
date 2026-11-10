# QCL E1: RLS acceptance package for review

Target: only `mdytuysdombxyydqnsmj`. Nothing here has been applied or run
against QCL. This is an RLS experiment, separate from the definitive v4 model.
The migration creates persistent tables `accounts` and `e1_private_records`;
they are not fixtures themselves and do not disappear automatically. Its
records/users are the fixtures. It does not implement `works/user_books`,
versioned mutations, receipts, or account deletion races.

## Prior read-only inspection

On 2026-11-07, QCL was `ACTIVE_HEALTHY`; `public` had no relations, policies,
functions, triggers or migrations, and Auth had no users. The public Auth
settings showed email signup enabled and auto-confirm disabled. Empty-database
advisors reported no findings, which does not demonstrate isolation.

## Reviewed sequence to execute later, only after authorization

1. Reinspect project ref, schema and migration history for drift.
2. Apply the isolation migration to QCL, with a separate approval to create
   the two persistent acceptance tables.
3. On a trusted operator machine, use Auth Admin `createUser` for A, B and C
   with controlled fictitious email addresses, strong distinct passwords and
   `email_confirm: true`. This confirms only those identities; it does not
   disable global verification or send confirmation email. Never place the
   service-role key in the test runner, browser or committed files. Record only
   returned UUIDs and choose distinct record UUIDs. Obtain ordinary user JWTs
   through normal sign-in. Capture an A JWT shortly before expiry for the
   expiry phase; keep A/B/C tokens valid for the other phases.

   The reviewed operator calls are, for each identity, equivalent to:

   ```ts
   const { data, error } = await admin.auth.admin.createUser({
     email: controlledFixtureAddress,
     password: distinctGeneratedPassword,
     email_confirm: true,
   });
   if (error || !data.user?.id) throw error ?? new Error("No user ID");
   // Record data.user.id and confirm it belongs to QCL.
   ```

   `admin` must be a server-side QCL client with an operator-only secret. Its
   key is never supplied to the acceptance test. The three users sign in via
   the ordinary publishable client to yield their user access tokens.
4. On the operator SQL connection, set
   `select set_config('qcl.expected_ref', 'mdytuysdombxyydqnsmj', false);`,
   review the exact UUID substitutions and run
   `tests/fixture-provision.review.sql`. Every review SQL file aborts without
   that session setting.
5. Set the named environment variables in the test file, then run it in an
   interactive terminal with `QCL_E1_ACCEPTANCE=1`. Missing inputs fail. The
   test uses only a publishable key and ordinary JWTs. It pauses twice:
   run `fixture-c-pending.review.sql`, then `fixture-c-active.review.sql`,
   substituting and verifying the same C UUID. The same C JWT is used before,
   during and after the transition. Do not paste secrets into terminal logs.
6. Inspect results, including restored title readback. Any test failure means
   the isolation claim is unproven. Run security advisors after schema changes.
7. Review and run `fixture-cleanup.review.sql`, delete the exact A/B/C Auth
   users with Auth Admin `deleteUser`, verify absence, then separately review
   `fixture-drop.review.sql`. That SQL has no CASCADE and aborts on nonempty
   tables. Review migration history and future deploy implications before
   removing the tables.

   For each previously recorded exact UUID, the operator call is:

   ```ts
   const { error } = await admin.auth.admin.deleteUser(fixtureUserId);
   if (error) throw error;
   // Read back through Auth Admin and verify that the UUID is absent.
   ```

Auth Admin methods: [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).
The operator must check whether security notification emails are enabled
before provisioning; use addresses they control. No email is sent by this
package itself.

## Local audit fixes (2026-11-09)

Applied only to this local review package. Nothing was applied to QCL.

1. **Specific denial expectations in `tests/e1-api.acceptance.test.ts`.**
   `denied()` no longer accepts any 4xx. Each denial asserts an exact HTTP
   status and PostgREST/Postgres `code`. Authenticated missing grants
   (UPDATE `owner_id`, accounts PATCH, INSERT, DELETE) expect `403` with
   `code: "42501"`. Anonymous requests without a JWT expect `401` with
   `code: "42501"`, following PostgREST’s mapping of insufficient privilege
   (`42501` → 403 if authenticated, else 401). Statuses `400`, `429` and
   any `5xx` fail the assertion. **To confirm on the real QCL run:** that
   Supabase’s hosted PostgREST returns exactly `42501` (not a `PGRST*`
   wrapper) for these missing-grant cases, and that anon without a Bearer
   token is treated as the unauthenticated mapping (401).

2. **Internal QCL session guard in every review SQL file.**
   Migration, provision, C pending/active transitions, cleanup and drop all
   abort unless `current_setting('qcl.expected_ref', true)` equals
   `mdytuysdombxyydqnsmj`. **Operator step (same connection, before each
   script):**
   ```sql
   select set_config('qcl.expected_ref', 'mdytuysdombxyydqnsmj', false);
   ```
   This only verifies that the operator set that session variable. It does
   not prove the TCP endpoint, dashboard project identity, or credentials.
   There is no built-in Postgres setting that exposes the Supabase project
   ref; do not treat this guard as remote project proof.

3. **`deletion_pending` restoration on failure.**
   After the first operator gate (C → `deletion_pending`), pending-phase
   assertions run inside `try/finally`. The `finally` always prompts the
   operator to restore C to `active` and verifies account status plus the
   original private row before the test ends, even when an earlier assertion
   fails.

4. **Cleanup aborts on unexpected owned rows.**
   `fixture-cleanup.review.sql` refuses to delete if A/B/C own any
   `e1_private_records` beyond the three expected fixtures, so deleting
   accounts cannot CASCADE-remove unexpected rows. This package only defines
   `e1_private_records` as dependent on `accounts`; no other dependents are
   checked.

## Remaining E1 gates

Session generation is still an isolated primitive, not integrated with Auth
or UI. Independent A/B browser sessions, logout/expiry cache clearing and
late-response discard still need end-to-end verification. This acceptance
table and REST test cannot approve E1 by themselves.

Private Auth Site URL/redirect allowlist, SMTP and recovery settings remain
product integration work. They do not block this administratively provisioned
RLS experiment if accounts can be created and signed in without mail delivery.

## Ejecución y cleanup en QCL (2026-11-09)

E1 se ejecutó en el proyecto QCL `mdytuysdombxyydqnsmj` (migración `e1_isolation_review` / `20261109181812`).

- REST isolation, C `deletion_pending` y expiry (con JWT a 120 s y restauración a 3600) pasaron.
- Browser gate: A/B, logout/reload, late-response discard y C pending pasaron; se corrigieron el puerto del gate y el botón Ingresar tras login fallido (`c59b192`).
- Cleanup del mismo día: se borraron solo las filas/usuarios fixture A/B/C, se dropearon `public.accounts` y `public.e1_private_records` (y sus policies), y se quitó la entrada de historial de esa migración. QCL quedó sin tablas en `public` y sin usuarios en Auth. No se tocó QC.
