-- LeadSol Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Connections (WhatsApp sessions)
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  phone_number TEXT,
  display_name TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting', 'qr_pending')),
  first_connected_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact Lists
CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  contact_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  variables JSONB DEFAULT '{}',
  is_blacklisted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  list_id UUID REFERENCES contact_lists(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  message_template TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'document', 'audio')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  delay_min INTEGER DEFAULT 3,
  delay_max INTEGER DEFAULT 10,
  pause_after_messages INTEGER,
  pause_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add pause columns to campaigns (run this if table already exists)
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS pause_after_messages INTEGER;
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS pause_seconds INTEGER;

-- Migration: Add list columns to campaigns (run this if table already exists)
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS new_list_name TEXT;
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS existing_list_id UUID REFERENCES contact_lists(id) ON DELETE SET NULL;

-- Migration: Add multi-device columns to campaigns (run this if table already exists)
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS multi_device BOOLEAN DEFAULT FALSE;
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS device_ids UUID[] DEFAULT '{}';

-- Migration: Add message variations columns to campaigns (run this if table already exists)
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS message_variations TEXT[] DEFAULT '{}';

-- Migration: Add poll columns to campaigns (run this if table already exists)
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS poll_question TEXT;
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS poll_options TEXT[];
-- ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS poll_multiple_answers BOOLEAN DEFAULT FALSE;

-- Campaign Messages
CREATE TABLE IF NOT EXISTS campaign_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  name TEXT,
  message_content TEXT NOT NULL,
  sent_message_content TEXT, -- The actual message that was sent (after variation selection)
  sender_session_name TEXT, -- The session name that sent this message
  sender_phone TEXT, -- The phone number of the sender
  variables JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'cancelled')),
  waha_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migration: Add variables column to campaign_messages (run this if table already exists)
-- ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS variables JSONB DEFAULT '{}';

-- Migration: Make contact_id nullable (run this if table already exists)
-- ALTER TABLE campaign_messages ALTER COLUMN contact_id DROP NOT NULL;
-- ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS name TEXT;

-- Migration: Add sender info columns to campaign_messages (run this if table already exists)
-- ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS sent_message_content TEXT;

-- Migration: Add scheduled timing columns to campaign_messages
-- Run this SQL to add the scheduled_delay_seconds column:
ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS scheduled_delay_seconds INTEGER DEFAULT 0;
-- ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS scheduled_send_at TIMESTAMPTZ;
-- ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS sender_session_name TEXT;
-- ALTER TABLE campaign_messages ADD COLUMN IF NOT EXISTS sender_phone TEXT;

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  waha_message_id TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  from_me BOOLEAN NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  ack INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled Messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id UUID NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  chat_id TEXT NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blacklist
CREATE TABLE IF NOT EXISTS blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('message', 'campaign', 'connection', 'system', 'alert')),
  title TEXT NOT NULL,
  description TEXT,
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('technical', 'billing', 'feature', 'other')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  attachments TEXT[], -- Array of file URLs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_contact_lists_user_id ON contact_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_campaign_id ON campaign_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_messages_status ON campaign_messages(status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_id ON scheduled_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_status ON scheduled_messages(status);
CREATE INDEX IF NOT EXISTS idx_blacklist_user_id ON blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);

-- Row Level Security (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: Users can only access their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Connections: Users can only access their own connections
CREATE POLICY "Users can view own connections" ON connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own connections" ON connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own connections" ON connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own connections" ON connections FOR DELETE USING (auth.uid() = user_id);

-- Contact Lists: Users can only access their own lists
CREATE POLICY "Users can view own contact lists" ON contact_lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own contact lists" ON contact_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contact lists" ON contact_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contact lists" ON contact_lists FOR DELETE USING (auth.uid() = user_id);

-- Contacts: Users can access contacts in their lists
CREATE POLICY "Users can view contacts in own lists" ON contacts FOR SELECT USING (
  EXISTS (SELECT 1 FROM contact_lists WHERE contact_lists.id = contacts.list_id AND contact_lists.user_id = auth.uid())
);
CREATE POLICY "Users can create contacts in own lists" ON contacts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM contact_lists WHERE contact_lists.id = contacts.list_id AND contact_lists.user_id = auth.uid())
);
CREATE POLICY "Users can update contacts in own lists" ON contacts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM contact_lists WHERE contact_lists.id = contacts.list_id AND contact_lists.user_id = auth.uid())
);
CREATE POLICY "Users can delete contacts in own lists" ON contacts FOR DELETE USING (
  EXISTS (SELECT 1 FROM contact_lists WHERE contact_lists.id = contacts.list_id AND contact_lists.user_id = auth.uid())
);

-- Campaigns: Users can only access their own campaigns
CREATE POLICY "Users can view own campaigns" ON campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own campaigns" ON campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON campaigns FOR DELETE USING (auth.uid() = user_id);

-- Campaign Messages: Users can access messages from their campaigns
CREATE POLICY "Users can view own campaign messages" ON campaign_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_messages.campaign_id AND campaigns.user_id = auth.uid())
);
CREATE POLICY "Users can create own campaign messages" ON campaign_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_messages.campaign_id AND campaigns.user_id = auth.uid())
);
CREATE POLICY "Users can update own campaign messages" ON campaign_messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_messages.campaign_id AND campaigns.user_id = auth.uid())
);
CREATE POLICY "Users can delete own campaign messages" ON campaign_messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_messages.campaign_id AND campaigns.user_id = auth.uid())
);

-- Chat Messages: Users can only access their own chat messages
CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own chat messages" ON chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat messages" ON chat_messages FOR UPDATE USING (auth.uid() = user_id);

-- Scheduled Messages: Users can only access their own scheduled messages
CREATE POLICY "Users can view own scheduled messages" ON scheduled_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own scheduled messages" ON scheduled_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scheduled messages" ON scheduled_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scheduled messages" ON scheduled_messages FOR DELETE USING (auth.uid() = user_id);

-- Blacklist: Users can only access their own blacklist
CREATE POLICY "Users can view own blacklist" ON blacklist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own blacklist" ON blacklist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own blacklist" ON blacklist FOR DELETE USING (auth.uid() = user_id);

-- Notifications: Users can only access their own notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- Support Tickets: Users can only access their own tickets
CREATE POLICY "Users can view own support tickets" ON support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own support tickets" ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own support tickets" ON support_tickets FOR UPDATE USING (auth.uid() = user_id);

-- Global Session Counter (for WAHA session names: LEADSOL1, LEADSOL2, etc.)
-- This counter is shared across ALL users and only increments
CREATE TABLE IF NOT EXISTS global_counters (
  id TEXT PRIMARY KEY,
  current_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial counter for WAHA sessions
INSERT INTO global_counters (id, current_value) VALUES ('waha_session', 0) ON CONFLICT (id) DO NOTHING;

-- Allow all authenticated users to read/update counters (needed for atomic increment)
ALTER TABLE global_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view counters" ON global_counters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update counters" ON global_counters FOR UPDATE TO authenticated USING (true);

-- Function to atomically get next session number
CREATE OR REPLACE FUNCTION get_next_session_number()
RETURNS INTEGER AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE global_counters
  SET current_value = current_value + 1, updated_at = NOW()
  WHERE id = 'waha_session'
  RETURNING current_value INTO next_val;
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

-- Functions and Triggers

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contact_lists_updated_at BEFORE UPDATE ON contact_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-update contact count in lists
CREATE OR REPLACE FUNCTION update_contact_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE contact_lists SET contact_count = contact_count + 1 WHERE id = NEW.list_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE contact_lists SET contact_count = contact_count - 1 WHERE id = OLD.list_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_count_on_insert AFTER INSERT ON contacts FOR EACH ROW EXECUTE FUNCTION update_contact_count();
CREATE TRIGGER update_contact_count_on_delete AFTER DELETE ON contacts FOR EACH ROW EXECUTE FUNCTION update_contact_count();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- STORAGE BUCKET POLICIES
-- =====================================================
-- IMPORTANT: Run these commands in Supabase SQL Editor

-- Step 1: Make sure the bucket exists and is public
-- Go to Supabase Dashboard > Storage > Create new bucket named 'leadsol_storage' with Public access

-- Step 2: Delete any existing policies for this bucket (run these first if policies exist)
-- DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
-- DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
-- DROP POLICY IF EXISTS "Public read access for campaign media" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
-- DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;

-- Step 3: Create new policies
-- Path structure: campaigns/USER_ID/MEDIA_TYPE/FILENAME
-- Example: campaigns/abc123-def456/audio/file.ogg

-- Simple policy: authenticated users can upload to this bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'leadsol_storage');

-- Authenticated users can view files in this bucket
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'leadsol_storage');

-- Authenticated users can update files in this bucket
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'leadsol_storage');

-- Authenticated users can delete files in this bucket
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'leadsol_storage');

-- Public can read files (needed for WAHA to access media URLs)
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'leadsol_storage');
