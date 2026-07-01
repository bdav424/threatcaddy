-- Migration 0022: make content columns nullable to support encrypted-only sync push.
-- When a client has a sync key active, it strips plaintext content and sends only
-- routing metadata + encryptedData. The server must accept NULLs for content fields.

ALTER TABLE notes ALTER COLUMN title DROP NOT NULL;
ALTER TABLE notes ALTER COLUMN content DROP NOT NULL;

ALTER TABLE tasks ALTER COLUMN title DROP NOT NULL;

ALTER TABLE folders ALTER COLUMN name DROP NOT NULL;

ALTER TABLE tags ALTER COLUMN name DROP NOT NULL;
ALTER TABLE tags ALTER COLUMN color DROP NOT NULL;

ALTER TABLE timeline_events ALTER COLUMN title DROP NOT NULL;
ALTER TABLE timeline_events ALTER COLUMN event_type DROP NOT NULL;
ALTER TABLE timeline_events ALTER COLUMN source DROP NOT NULL;

ALTER TABLE timelines ALTER COLUMN name DROP NOT NULL;

ALTER TABLE whiteboards ALTER COLUMN name DROP NOT NULL;
ALTER TABLE whiteboards ALTER COLUMN elements DROP NOT NULL;

ALTER TABLE standalone_iocs ALTER COLUMN type DROP NOT NULL;
ALTER TABLE standalone_iocs ALTER COLUMN value DROP NOT NULL;
ALTER TABLE standalone_iocs ALTER COLUMN confidence DROP NOT NULL;

ALTER TABLE chat_threads ALTER COLUMN title DROP NOT NULL;
ALTER TABLE chat_threads ALTER COLUMN messages DROP NOT NULL;
ALTER TABLE chat_threads ALTER COLUMN model DROP NOT NULL;
ALTER TABLE chat_threads ALTER COLUMN provider DROP NOT NULL;
