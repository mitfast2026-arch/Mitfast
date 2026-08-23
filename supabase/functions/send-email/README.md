# Send Email Auth Hook (OTP only)

Project: **https://qubphaacuuwlpdrsprjl.supabase.co** only.

## Deploy

```bash
supabase functions deploy send-email --project-ref qubphaacuuwlpdrsprjl --no-verify-jwt
supabase secrets set --project-ref qubphaacuuwlpdrsprjl \
  RESEND_API_KEY=re_xxxxxxxxx \
  BREVO_API_KEY=xkeysib-xxxxxxxxx \
  EMAIL_FROM="MITFAST <onboarding@resend.dev>" \
  SEND_EMAIL_HOOK_SECRET="v1,whsec_xxxxxxxxx"
```

## Dashboard (same project only)

1. Authentication → Hooks → **Send Email** → HTTPS
2. URL: `https://qubphaacuuwlpdrsprjl.supabase.co/functions/v1/send-email`
3. Paste the generated webhook secret into `SEND_EMAIL_HOOK_SECRET`
4. Do **not** also enable custom SMTP while this hook is enabled
5. Authentication → Providers → enable **Google** + **Email**
6. URL Configuration: Site URL + redirect allow `…/auth/callback`

## Manual steps remaining (same project only)

Edge Function deploy from this environment returned **403** (CLI account lacks privileges on `qubphaacuuwlpdrsprjl`). Deploy from the dashboard owner account:

```bash
supabase login
supabase functions deploy send-email --project-ref qubphaacuuwlpdrsprjl --no-verify-jwt
supabase secrets set --project-ref qubphaacuuwlpdrsprjl \
  RESEND_API_KEY=re_xxxxxxxxx \
  BREVO_API_KEY=xkeysib-xxxxxxxxx \
  EMAIL_FROM="MITFAST <onboarding@resend.dev>" \
  SEND_EMAIL_HOOK_SECRET="v1,whsec_xxxxxxxxx"
```

Then Authentication → Hooks → Send Email →  
`https://qubphaacuuwlpdrsprjl.supabase.co/functions/v1/send-email`

Replace placeholders with **rotated** keys (keys pasted in chat are compromised).

