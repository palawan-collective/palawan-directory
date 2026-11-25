# Palawan — The Local Guide

Next.js / React / TypeScript application source, with Leaflet, PostgreSQL, private Vercel Blob, and Cloudflare R2 adapters. Includes all 3,135 original imported business records, not independently verified. No business photos are fabricated.

## Start locally

Requires Node 22+ and internet access to install dependencies. Copy `.env.example` to `.env.local`, set a strong ADMIN_PASSWORD and SESSION_SECRET, and set DIRECTORY_PREVIEW=true to view imported records in private development. Then:

```sh
npm install
npm test
npm run dev
```

Open http://localhost:3000 and http://localhost:3000/admin. In production, set DIRECTORY_PREVIEW=false. Only approved/published listings appear publicly. Satellite is available by default using Esri World Imagery, with attribution and native zoom capped at 17 to avoid missing high-zoom coastal tiles. Esri street/dark and OpenTopoMap use external tiles and require network connectivity. Review provider usage policies before public launch.

## Import workflow

- Admin → Import data → Business records: choose the original XLSX, CSV, JSON or GeoJSON. Validate & preview, then Import. Existing IDs and manually populated fields are retained by default.
- Image URL manifest: CSV/XLSX/JSON with `business_id`, `original_source_url` (or `image_url`), `reuse_permission_status`, `license`, `attribution`. URL records are candidates, not publicly hotlinked or downloaded automatically. This avoids expired URLs and unapproved reuse.
- Approved image ZIP: include `image-manifest.csv` and image files. Required columns: `business_id`, `filename`, `relative_file_path`, `image_type`, `original_source_url`, `license`, `reuse_permission_status`, `attribution`. Approved images are normalized to WebP, hash-deduplicated and linked by ID. Files without source/rights are skipped. Use small batches (max 50 MB / 500 manifest rows locally). The browser splits larger archives into separate image requests on Vercel.
- Individual uploads: Businesses → Edit → Attach approved photograph. Media library supports cover selection.
- Exports: Excel, GeoJSON and JSON with media metadata. JSON is not a full binary media backup.

## Persistence

Local development writes to `.local-data/` when DATABASE_URL and R2 credentials are absent. Configure a dedicated PostgreSQL database for deployment, and connect the dedicated private Vercel Blob store for photo files. The supplied Cloudflare R2 adapter is also supported. The current database adapter uses a transactionally updated JSONB workspace: replace with normalized PostGIS tables, spatial indexes and paginated queries before island-wide production scaling. Do not connect to an unrelated client database. The current admin uses a single password and signed session cookie; add login rate limiting, multi-user roles, audit logs and tested backups before public launch. No deployment or external credentials are included.

## GitHub and Vercel preview

The supplied seed is preserved in encrypted form in Git. For local development, extract
`data/businesses.json` from the original source archive into this directory. The live
Preview environment can load the encrypted copy when `DIRECTORY_SEED_KEY` is configured.
On a Vercel-authenticated preview, set `DIRECTORY_BUILD_MODE=true` to give
preview visitors immediate access to the admin workspace.
With `DIRECTORY_PREVIEW=true`, a Vercel Preview administrator can sign in at `/admin`
and open the directory to review imported listings. Public routes only expose approved
records to unauthenticated visitors.

Bulk ZIPs above 4 MB are split in the browser into individual uploads to stay under
Vercel's request limit. The archive still needs a rights manifest. Explicit known
business IDs take precedence, and a filename or relative path can supply an ID
when it matches exactly one existing record.
