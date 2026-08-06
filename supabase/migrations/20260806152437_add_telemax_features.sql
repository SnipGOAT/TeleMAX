/*
# TeleMAX Feature Migration: Editing, Replies, Read Receipts, Reactions

1. Modified Tables
- `messages`: add `edited_at` (timestamp, nullable), `deleted_at` (timestamp, nullable), `reply_to_id` (uuid, nullable, self-referencing FK)
- `chat_members`: add `last_read_at` (timestamp, default epoch) for unread count tracking

2. New Tables
- `message_reactions`: stores emoji reactions per message per user
  - `id` (uuid PK)
  - `message_id` (uuid FK to messages, cascade delete)
  - `user_id` (uuid FK to profiles, cascade delete)
  - `emoji` (text, not null)
  - `created_at` (timestamp)
  - Unique constraint on (message_id, user_id, emoji)

3. Security
- RLS enabled on `message_reactions`.
- Users can read reactions for messages in chats they belong to.
- Users can insert/update/delete their own reactions.
- Existing table policies unchanged; new columns inherit existing RLS.

4. Realtime
- `message_reactions` added to supabase_realtime publication.
*/

-- Add columns to messages
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES messages(id) ON DELETE SET NULL;

-- Add last_read_at to chat_members
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS last_read_at timestamptz DEFAULT to_timestamp(0);

-- Create message_reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select_member" ON message_reactions;
CREATE POLICY "reactions_select_member" ON message_reactions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.chat_id = (
        SELECT messages.chat_id FROM messages WHERE messages.id = message_reactions.message_id
      )
      AND chat_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reactions_insert_own" ON message_reactions;
CREATE POLICY "reactions_insert_own" ON message_reactions FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_members.chat_id = (
        SELECT messages.chat_id FROM messages WHERE messages.id = message_reactions.message_id
      )
      AND chat_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reactions_delete_own" ON message_reactions;
CREATE POLICY "reactions_delete_own" ON message_reactions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);

-- Add reactions to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
