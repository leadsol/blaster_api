-- Add error_message column to campaigns table
-- This allows storing error messages when campaigns fail

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add index for faster filtering of failed campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_status_error
ON campaigns(status) WHERE error_message IS NOT NULL;
