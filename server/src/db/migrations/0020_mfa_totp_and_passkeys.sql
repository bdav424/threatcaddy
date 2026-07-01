-- S8: MFA — TOTP and passkey support
-- TOTP secrets are stored AES-256-GCM encrypted (server-side TOTP_SECRET_KEY env var).
-- Backup codes are stored as argon2id hashes in a JSONB array.
-- Passkeys follow the WebAuthn/FIDO2 spec (public key + counter per credential).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret      TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS totp_backup_codes JSONB   NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS user_passkeys (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id  TEXT NOT NULL UNIQUE,
  public_key     TEXT NOT NULL,
  counter        INTEGER NOT NULL DEFAULT 0,
  device_type    TEXT,
  aaguid         TEXT,
  name           TEXT NOT NULL DEFAULT 'Passkey',
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON user_passkeys(user_id);
