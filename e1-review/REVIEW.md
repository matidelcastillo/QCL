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
4. Review the exact UUID substitutions and run
   `tests/fixture-provision.review.sql` with an authorized operator connection.
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

## Remaining E1 gates

Session generation is still an isolated primitive, not integrated with Auth
or UI. Independent A/B browser sessions, logout/expiry cache clearing and
late-response discard still need end-to-end verification. This acceptance
table and REST test cannot approve E1 by themselves.

Private Auth Site URL/redirect allowlist, SMTP and recovery settings remain
product integration work. They do not block this administratively provisioned
RLS experiment if accounts can be created and signed in without mail delivery.
