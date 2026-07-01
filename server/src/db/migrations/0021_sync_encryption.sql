-- S-mobile: always-encrypted sync
--
-- Adds per-account key salt to users, and an encrypted_data column to every
-- entity table the sync engine touches. When a client has encryption enabled
-- it stores the full entity ciphertext in encrypted_data and leaves the content
-- columns as empty strings / nulls; the server never needs to decrypt.
--
-- Existing content columns are kept so that non-encrypted accounts (team sync
-- without personal encryption) continue working without a migration. The server
-- passes encrypted_data through opaquely; the client checks it on pull and
-- decrypts if present, otherwise falls back to plaintext columns.

-- Per-account sync key salt: generated once by the first device to set up
-- encryption, saved here, returned in login responses so all devices can
-- independently derive the same AES-256-GCM key from the account password.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sync_key_salt TEXT;

-- Encrypted entity ciphertext columns (one per synced table)
ALTER TABLE notes           ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
ALTER TABLE tasks           ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
ALTER TABLE folders         ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
ALTER TABLE tags            ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
ALTER TABLE timelines       ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
ALTER TABLE whiteboards     ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
ALTER TABLE standalone_iocs ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
ALTER TABLE chat_threads    ADD COLUMN IF NOT EXISTS encrypted_data TEXT;
