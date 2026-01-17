-- Add is_active column to campaigns table
-- This controls whether the campaign should send messages at all
-- When false, campaign won't send even during active hours
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
