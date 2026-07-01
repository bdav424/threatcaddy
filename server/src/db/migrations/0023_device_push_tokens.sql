-- Device push tokens for mobile push notifications (S-mobile step 6)
-- Stores FCM (Android) or APNs (iOS) tokens per user device.
-- Tokens are scoped to a user; on delete cascade ensures cleanup on account removal.

CREATE TABLE IF NOT EXISTS device_push_tokens (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON device_push_tokens (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_token ON device_push_tokens (user_id, token);
