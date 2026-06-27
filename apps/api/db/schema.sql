-- Zumeet MVP Schema
-- All objects use CREATE ... IF NOT EXISTS for idempotency.
-- Safe to re-run on an existing database.

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('tenant', 'landlord');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE room_type AS ENUM ('suite', 'shared', 'whole_floor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM ('draft', 'active', 'paused', 'rented');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auth_provider AS ENUM ('email', 'google', 'facebook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE interest_actor_role AS ENUM ('tenant', 'landlord');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE interest_status AS ENUM ('active', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('active', 'unmatched', 'listing_rented');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE viewing_status AS ENUM ('confirmed', 'completed', 'cancelled', 'cancelled_landlord');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE viewing_attendance AS ENUM ('attended', 'absent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_level AS ENUM ('moderator', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE report_status AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE admin_action_type AS ENUM (
    'suspend_user', 'unsuspend_user', 'delete_user',
    'remove_listing', 'restore_listing',
    'resolve_report', 'dismiss_report'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                            TEXT PRIMARY KEY,
  email                         TEXT UNIQUE NOT NULL,
  name                          TEXT,
  avatar_url                    TEXT,
  is_verified                   BOOLEAN NOT NULL DEFAULT FALSE,
  verification_token            TEXT,
  verification_token_expires_at TIMESTAMPTZ,
  suspended_at                  TIMESTAMPTZ,
  deleted_at                    TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admins (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  level      admin_level NOT NULL DEFAULT 'super_admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_login_tokens (
  id         TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  action      admin_action_type NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS auth_identities (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      auth_provider NOT NULL,
  provider_uid  TEXT NOT NULL,
  password_hash TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE (provider, provider_uid)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
  id         TEXT PRIMARY KEY,
  city       TEXT NOT NULL,
  district   TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city, district)
);

CREATE TABLE IF NOT EXISTS tenant_profiles (
  id                           TEXT PRIMARY KEY,
  tenant_id                    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                         TEXT NOT NULL,
  budget_min                   INTEGER NOT NULL,
  budget_max                   INTEGER NOT NULL,
  preferred_room_types         room_type[] NOT NULL,
  available_from               TIMESTAMPTZ NOT NULL,
  min_lease_months             INTEGER NOT NULL,
  min_area_ping                NUMERIC(5,2),
  has_pets                     BOOLEAN NOT NULL,
  pet_description              TEXT,
  needs_subsidy                BOOLEAN NOT NULL,
  needs_tax_receipt            BOOLEAN NOT NULL,
  needs_household_registration BOOLEAN NOT NULL DEFAULT FALSE,
  needs_cooking                BOOLEAN NOT NULL DEFAULT FALSE,
  needs_parking                BOOLEAN NOT NULL DEFAULT FALSE,
  smoking                      BOOLEAN NOT NULL,
  occupation                   TEXT,
  age                          INTEGER,
  description                  TEXT,
  preferences                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact_info                 TEXT NOT NULL,
  is_active                    BOOLEAN NOT NULL DEFAULT TRUE,
  notification_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  last_notified_at             TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                   TIMESTAMPTZ,
  CHECK (array_length(preferred_room_types, 1) > 0)
);

CREATE TABLE IF NOT EXISTS tenant_profile_locations (
  tenant_profile_id TEXT NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  location_id       TEXT NOT NULL REFERENCES locations(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  PRIMARY KEY (tenant_profile_id, location_id)
);

CREATE TABLE IF NOT EXISTS listings (
  id                           TEXT PRIMARY KEY,
  landlord_id                  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id                  TEXT NOT NULL REFERENCES locations(id),
  name                         TEXT,
  rent                         INTEGER NOT NULL,
  room_type                    room_type NOT NULL,
  area_ping                    NUMERIC(5,2) NOT NULL,
  available_from               TIMESTAMPTZ NOT NULL,
  min_lease_months             INTEGER NOT NULL,
  allow_pets                   BOOLEAN NOT NULL,
  allow_subsidy                BOOLEAN NOT NULL,
  allow_tax_receipt            BOOLEAN NOT NULL,
  allow_household_registration BOOLEAN NOT NULL DEFAULT FALSE,
  allow_cooking                BOOLEAN NOT NULL DEFAULT FALSE,
  has_parking                  BOOLEAN NOT NULL DEFAULT FALSE,
  allow_smoking                BOOLEAN NOT NULL,
  description                  TEXT,
  attributes                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  contact_info                 TEXT NOT NULL,
  lat                          DOUBLE PRECISION,
  lng                          DOUBLE PRECISION,
  compliance_confirmed_at      TIMESTAMPTZ NOT NULL,
  status                       listing_status NOT NULL DEFAULT 'draft',
  admin_removed_at             TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS listing_photos (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  public_url  TEXT NOT NULL,
  position    INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS interests (
  id                TEXT PRIMARY KEY,
  tenant_profile_id TEXT NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  listing_id        TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  actor_role        interest_actor_role NOT NULL,
  status            interest_status NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  withdrawn_at      TIMESTAMPTZ,
  deleted_at        TIMESTAMPTZ,
  UNIQUE (tenant_profile_id, listing_id, actor_role)
);

CREATE TABLE IF NOT EXISTS matches (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_profile_id TEXT NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  landlord_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id        TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  matched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status            match_status NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE (tenant_profile_id, listing_id)
);

-- A viewing (帶看) is booked by the tenant after a tenant_profile ↔ listing match is
-- formed, by picking an open slot. It introduces no new contact-disclosure path:
-- contact/address are still revealed only via the underlying active match.
CREATE TABLE IF NOT EXISTS viewings (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_profile_id TEXT NOT NULL REFERENCES tenant_profiles(id) ON DELETE CASCADE,
  landlord_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id        TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  match_id          TEXT REFERENCES matches(id) ON DELETE CASCADE,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  status            viewing_status NOT NULL DEFAULT 'confirmed',
  attendance        viewing_attendance,
  landlord_notes    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS reports (
  id              TEXT PRIMARY KEY,
  reporter_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id      TEXT REFERENCES listings(id) ON DELETE SET NULL,
  reason          TEXT NOT NULL,
  status          report_status NOT NULL DEFAULT 'pending',
  handled_by      TEXT REFERENCES admins(id) ON DELETE SET NULL,
  handled_at      TIMESTAMPTZ,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (blocker_id, blocked_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tenant_profiles_tenant_id   ON tenant_profiles (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_profiles_is_active   ON tenant_profiles (is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_profile_locations_loc ON tenant_profile_locations (location_id);
CREATE INDEX IF NOT EXISTS idx_listings_location_id        ON listings (location_id);
CREATE INDEX IF NOT EXISTS idx_listings_room_type          ON listings (room_type);
CREATE INDEX IF NOT EXISTS idx_listings_area_ping          ON listings (area_ping);
CREATE INDEX IF NOT EXISTS idx_listings_available_from     ON listings (available_from);
CREATE INDEX IF NOT EXISTS idx_listings_status             ON listings (status);
CREATE INDEX IF NOT EXISTS idx_listings_landlord_id        ON listings (landlord_id);
CREATE INDEX IF NOT EXISTS idx_listing_photos_listing_id   ON listing_photos (listing_id);
CREATE INDEX IF NOT EXISTS idx_interests_tenant_profile_id ON interests (tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_interests_listing_id        ON interests (listing_id);
CREATE INDEX IF NOT EXISTS idx_interests_tp_listing_status ON interests (tenant_profile_id, listing_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_tenant_id           ON matches (tenant_id);
CREATE INDEX IF NOT EXISTS idx_matches_tenant_profile_id   ON matches (tenant_profile_id);
CREATE INDEX IF NOT EXISTS idx_matches_landlord_id         ON matches (landlord_id);
CREATE INDEX IF NOT EXISTS idx_matches_listing_id          ON matches (listing_id);
CREATE INDEX IF NOT EXISTS idx_matches_status              ON matches (status);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id           ON blocks (blocked_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id      ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id     ON auth_identities (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_login_tokens_admin_id ON admin_login_tokens (admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target        ON admin_actions (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status              ON reports (status);

CREATE INDEX IF NOT EXISTS idx_users_suspended_at
  ON users (suspended_at) WHERE suspended_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at
  ON users (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_admin_removed_at
  ON listings (admin_removed_at) WHERE admin_removed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_deleted_at
  ON listings (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_profiles_deleted_at
  ON tenant_profiles (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_deleted_at
  ON matches (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_viewings_tenant_id   ON viewings (tenant_id);
CREATE INDEX IF NOT EXISTS idx_viewings_landlord_id ON viewings (landlord_id);
CREATE INDEX IF NOT EXISTS idx_viewings_listing_id  ON viewings (listing_id);
-- A slot may be booked by up to slot_capacity groups (團體帶看), so the count of active
-- viewings per (listing_id, starts_at) is what matters — this index serves that count.
DROP INDEX IF EXISTS idx_viewings_listing_slot_active;
CREATE INDEX IF NOT EXISTS idx_viewings_listing_slot
  ON viewings (listing_id, starts_at) WHERE deleted_at IS NULL AND status IN ('confirmed', 'completed');
-- One active viewing per match: a matched tenant cannot double-book the same listing.
CREATE UNIQUE INDEX IF NOT EXISTS idx_viewings_match_active
  ON viewings (match_id) WHERE deleted_at IS NULL AND status IN ('confirmed', 'completed');

-- Active listing_photos: position must be unique per listing (soft-deleted positions can be reused)
CREATE UNIQUE INDEX IF NOT EXISTS idx_listing_photos_position_active
  ON listing_photos (listing_id, position) WHERE deleted_at IS NULL;

-- Idempotent migrations for new columns (safe to run on existing DBs)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE tenant_profiles ADD COLUMN IF NOT EXISTS age INTEGER;

-- Google profile fields captured at login (safe to run on existing DBs)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE listings ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE listings ADD COLUMN IF NOT EXISTS management_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS num_bedrooms SMALLINT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS num_living_rooms SMALLINT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS num_bathrooms SMALLINT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS num_balconies SMALLINT;

-- 帶看 (viewing) feature columns (safe to run on existing DBs)
ALTER TABLE listings  ADD COLUMN IF NOT EXISTS viewing_availability JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Viewings are now booked post-match by the tenant, not pre-proposed at interest time.
ALTER TABLE interests DROP COLUMN IF EXISTS proposed_slot_start;

CREATE TABLE IF NOT EXISTS geocode_cache (
  address    TEXT PRIMARY KEY,
  lat        DOUBLE PRECISION NOT NULL,
  lng        DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
