-- 002 — migrate the JSONB workspace into the normalised tables
--
-- Reads directory_workspace (id = 1) and inserts one row per business.
-- Safe to re-run: ON CONFLICT DO NOTHING. The workspace row is not modified.
--
-- Result on 2026-11-26: 3,135 businesses, 3,135 with a PostGIS point,
-- 0 rows with unmapped keys (everything landed in a modelled column).

WITH src AS (
  SELECT b,
         CASE WHEN b->>'latitude'  ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN (b->>'latitude')::float8  END AS lat,
         CASE WHEN b->>'longitude' ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN (b->>'longitude')::float8 END AS lon
  FROM directory_workspace w, jsonb_array_elements(w.payload->'businesses') b
  WHERE w.id = 1
)
INSERT INTO businesses (
  business_id, name, category, subcategory, directory_category, destination,
  municipality, barangay, address, latitude, longitude, location, phone, email,
  website, facebook, instagram, whatsapp, description, opening_hours, amenities,
  services, editorial_status, operating_status, featured, source_url, source_id,
  license, confidence, verification_date, merqato_opportunity, has_online_booking,
  has_online_ordering, has_digital_payments, social_media_presence,
  website_available, mobile_responsive, image_permissions, photo_url, logo_url, extra
)
SELECT
  b->>'business_id',
  coalesce(nullif(trim(b->>'name'),''), b->>'business_id'),
  nullif(b->>'category',''),
  nullif(b->>'subcategory',''),

  -- directory_category: mirrors category() in lib/model.ts
  CASE
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), ''))
         IN ('stay','eat','drink','explore','discover','wellness','shop','transport','essentials')
      THEN initcap(lower(coalesce(nullif(b->>'directory_category',''), b->>'category')))
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), '')) = 'accommodation'
      OR lower(coalesce(b->>'subcategory','')) ~ 'hotel|lodging|resort' THEN 'Stay'
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), '')) = 'food & beverage'
      THEN CASE WHEN lower(coalesce(b->>'subcategory','')) ~ 'coffee|cafe|caf.|bar|bakery|dessert'
                THEN 'Drink' ELSE 'Eat' END
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), '')) ~ 'tour|activit' THEN 'Explore'
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), '')) ~ 'attraction' THEN 'Discover'
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), '')) = 'transportation' THEN 'Transport'
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), '')) = 'wellness' THEN 'Wellness'
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), '')) = 'retail'
      THEN CASE WHEN lower(coalesce(b->>'subcategory','')) ~ 'pharmacy|convenience' THEN 'Essentials'
                WHEN lower(coalesce(b->>'subcategory','')) ~ 'fashion|arts_crafts|flowers_and_gifts|specialty_store|souvenir' THEN 'Shop'
                ELSE 'Other' END
    WHEN lower(coalesce(nullif(b->>'directory_category',''), nullif(b->>'category',''), '')) ~ 'health|medical' THEN 'Essentials'
    ELSE 'Other'
  END,

  -- destination: derived from the municipality, because the source value is
  -- effectively a constant ("Puerto Princesa" on 3,134 of 3,135 rows).
  CASE
    WHEN lower(trim(coalesce(b->>'municipality',''))) ~ '^(puerto princesa( city)?|puerto princessa city|ppc)$' THEN 'Puerto Princesa'
    WHEN lower(trim(coalesce(b->>'municipality',''))) LIKE 'el nido%'    THEN 'El Nido'
    WHEN lower(trim(coalesce(b->>'municipality',''))) LIKE 'san vicente%' THEN 'San Vicente'
    WHEN lower(trim(coalesce(b->>'municipality',''))) LIKE 'port barton%' THEN 'Port Barton'
    WHEN nullif(b->>'destination','') IS NOT NULL THEN b->>'destination'
  END,

  -- municipality: collapse the source spelling variants
  CASE
    WHEN nullif(trim(b->>'municipality'),'') IS NULL THEN NULL
    WHEN lower(trim(b->>'municipality')) ~ '^(puerto princesa( city)?|puerto princessa city|ppc)$' THEN 'Puerto Princesa City'
    WHEN lower(trim(b->>'municipality')) ~ '^(el nido|el nido,? palawan)$'   THEN 'El Nido'
    WHEN lower(trim(b->>'municipality')) ~ '^(san vicente|san vicente,? palawan)$' THEN 'San Vicente'
    WHEN lower(trim(b->>'municipality')) ~ '^(port barton|port barton,? palawan)$' THEN 'Port Barton'
    ELSE initcap(lower(trim(b->>'municipality')))
  END,

  nullif(trim(b->>'barangay'),''),
  nullif(trim(b->>'address'),''),
  lat, lon,
  CASE WHEN lat IS NOT NULL AND lon IS NOT NULL
        AND abs(lat) <= 90 AND abs(lon) <= 180
       THEN ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography END,
  nullif(trim(b->>'phone'),''),
  nullif(trim(b->>'email'),''),
  nullif(trim(b->>'website'),''),
  nullif(trim(b->>'facebook'),''),
  nullif(trim(b->>'instagram'),''),
  nullif(trim(b->>'whatsapp'),''),
  nullif(trim(b->>'description'),''),
  nullif(trim(b->>'opening_hours'),''),
  nullif(trim(b->>'amenities'),''),
  nullif(trim(b->>'services'),''),
  CASE WHEN lower(coalesce(b->>'editorial_status','')) IN ('imported','approved','published','archived')
       THEN lower(b->>'editorial_status') ELSE 'imported' END,
  coalesce(nullif(trim(b->>'operating_status'),''), 'unknown'),
  lower(coalesce(b->>'featured','')) IN ('true','yes','1'),
  nullif(b->>'source_url',''),
  nullif(b->>'source_id',''),
  nullif(b->>'license',''),
  CASE WHEN b->>'confidence' ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (b->>'confidence')::numeric END,
  CASE WHEN b->>'verification_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       THEN (b->>'verification_date')::date END,
  nullif(b->>'merqato_opportunity',''),
  CASE WHEN lower(b->>'has_online_booking')   IN ('true','yes','1','y') THEN true
       WHEN lower(b->>'has_online_booking')   IN ('false','no','0','n') THEN false END,
  CASE WHEN lower(b->>'has_online_ordering')  IN ('true','yes','1','y') THEN true
       WHEN lower(b->>'has_online_ordering')  IN ('false','no','0','n') THEN false END,
  CASE WHEN lower(b->>'has_digital_payments') IN ('true','yes','1','y') THEN true
       WHEN lower(b->>'has_digital_payments') IN ('false','no','0','n') THEN false END,
  nullif(b->>'social_media_presence',''),
  CASE WHEN lower(b->>'website_available')    IN ('true','yes','1','y') THEN true
       WHEN lower(b->>'website_available')    IN ('false','no','0','n') THEN false END,
  CASE WHEN lower(b->>'mobile_responsive')    IN ('true','yes','1','y') THEN true
       WHEN lower(b->>'mobile_responsive')    IN ('false','no','0','n') THEN false END,
  nullif(b->>'image_permissions',''),
  nullif(b->>'photo_url',''),
  nullif(b->>'logo_url',''),
  -- keep anything not modelled above instead of dropping it
  b - ARRAY[
    'business_id','name','category','directory_category','subcategory','destination',
    'municipality','barangay','address','latitude','longitude','phone','email','website',
    'facebook','instagram','whatsapp','description','opening_hours','amenities','services',
    'editorial_status','operating_status','featured','source_url','source_id','license',
    'confidence','verification_date','merqato_opportunity','has_online_booking',
    'has_online_ordering','has_digital_payments','social_media_presence',
    'website_available','mobile_responsive','image_permissions','photo_url','logo_url'
  ]::text[]
FROM src
ON CONFLICT (business_id) DO NOTHING;
