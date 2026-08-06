import { supabase } from '@/lib/supabase';
import type { Chat, ChatMember, Message, MessageReaction, Profile } from '@/lib/types';

export async function getUserProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function searchProfiles(query: string, excludeId?: string): Promise<Profile[]> {
  let q = supabase
    .from('profiles')
    .select('*')
    .ilike('username', `%${query}%`)
    .limit(20);

  if (excludeId) {
    q = q.neq('id', excludeId);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Profile[];
}

export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export interface ChatListItem {
  chat: Chat;
  lastMessage: Message | null;
  otherProfile: Profile | null;
  members: ChatMember[];
  unreadCount: number;
}

export async function getUserChats(userId: string): Promise<ChatListItem[]> {
  const { data: memberships, error: memberError } = await supabase
    .from('chat_members')
    .select('chat_id, last_read_at')
    .eq('user_id', userId);

  if (memberError) throw memberError;
  if (!memberships || memberships.length === 0) return [];

  const chatIds = memberships.map((m) => m.chat_id);
  const lastReadMap = new Map<string, string>();
  for (const m of memberships) {
    lastReadMap.set(m.chat_id, m.last_read_at || new Date(0).toISOString());
  }

  const { data: chats, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .in('id', chatIds)
    .order('updated_at', { ascending: false });

  if (chatError) throw chatError;
  if (!chats || chats.length === 0) return [];

  const { data: allMembers, error: membersError } = await supabase
    .from('chat_members')
    .select('*, profiles!inner(*)')
    .in('chat_id', chatIds);

  if (membersError) throw membersError;

  const { data: lastMessages, error: msgError } = await supabase
    .from('messages')
    .select('*')
    .in('chat_id', chatIds)
    .order('created_at', { ascending: false })
    .limit(1);

  if (msgError) throw msgError;

  const lastMessageMap = new Map<string, Message>();
  for (const msg of lastMessages || []) {
    if (!lastMessageMap.has(msg.chat_id)) {
      lastMessageMap.set(msg.chat_id, msg as Message);
    }
  }

  // Count unread messages per chat
  const { data: unreadCounts, error: unreadError } = await supabase
    .from('messages')
    .select('chat_id')
    .in('chat_id', chatIds)
    .neq('sender_id', userId)
    .is('deleted_at', null);

  const unreadMap = new Map<string, number>();
  if (!unreadError && unreadCounts) {
    for (const row of unreadCounts) {
      const chatId = row.chat_id;
      const lastRead = new Date(lastReadMap.get(chatId) || new Date(0)).getTime();
      // We need created_at for comparison, but the query above didn't include it
      // We'll use the lastMessage timestamp as approximation - actually let's get created_at
    }
  }

  // Better: fetch unread with created_at
  const { data: unreadMsgs } = await supabase
    .from('messages')
    .select('chat_id, created_at')
    .in('chat_id', chatIds)
    .neq('sender_id', userId)
    .is('deleted_at', null);

  if (unreadMsgs) {
    for (const row of unreadMsgs) {
      const lastRead = new Date(lastReadMap.get(row.chat_id) || new Date(0)).getTime();
      if (new Date(row.created_at).getTime() > lastRead) {
        unreadMap.set(row.chat_id, (unreadMap.get(row.chat_id) || 0) + 1);
      }
    }
  }

  return chats.map((chat) => {
    const chatData = chat as Chat;
    const members = (allMembers || []).filter((m) => m.chat_id === chatData.id);
    const otherMember = members.find((m) => m.user_id !== userId);
    const otherProfile = otherMember ? ((otherMember as any).profiles as Profile) : null;

    return {
      chat: chatData,
      lastMessage: lastMessageMap.get(chatData.id) || null,
      otherProfile: otherProfile || null,
      members: members as ChatMember[],
      unreadCount: unreadMap.get(chatData.id) || 0,
    };
  });
}

export async function getChatMessages(chatId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as Message[];
}

export async function getChatMembers(chatId: string): Promise<(ChatMember & { profiles: Profile })[]> {
  const { data, error } = await supabase
    .from('chat_members')
    .select('*, profiles!inner(*)')
    .eq('chat_id', chatId);

  if (error) throw error;
  return (data || []) as (ChatMember & { profiles: Profile })[];
}

export async function getMessageReactions(messageIds: string[]): Promise<Map<string, MessageReaction[]>> {
  if (messageIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .in('message_id', messageIds);

  if (error) throw error;
  const map = new Map<string, MessageReaction[]>();
  for (const r of data || []) {
    const arr = map.get(r.message_id) || [];
    arr.push(r as MessageReaction);
    map.set(r.message_id, arr);
  }
  return map;
}

export async function createDirectChat(
  currentUserId: string,
  otherUserId: string
): Promise<Chat | null> {
  const { data: existingMembers } = await supabase
    .from('chat_members')
    .select('chat_id, chats!inner(*)')
    .eq('user_id', currentUserId)
    .eq('chats.type', 'direct');

  if (existingMembers && existingMembers.length > 0) {
    for (const m of existingMembers) {
      const chatId = m.chat_id;
      const { data: otherMember } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', currentUserId)
        .maybeSingle();

      if (otherMember && otherMember.user_id === otherUserId) {
        return (m as any).chats as Chat;
      }
    }
  }

  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .insert({ type: 'direct', created_by: currentUserId })
    .select('*')
    .single();

  if (chatError) throw chatError;

  const chatData = chat as Chat;

  const { error: memberError } = await supabase.from('chat_members').insert([
    { chat_id: chatData.id, user_id: currentUserId, role: 'admin' },
    { chat_id: chatData.id, user_id: otherUserId, role: 'member' },
  ]);

  if (memberError) throw memberError;

  return chatData;
}

export async function createGroupChat(
  currentUserId: string,
  title: string,
  memberIds: string[]
): Promise<Chat | null> {
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .insert({ type: 'group', title, created_by: currentUserId })
    .select('*')
    .single();

  if (chatError) throw chatError;

  const chatData = chat as Chat;

  const members = [
    { chat_id: chatData.id, user_id: currentUserId, role: 'admin' as const },
    ...memberIds.map((id) => ({ chat_id: chatData.id, user_id: id, role: 'member' as const })),
  ];

  const { error: memberError } = await supabase.from('chat_members').insert(members);
  if (memberError) throw memberError;

  return chatData;
}

export async function sendMessage(chatId: string, content: string, replyToId?: string): Promise<void> {
  const insertData: Record<string, unknown> = {
    chat_id: chatId,
    content,
    message_type: 'text',
  };
  if (replyToId) {
    insertData.reply_to_id = replyToId;
  }

  const { error } = await supabase.from('messages').insert(insertData);
  if (error) throw error;
}

export async function editMessage(messageId: string, newContent: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ content: newContent, edited_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ content: '', deleted_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
}

export async function toggleReaction(messageId: string, userId: string, emoji: string): Promise<void> {
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from('message_reactions').delete().eq('id', existing.id);
  } else {
    await supabase.from('message_reactions').insert({
      message_id: messageId,
      user_id: userId,
      emoji,
    });
  }
}

export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('chat_id', chatId)
    .eq('user_id', userId);
  if (error) console.error('Failed to mark chat as read:', error);
}

export async function getOtherMemberLastRead(chatId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_members')
    .select('last_read_at')
    .eq('chat_id', chatId)
    .neq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  return data?.last_read_at || null;
}

export async function updateProfile(userId: string, updates: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}

export async function setOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_online: isOnline, last_seen: new Date().toISOString() })
    .eq('id', userId);
  if (error) console.error('Failed to update online status:', error);
}

// Typing indicator via realtime broadcast
export function subscribeToTyping(chatId: string, userId: string, onTyping: (typingUserId: string, isTyping: boolean) => void) {
  const channel = supabase.channel(`typing:${chatId}`);
  channel
    .on('broadcast', { event: 'typing' }, (payload: any) => {
      if (payload.payload?.userId !== userId) {
        onTyping(payload.payload.userId, payload.payload.isTyping);
      }
    })
    .subscribe();
  return channel;
}

export function broadcastTyping(chatId: string, userId: string, isTyping: boolean) {
  const channel = supabase.channel(`typing:${chatId}`);
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.send({ type: 'broadcast', event: 'typing', payload: { userId, isTyping } });
    }
  });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const daysAgo = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export function isSameDay(date1: string, date2: string): boolean {
  return new Date(date1).toDateString() === new Date(date2).toDateString();
}

export function formatLastSeen(dateStr: string, isOnline: boolean): string {
  if (isOnline) return 'online';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (mins < 1) return 'last seen just now';
  if (mins < 60) return `last seen ${mins}m ago`;
  if (hours < 24) return `last seen ${hours}h ago`;
  if (days < 7) return `last seen ${days}d ago`;
  return `last seen ${date.toLocaleDateString()}`;
}

export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
