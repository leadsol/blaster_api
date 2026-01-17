-- Create list_history table for tracking actions on contact lists
CREATE TABLE IF NOT EXISTS list_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('campaign', 'contacts_added', 'contacts_removed', 'name_changed', 'duplicated', 'exported', 'imported')),
  description TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_list_history_list_id ON list_history(list_id);
CREATE INDEX IF NOT EXISTS idx_list_history_user_id ON list_history(user_id);
CREATE INDEX IF NOT EXISTS idx_list_history_created_at ON list_history(created_at DESC);

-- Enable RLS
ALTER TABLE list_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own list history"
  ON list_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own list history"
  ON list_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own list history"
  ON list_history FOR DELETE
  USING (auth.uid() = user_id);
