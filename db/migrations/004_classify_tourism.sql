-- 004 — classify every business into a real directory tab
--
-- Before this, 886 of 3,135 records fell into 'Other', which the frontend has
-- no tab for: they were only visible under "All". The UI also already had a
-- "Services" chip that could never fill, because category() never returned it.
--
-- Tourism categories lead; local services are kept (the full business register
-- is retained) but sit last, as a minor section.
--
-- Result: 0 records in 'Other'.
--   Eat 675 · Stay 596 · Services 559 · Shop 428 · Explore 415 · Drink 234 · Wellness 228
--
-- Applied to Neon on 2026-11-26.

ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_directory_category_check;

ALTER TABLE businesses ADD CONSTRAINT businesses_directory_category_check
  CHECK (directory_category IN
    ('Stay','Eat','Drink','Explore','Discover','Wellness',
     'Shop','Transport','Essentials','Services','Other'));

UPDATE businesses
SET directory_category = CASE
      WHEN category = 'Accommodation' THEN 'Stay'
      WHEN subcategory IN ('restaurant','casual_eatery','food_and_beverage_store') THEN 'Eat'
      WHEN subcategory IN ('coffee_shop','cafe','bar') THEN 'Drink'
      WHEN category = 'Tours & Activities' THEN 'Explore'
      WHEN subcategory IN ('travel_service','rental_service','event_or_party_service') THEN 'Explore'
      WHEN category = 'Wellness' THEN 'Wellness'
      WHEN subcategory = 'personal_or_beauty_service' THEN 'Wellness'
      WHEN subcategory IN ('pharmacy_and_drug_store','convenience_store') THEN 'Shop'
      WHEN category = 'Retail' THEN 'Shop'
      ELSE 'Services'
    END,
    updated_at = now();

INSERT INTO schema_migrations (version, note)
VALUES ('004_classify_tourism',
        'map all 3135 records into Stay/Eat/Drink/Explore/Discover/Wellness/Shop/Services; Other now 0')
ON CONFLICT (version) DO NOTHING;
