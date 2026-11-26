-- 001 — normalised Palawan Directory schema
--
-- Replaces the single-row JSONB workspace (directory_workspace) with real
-- tables, indexes and PostGIS geometry. Additive: the old workspace table is
-- left in place so the current application keeps working during the cut-over.
--
-- Applied to Neon (PG 18.7, PostGIS 3.6.4) on 2026-11-26.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  note        text
);

CREATE TABLE IF NOT EXISTS destinations (
  slug        text PRIMARY KEY,
  name        text NOT NULL,
  latitude    double precision,
  longitude   double precision,
  zoom        integer,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS businesses (
  business_id           text PRIMARY KEY
                        CHECK (business_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  name                  text NOT NULL,
  category              text,          -- raw source category ("Food & Beverage")
  subcategory           text,          -- raw source subcategory ("coffee_shop")
  directory_category    text NOT NULL DEFAULT 'Other'
                        CHECK (directory_category IN
                          ('Stay','Eat','Drink','Explore','Discover','Wellness',
                           'Shop','Transport','Essentials','Other')),
  destination           text,          -- UI destination (Puerto Princesa, El Nido, ...)
  municipality          text,          -- normalised ("Puerto Princesa City")
  barangay              text,
  address               text,
  latitude              double precision
                        CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude             double precision
                        CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  location              geography(Point,4326),
  phone                 text,
  email                 text,
  website               text,
  facebook              text,
  instagram             text,
  whatsapp              text,
  description           text,
  opening_hours         text,
  amenities             text,
  services              text,
  editorial_status      text NOT NULL DEFAULT 'imported'
                        CHECK (editorial_status IN ('imported','approved','published','archived')),
  operating_status      text NOT NULL DEFAULT 'unknown',
  featured              boolean NOT NULL DEFAULT false,
  -- provenance / internal scoring (never returned by the public API)
  source_url            text,
  source_id             text,
  license               text,
  confidence            numeric,
  verification_date     date,
  merqato_opportunity   text,
  has_online_booking    boolean,
  has_online_ordering   boolean,
  has_digital_payments  boolean,
  social_media_presence text,
  website_available     boolean,
  mobile_responsive     boolean,
  image_permissions     text,
  photo_url             text,
  logo_url              text,
  -- anything the source adds that is not modelled above
  extra                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  search                tsvector GENERATED ALWAYS AS (
                          to_tsvector('simple',
                            coalesce(name,'') || ' ' || coalesce(description,'') || ' ' ||
                            coalesce(address,'') || ' ' || coalesce(subcategory,'') || ' ' ||
                            coalesce(category,''))) STORED,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media (
  id                 bigserial PRIMARY KEY,
  business_id        text NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  filename           text NOT NULL,
  url                text NOT NULL,          -- /api/media?id=..&file=.. (never a public URL)
  source_url         text,
  license            text,
  attribution        text,
  permission_status  text NOT NULL DEFAULT 'pending',
  cover              boolean NOT NULL DEFAULT false,
  image_type         text NOT NULL DEFAULT 'gallery',
  width              integer,
  height             integer,
  bytes              integer,
  sha256             text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, filename)
);

CREATE TABLE IF NOT EXISTS image_candidates (
  id                 bigserial PRIMARY KEY,
  business_id        text NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  source_url         text NOT NULL,
  filename           text,
  license            text,
  attribution        text,
  permission_status  text NOT NULL DEFAULT 'pending',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, source_url)
);

CREATE TABLE IF NOT EXISTS import_runs (
  id          bigserial PRIMARY KEY,
  kind        text NOT NULL,                 -- businesses | urls | zip
  filename    text,
  added       integer NOT NULL DEFAULT 0,
  updated     integer NOT NULL DEFAULT 0,
  rejected    integer NOT NULL DEFAULT 0,
  errors      jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- indexes
CREATE INDEX IF NOT EXISTS businesses_status_idx     ON businesses (editorial_status);
CREATE INDEX IF NOT EXISTS businesses_cat_idx        ON businesses (directory_category, editorial_status);
CREATE INDEX IF NOT EXISTS businesses_dest_idx       ON businesses (destination);
CREATE INDEX IF NOT EXISTS businesses_muni_idx       ON businesses (municipality);
CREATE INDEX IF NOT EXISTS businesses_featured_idx   ON businesses (featured) WHERE featured;
CREATE INDEX IF NOT EXISTS businesses_geo_idx        ON businesses USING gist (location);
CREATE INDEX IF NOT EXISTS businesses_search_idx     ON businesses USING gin (search);
CREATE INDEX IF NOT EXISTS businesses_name_trgm_idx  ON businesses USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS media_business_idx        ON media (business_id);
CREATE UNIQUE INDEX IF NOT EXISTS media_one_cover_idx ON media (business_id) WHERE cover;
CREATE INDEX IF NOT EXISTS candidates_business_idx   ON image_candidates (business_id);
CREATE INDEX IF NOT EXISTS candidates_pending_idx    ON image_candidates (permission_status);

-- ------------------------------------------------------------ destinations
INSERT INTO destinations (slug, name, latitude, longitude, zoom, sort_order) VALUES
  ('puerto-princesa','Puerto Princesa',9.76,118.75,11,1),
  ('port-barton','Port Barton',10.411,119.176,13,2),
  ('san-vicente','San Vicente',10.53,119.273,11,3),
  ('el-nido','El Nido',11.2,119.39,11,4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO schema_migrations (version, note)
VALUES ('001_normalised_directory',
        'businesses/media/image_candidates/import_runs + postgis + fts')
ON CONFLICT (version) DO NOTHING;
