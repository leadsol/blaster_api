-- Migration: Add missing columns to campaigns table
-- Run this in your Supabase SQL Editor

-- 1. Add paused_at column (timestamp when campaign was paused)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ;

-- 2. Add estimated_duration column (total seconds to complete campaign)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER;

-- 3. Add new_list_name column (name for new contact list to create from campaign)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS new_list_name TEXT;

-- 4. Add existing_list_id column (reference to existing contact list)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS existing_list_id UUID REFERENCES contact_lists(id) ON DELETE SET NULL;

-- 5. Add multi_device column (use multiple WhatsApp devices for sending)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS multi_device BOOLEAN DEFAULT FALSE;

-- 6. Add device_ids column (array of connection IDs to use)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS device_ids TEXT[];

-- 7. Add message_variations column (array of message templates for variation)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS message_variations TEXT[];

-- 8. Add poll_question column (poll question text)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS poll_question TEXT;

-- 9. Add poll_options column (array of poll answer options)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS poll_options TEXT[];

-- 10. Add poll_multiple_answers column (allow multiple selections in poll)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS poll_multiple_answers BOOLEAN DEFAULT FALSE;

-- 11. Add pause_after_messages column (number of messages before auto-pause)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS pause_after_messages INTEGER;

-- 12. Add pause_seconds column (duration of auto-pause in seconds)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS pause_seconds INTEGER;

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'campaigns'
AND column_name IN (
  'paused_at',
  'estimated_duration',
  'new_list_name',
  'existing_list_id',
  'multi_device',
  'device_ids',
  'message_variations',
  'poll_question',
  'poll_options',
  'poll_multiple_answers',
  'pause_after_messages',
  'pause_seconds'
)
ORDER BY column_name;
