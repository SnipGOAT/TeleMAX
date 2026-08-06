/*
# TeleMAX Messenger Schema

1. New Tables
- `profiles`: user profiles extending auth.users (username, full_name, avatar_url, bio, status)
- `chats`: conversation containers (direct or group)
- `chat_members`: many-to-many membership between users and chats
- `messages`: individual messages within chats

2. Security
- RLS enabled on all tables.
- profiles: users can read all profiles, update only their own.
- chats: users can read/insert/update/delete chats they are a member of (via chat_members check).
- chat_members: users can read memberships for chats they belong to; insert/delete only for chats they belong to.
- messages: users can read/insert/delete messages in chats they belong to.

3. Realtime
- Enabled on `messages`, `chat_members`, and `chats` tables for live updates.
*/

-- Create all tables first (policies added after all tables exist)

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  avatar_url text DEFAULT '',
  bio text DEFAULT '',
  status text DEFAULT 'Hey there! I am using TeleMAX.',
  is_online boolean DEFAULT false,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  title text DEFAULT '',
  avatar_url text DEFAULT '',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- Chats policies (membership checked via chat_members)
DROP POLICY IF EXISTS "chats_select_member" ON chats;
CREATE POLICY "chats_select_member" ON chats FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "chats_insert_member" ON chats;
CREATE POLICY "chats_insert_member" ON chats FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "chats_update_member" ON chats;
CREATE POLICY "chats_update_member" ON chats FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "chats_delete_member" ON chats;
CREATE POLICY "chats_delete_member" ON chats FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid())
  );

-- Chat members policies
DROP POLICY IF EXISTS "chat_members_select_member" ON chat_members;
CREATE POLICY "chat_members_select_member" ON chat_members FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members cm2 WHERE cm2.chat_id = chat_members.chat_id AND cm2.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "chat_members_insert_member" ON chat_members;
CREATE POLICY "chat_members_insert_member" ON chat_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_members cm2 WHERE cm2.chat_id = chat_members.chat_id AND cm2.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "chat_members_update_member" ON chat_members;
CREATE POLICY "chat_members_update_member" ON chat_members FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members cm2 WHERE cm2.chat_id = chat_members.chat_id AND cm2.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM chat_members cm2 WHERE cm2.chat_id = chat_members.chat_id AND cm2.user_id = auth.uid()));

DROP POLICY IF EXISTS "chat_members_delete_member" ON chat_members;
CREATE POLICY "chat_members_delete_member" ON chat_members FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members cm2 WHERE cm2.chat_id = chat_members.chat_id AND cm2.user_id = auth.uid())
  );

-- Messages policies
DROP POLICY IF EXISTS "messages_select_member" ON messages;
CREATE POLICY "messages_select_member" ON messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_insert_member" ON messages;
CREATE POLICY "messages_insert_member" ON messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "messages_update_member" ON messages;
CREATE POLICY "messages_update_member" ON messages FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()));

DROP POLICY IF EXISTS "messages_delete_member" ON messages;
CREATE POLICY "messages_delete_member" ON messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;

-- Trigger to update chats.updated_at on new message
CREATE OR REPLACE FUNCTION update_chat_timestamp()
RETURNS trigger AS $$
BEGIN
  UPDATE chats SET updated_at = now() WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_chat_timestamp ON messages;
CREATE TRIGGER trigger_update_chat_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_chat_timestamp();
