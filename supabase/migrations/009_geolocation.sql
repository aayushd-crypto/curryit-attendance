-- Store lat/lng on check-in
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS check_in_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS check_in_lng  DOUBLE PRECISION;

-- Geo settings table (one row per location)
CREATE TABLE IF NOT EXISTS geo_settings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location     TEXT NOT NULL UNIQUE CHECK (location IN ('office','cmk')),
  lat          DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng          DOUBLE PRECISION NOT NULL DEFAULT 0,
  radius_m     INT NOT NULL DEFAULT 200,
  enabled      BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default rows
INSERT INTO geo_settings (location, lat, lng, radius_m, enabled)
  VALUES ('office', 0, 0, 200, false), ('cmk', 0, 0, 200, false)
  ON CONFLICT (location) DO NOTHING;

-- RLS
ALTER TABLE geo_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_read_all"    ON geo_settings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "geo_manage_admin" ON geo_settings FOR ALL USING (get_my_role() IN ('super_admin','admin'));
