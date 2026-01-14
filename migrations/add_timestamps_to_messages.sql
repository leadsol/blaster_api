-- Add timestamp columns to campaign_messages table
-- This migration adds failed_at column to track when messages fail

-- Add failed_at column
ALTER TABLE campaign_messages
ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

-- Create index on failed_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_campaign_messages_failed_at
ON campaign_messages(failed_at DESC NULLS LAST);

-- Create composite index for sorting by activity (sent or failed)
CREATE INDEX IF NOT EXISTS idx_campaign_messages_activity
ON campaign_messages(campaign_id, sent_at DESC NULLS LAST, failed_at DESC NULLS LAST);

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'campaign_messages'
AND column_name IN ('sent_at', 'failed_at')
ORDER BY column_name;
