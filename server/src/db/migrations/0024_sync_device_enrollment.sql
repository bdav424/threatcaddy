CREATE TABLE sync_devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL DEFAULT 'Unknown Device',
  device_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'revoked')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  UNIQUE(user_id, device_fingerprint)
);

CREATE INDEX idx_sync_devices_user_id ON sync_devices(user_id);
