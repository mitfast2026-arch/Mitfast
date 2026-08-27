# Tigris object storage (MITFAST)

Supabase remains the source of truth for Postgres, Auth, RLS, and business data.  
**Tigris** stores binary/media assets (product images, category images, business assets, private enquiry documents).

## Environment variables

Set these in `.env.local` (local) and Vercel (Production / Preview / Development):

| Variable | Example / notes |
|----------|-----------------|
| `AWS_ACCESS_KEY_ID` | Tigris access key id |
| `AWS_SECRET_ACCESS_KEY` | Tigris secret (sensitive) |
| `AWS_ENDPOINT_URL_S3` | `https://t3.storage.dev` |
| `AWS_REGION` | `auto` |
| `TIGRIS_BUCKET_NAME` | e.g. `mitfast-assets` |
| `TIGRIS_PUBLIC_URL_BASE` | Optional override, e.g. `https://mitfast-assets.t3.tigrisfiles.io` |

Do not commit secrets. `.env*` is gitignored.

## Bucket layout

Single bucket (e.g. `mitfast-assets`) with prefixes:

- `product-images/...`
- `category-images/...`
- `business-assets/...`
- `documents/...` (private objects; use signed URLs)

The bucket is created **private** with `--allow-object-acl` (Tigris requires a verified payment method for fully public buckets). Public media objects are uploaded with `ACL: public-read` and served from `https://<bucket>.t3.tigrisfiles.io/<key>`. Document objects stay private (presigned GET only).

API endpoint for SDK/CLI remains `https://t3.storage.dev`.

## Code entrypoint

All uploads/deletes/signing go through `lib/server/storage/storage-service.ts`.  
Legacy Supabase Storage URLs/paths continue to work for delete/sign until migrated.

## CLI

```bash
tigris whoami
tigris ls mitfast-assets
tigris credentials test --bucket mitfast-assets
```
