-- bot_configs source tracking: distinguishes manually-created bots from
-- bots auto-created server-side from a client AgentProfile/AgentDeployment.

ALTER TABLE "bot_configs" ADD COLUMN IF NOT EXISTS "source_type" text NOT NULL DEFAULT 'manual';
ALTER TABLE "bot_configs" ADD COLUMN IF NOT EXISTS "source_deployment_id" text;

CREATE INDEX IF NOT EXISTS idx_bot_configs_source_type ON bot_configs (source_type);
