# MITFAST Auth setup (strict project)

**Only project:** `https://qubphaacuuwlpdrsprjl.supabase.co`

Never configure Auth, hooks, or secrets on any other Supabase org/project.

**Forbidden accounts (do not use for CLI, deploy, or dashboard):**
- `mithronadmin@gmail.com` and any Supabase project under that org (e.g. `ictnoydmxlywwxwnugal`)
- Any Vercel team/login tied to `mithronadmin` — do **not** run `vercel link`, `vercel pull`, or `vercel deploy` from this repo with that login. Remove `.vercel/` if it appears after an accidental link.

**Allowed for this app:**
- Supabase project ref `qubphaacuuwlpdrsprjl` only
- Production site `https://mitfast-b2b.vercel.app`
- GitHub repo `mitfast2026-arch/Mitfast`

## Checklist

1. Confirm dashboard project URL is `qubphaacuuwlpdrsprjl`.
2. Enable **Email** provider (OTP / passwordless).
3. Enable **Google** provider; set Client ID/Secret; callback `https://qubphaacuuwlpdrsprjl.supabase.co/auth/v1/callback`.
4. Site URL + Additional Redirect URLs include your app origin and `/auth/callback`.
5. Deploy `send-email` Edge Function (see `supabase/functions/send-email/README.md`).
6. Authentication → Hooks → Send Email → point at the function; set `SEND_EMAIL_HOOK_SECRET`.
7. Leave custom SMTP **disabled** while the Send Email hook is on.
8. Put rotated `RESEND_API_KEY`, `BREVO_API_KEY`, `EMAIL_FROM` in function secrets (placeholders in `.env.example`).
