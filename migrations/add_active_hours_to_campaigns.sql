-- Add active hours columns to campaigns table
-- This allows setting time range when messages can be sent (e.g., 9:00-18:00)

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS active_hours_start TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS active_hours_end TIME DEFAULT '18:00:00',
ADD COLUMN IF NOT EXISTS respect_active_hours BOOLEAN DEFAULT true;

COMMENT ON COLUMN campaigns.active_hours_start IS 'Start time for sending messages (e.g., 09:00:00)';
COMMENT ON COLUMN campaigns.active_hours_end IS 'End time for sending messages (e.g., 18:00:00)';
COMMENT ON COLUMN campaigns.respect_active_hours IS 'Whether to respect active hours when sending messages';
