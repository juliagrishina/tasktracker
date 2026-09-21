# Production Auth release checklist

This checklist covers the dashboard-only parts of E11-T8.  The repository is
intentionally limited to templates, safe defaults and empty variable names:
SMTP credentials, CAPTCHA secrets and ticket pepper values must never be
committed.

## Supabase Auth dashboard

- Enable Email/Password, email confirmation, anonymous sign-in and manual
  identity linking. Keep phone and OAuth providers disabled.
- Set the Site URL to `https://planmeplan.ru` and allow exactly
  `https://planmeplan.ru` plus the deployed callback URLs.
- Configure a production SMTP provider with the `SUPABASE_AUTH_SMTP_*` values
  from the secure deployment secret store. Send a real registration,
  email-change and recovery message before release.
- Copy the Russian HTML in `supabase/templates/` into the matching dashboard
  templates: confirmation, email change, password-change code, recovery,
  password changed and email changed. The two account-action messages are sent
  by the protected account action workflow when it is deployed.
- Set email OTP length to 6, expiry to 600 seconds and resend interval to 60
  seconds. Apply the rate limits documented in `supabase/config.toml`.
- Enable **Require current password when updating**. The password-change flow
  sends `current_password` to Auth so the current device stays signed in while
  every other session is revoked.
- Register an hCaptcha site for both `planmeplan.ru` and local development,
  then configure its **secret** in the dashboard. Enable CAPTCHA only together
  with a web and native client implementation that supplies a CAPTCHA token;
  this repository must not ship an enabled CAPTCHA switch without that token.

## Protected account actions

- Store `ACCOUNT_ACTION_TICKET_PEPPER` only as an Edge Function secret, with
  at least 32 random characters.
- An Edge Function may issue a ticket only after its own password and email
  OTP verification. It must use `createHmacTicketHasher` before persisting the
  token hash in `account_action_tickets`.
- The clear-data and delete-account functions must consume the ticket through
  `consume_account_action_ticket` immediately before their mutation. They must
  reject any missing, expired, replayed, cross-user or cross-operation ticket.
- Never log a password, OTP, raw ticket, SMTP credential, CAPTCHA secret or
  ticket pepper. Run the ticket scope/expiry/replay tests before release.
