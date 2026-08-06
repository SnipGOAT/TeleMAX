export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  status: string;
  is_online: boolean;
  last_seen: string;
  created_at: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  title: string;
  avatar_url: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'admin' | 'member';
  joined_at: string;
  last_read_at?: string | null;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'system';
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_id?: string | null;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface ChatWithDetails extends Chat {
  members?: ChatMember[];
  last_message?: Message | null;
  other_profile?: Profile | null;
}

export interface MessageWithMeta extends Message {
  reactions?: MessageReaction[];
  reply_to?: Message | null;
  sender_profile?: Profile | null;
}
