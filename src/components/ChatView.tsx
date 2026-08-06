import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getChatMessages,
  getChatMembers,
  sendMessage,
  editMessage,
  deleteMessage,
  toggleReaction,
  markChatAsRead,
  getOtherMemberLastRead,
  subscribeToTyping,
  broadcastTyping,
  formatTime,
  formatLastSeen,
  formatDateSeparator,
  isSameDay,
} from '@/lib/chat';
import type { Message, Profile, Chat, MessageReaction } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import {
  Send, ArrowLeft, Info, Phone, Video, Smile,
  Reply, Edit2, Trash2, Copy, Check, CheckCheck, X,
} from 'lucide-react';

interface ChatViewProps {
  chatId: string;
  chat?: Chat | null;
  otherProfile?: Profile | null;
  onBack: () => void;
  onOpenInfo: () => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👏'];
const EMOJI_PICKER_CATEGORIES: Record<string, string[]> = {
  Smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😒', '🙄', '😴', '🤤', '😪'],
  Gestures: ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '👏', '🙌', '🤝', '🙏', '✍️', '💪', '🦾', '🤳'],
  Hearts: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '💌'],
  Objects: ['🔥', '✨', '⭐', '🌟', '💫', '💥', '💢', '💦', '💨', '🎉', '🎊', '🎁', '🏆', '🥇', '🥈', '🥉', '🎖️', '🏅', '🎯', '💎', '💰', '📱', '💻', '⌨️', '🖥️', '📷', '🎬', '🎵', '🎶', '🎮'],
  Food: ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥗', '🥘', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦'],
  Animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌'],
};

export function ChatView({ chatId, chat, otherProfile, onBack, onOpenInfo }: ChatViewProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Map<string, MessageReaction[]>>(new Map());
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatName, setChatName] = useState('');
  const [chatAvatar, setChatAvatar] = useState<Profile | null>(null);
  const [isGroup, setIsGroup] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [otherLastRead, setOtherLastRead] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcast = useRef<number>(0);

  const loadMessages = useCallback(async () => {
    try {
      const data = await getChatMessages(chatId);
      setMessages(data);

      // Load reactions
      const validIds = data.filter((m) => !m.deleted_at).map((m) => m.id);
      if (validIds.length > 0) {
        const reactMap = await getMessageReactionsSafe(validIds);
        setReactions(reactMap);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  const loadChatInfo = useCallback(async () => {
    try {
      const members = await getChatMembers(chatId);
      setMemberCount(members.length);

      if (chat?.type === 'group') {
        setIsGroup(true);
        setChatName(chat.title || 'Group Chat');
      } else {
        setIsGroup(false);
        const other = members.find((m) => m.user_id !== profile?.id);
        if (other) {
          setChatName(other.profiles.full_name || other.profiles.username);
          setChatAvatar(other.profiles);
        } else if (otherProfile) {
          setChatName(otherProfile.full_name || otherProfile.username);
          setChatAvatar(otherProfile);
        }
      }
    } catch (err) {
      console.error('Failed to load chat info:', err);
    }
  }, [chatId, chat, profile, otherProfile]);

  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    loadMessages();
    loadChatInfo();
    markChatAsRead(chatId, profile!.id);
  }, [chatId]);

  // Realtime: messages
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          markChatAsRead(chatId, profile!.id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new as Message;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        async () => {
          const validIds = messages.filter((m) => !m.deleted_at).map((m) => m.id);
          if (validIds.length > 0) {
            const reactMap = await getMessageReactionsSafe(validIds);
            setReactions(reactMap);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  // Realtime: typing indicator
  useEffect(() => {
    if (!chatId || !profile) return;
    const channel = subscribeToTyping(chatId, profile.id, (typingUserId, isTyping) => {
      if (isTyping) {
        setTypingUser(typingUserId);
        setTimeout(() => setTypingUser(null), 3000);
      } else {
        setTypingUser(null);
      }
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, profile]);

  // Read receipts: poll other member's last_read_at
  useEffect(() => {
    if (!chatId || !profile || isGroup) return;
    const interval = setInterval(async () => {
      const lastRead = await getOtherMemberLastRead(chatId, profile.id);
      setOtherLastRead(lastRead);
    }, 3000);
    return () => clearInterval(interval);
  }, [chatId, profile, isGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleInputChange = (value: string) => {
    setInput(value);
    if (!profile || !chatId) return;
    const now = Date.now();
    if (now - lastTypingBroadcast.current > 2000) {
      lastTypingBroadcast.current = now;
      broadcastTyping(chatId, profile.id, true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(chatId, profile.id, false);
    }, 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const content = input.trim();
    const replyId = replyToMessage?.id;
    setInput('');
    setReplyToMessage(null);
    broadcastTyping(chatId, profile!.id, false);

    try {
      await sendMessage(chatId, content, replyId);
    } catch (err) {
      console.error('Failed to send message:', err);
      setInput(content);
      if (replyId) setReplyToMessage(messages.find((m) => m.id === replyId) || null);
    } finally {
      setSending(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, messageId: string) => {
    e.preventDefault();
    setContextMenu({ messageId, x: e.clientX, y: e.clientY });
  };

  const handleEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditingContent(message.content);
    setContextMenu(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return;
    try {
      await editMessage(editingMessageId, editingContent.trim());
      setMessages((prev) =>
        prev.map((m) =>
          m.id === editingMessageId
            ? { ...m, content: editingContent.trim(), edited_at: new Date().toISOString() }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleDelete = async (messageId: string) => {
    try {
      await deleteMessage(messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: '', deleted_at: new Date().toISOString() }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
    setContextMenu(null);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
    setContextMenu(null);
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
    setContextMenu(null);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!profile) return;
    try {
      await toggleReaction(messageId, profile.id, emoji);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
    setContextMenu(null);
  };

  const addEmojiToInput = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  const isOwnMessage = (msg: Message) => msg.sender_id === profile?.id;

  const isMessageRead = (msg: Message): boolean => {
    if (isGroup || !otherLastRead || !isOwnMessage(msg)) return false;
    return new Date(msg.created_at).getTime() <= new Date(otherLastRead).getTime();
  };

  const getMessageReactions = (messageId: string): MessageReaction[] => {
    return reactions.get(messageId) || [];
  };

  const groupedReactions = (messageId: string) => {
    const reacts = getMessageReactions(messageId);
    const map = new Map<string, { emoji: string; count: number; reactedByMe: boolean }>();
    for (const r of reacts) {
      const existing = map.get(r.emoji);
      if (existing) {
        existing.count++;
        if (r.user_id === profile?.id) existing.reactedByMe = true;
      } else {
        map.set(r.emoji, { emoji: r.emoji, count: 1, reactedByMe: r.user_id === profile?.id });
      }
    }
    return Array.from(map.values());
  };

  const typingDisplayName = () => {
    if (!typingUser || !chatAvatar) return 'Someone';
    return chatAvatar.full_name || chatAvatar.username;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="glass-strong border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="glass-btn p-2 rounded-lg md:hidden" aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
          <Avatar profile={chatAvatar} name={isGroup ? chatName : undefined} size={40} showOnline={!isGroup} />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm text-primary-c truncate">{chatName}</h2>
            <p className="text-xs text-muted-c truncate">
              {typingUser
                ? <span className="text-primary-400">typing...</span>
                : isGroup
                  ? `${memberCount} members`
                  : chatAvatar
                    ? formatLastSeen(chatAvatar.last_seen, chatAvatar.is_online)
                    : ''}
            </p>
          </div>
        </button>
        <div className="flex items-center gap-1">
          <button className="glass-btn p-2 rounded-lg" aria-label="Voice call">
            <Phone size={18} />
          </button>
          <button className="glass-btn p-2 rounded-lg" aria-label="Video call">
            <Video size={18} />
          </button>
          <button onClick={onOpenInfo} className="glass-btn p-2 rounded-lg" aria-label="Chat info">
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="glass-subtle rounded-2xl px-6 py-4">
              <Smile size={32} className="text-muted-c mx-auto mb-2" />
              <p className="text-secondary-c text-sm">No messages yet. Say hello!</p>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const own = isOwnMessage(msg);
            const prevMsg = messages[idx - 1];
            const showDateSep = !prevMsg || !isSameDay(prevMsg.created_at, msg.created_at);
            const showAvatar = !own && (!prevMsg || prevMsg.sender_id !== msg.sender_id || showDateSep);
            const isSameSender = prevMsg && prevMsg.sender_id === msg.sender_id && !showDateSep;
            const isDeleted = !!msg.deleted_at;
            const isEdited = !!msg.edited_at && !isDeleted;
            const read = isMessageRead(msg);
            const replyToMsg = msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null;
            const reacts = groupedReactions(msg.id);

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex justify-center my-4">
                    <span className="glass-subtle rounded-full px-3 py-1 text-xs text-secondary-c">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex items-end gap-2 ${own ? 'justify-end' : 'justify-start'} ${isSameSender ? 'mt-0.5' : 'mt-2'} animate-bubble-in`}
                >
                  {!own && (
                    <div className="w-7 shrink-0">
                      {showAvatar && <Avatar profile={chatAvatar} size={28} />}
                    </div>
                  )}
                  <div className={`max-w-[70%] relative group ${own ? 'items-end' : 'items-start'} flex flex-col`}>
                    {replyToMsg && !isDeleted && (
                      <div
                        className="mb-1 px-3 py-1.5 rounded-lg text-xs border-l-2 border-primary-400 max-w-full truncate"
                        style={{ background: 'var(--glass-bg-subtle)', color: 'var(--text-secondary)' }}
                      >
                        <span className="font-semibold">{replyToMsg.sender_id === profile?.id ? 'You' : (chatAvatar?.full_name || chatAvatar?.username || 'User')}</span>
                        {': '}
                        {replyToMsg.content || '(deleted)'}
                      </div>
                    )}
                    <div
                      onContextMenu={(e) => !isDeleted && handleContextMenu(e, msg.id)}
                      className={`px-3.5 py-2 rounded-2xl ${own ? 'rounded-br-md' : 'rounded-bl-md'} ${isSameSender ? 'mt-0' : ''} cursor-default`}
                      style={
                        own
                          ? { background: 'var(--bubble-sent)', color: 'var(--bubble-sent-text)' }
                          : { background: 'var(--bubble-received)', color: 'var(--bubble-received-text)' }
                      }
                    >
                      {isDeleted ? (
                        <p className="text-sm italic opacity-50">This message was deleted</p>
                      ) : editingMessageId === msg.id ? (
                        <div className="flex flex-col gap-1">
                          <input
                            type="text"
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') { setEditingMessageId(null); setEditingContent(''); }
                            }}
                            autoFocus
                            className="bg-white/20 rounded-lg px-2 py-1 text-sm outline-none"
                            style={{ color: 'var(--bubble-sent-text)' }}
                          />
                          <div className="flex gap-2">
                            <button onClick={handleSaveEdit} className="text-xs opacity-80 hover:opacity-100">Save</button>
                            <button onClick={() => { setEditingMessageId(null); setEditingContent(''); }} className="text-xs opacity-80 hover:opacity-100">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                      )}
                      {!isDeleted && editingMessageId !== msg.id && (
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          {isEdited && <span className="text-[10px] opacity-60 mr-1">edited</span>}
                          {own && !isGroup && (
                            read ? <CheckCheck size={13} className="opacity-80" /> : <Check size={13} className="opacity-50" />
                          )}
                          <span className={`text-[10px] ${own ? 'opacity-70' : 'opacity-50'}`}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Reactions */}
                    {reacts.length > 0 && !isDeleted && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${own ? 'justify-end' : 'justify-start'}`}>
                        {reacts.map((r) => (
                          <button
                            key={r.emoji}
                            onClick={() => handleReaction(msg.id, r.emoji)}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all ${
                              r.reactedByMe ? 'bg-primary-500/30 border border-primary-400/50' : 'glass-subtle'
                            }`}
                          >
                            <span>{r.emoji}</span>
                            <span className="text-muted-c">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Quick reaction bar on hover (non-deleted only) */}
                    {!isDeleted && editingMessageId !== msg.id && (
                      <div className={`absolute ${own ? 'right-0' : 'left-0'} -top-9 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5 glass-strong rounded-full px-1.5 py-1 z-10`}>
                        {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            className="hover:scale-125 transition-transform text-base px-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply preview bar */}
      {replyToMessage && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-3 animate-fade-in">
          <Reply size={16} className="text-primary-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary-c">
              Replying to {replyToMessage.sender_id === profile?.id ? 'yourself' : (chatAvatar?.full_name || chatAvatar?.username || 'user')}
            </p>
            <p className="text-xs text-muted-c truncate">{replyToMessage.content || '(deleted)'}</p>
          </div>
          <button onClick={() => setReplyToMessage(null)} className="glass-btn p-1.5 rounded-lg shrink-0">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="glass-strong border-t border-white/10 p-3 animate-fade-in max-h-48 overflow-y-auto">
          {Object.entries(EMOJI_PICKER_CATEGORIES).map(([category, emojis]) => (
            <div key={category} className="mb-2">
              <p className="text-xs text-muted-c mb-1 font-medium">{category}</p>
              <div className="flex flex-wrap gap-1">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => addEmojiToInput(emoji)}
                    className="text-xl hover:scale-125 transition-transform p-1 rounded-lg hover:glass-subtle"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="glass-strong border-t border-white/10 px-4 py-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="glass-btn p-2.5 rounded-xl shrink-0"
          aria-label="Emoji picker"
        >
          <Smile size={18} />
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => handleInputChange(e.target.value)}
          className="glass-input flex-1 px-4 py-2.5 rounded-xl text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary p-2.5 rounded-xl disabled:opacity-40 shrink-0"
          aria-label="Send message"
        >
          <Send size={18} />
        </button>
      </form>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed glass-strong rounded-xl py-1 z-50 animate-scale-in min-w-[160px]"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 180),
            top: Math.min(contextMenu.y, window.innerHeight - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {messages.find((m) => m.id === contextMenu.messageId)?.sender_id === profile?.id && (
            <>
              <MenuItem icon={Edit2} label="Edit" onClick={() => {
                const msg = messages.find((m) => m.id === contextMenu.messageId);
                if (msg) handleEdit(msg);
              }} />
              <MenuItem icon={Trash2} label="Delete" danger onClick={() => handleDelete(contextMenu.messageId)} />
            </>
          )}
          <MenuItem icon={Reply} label="Reply" onClick={() => {
            const msg = messages.find((m) => m.id === contextMenu.messageId);
            if (msg) handleReply(msg);
          }} />
          <MenuItem icon={Copy} label="Copy" onClick={() => {
            const msg = messages.find((m) => m.id === contextMenu.messageId);
            if (msg) handleCopy(msg.content);
          }} />
          <div className="border-t border-white/10 my-1" />
          <div className="px-3 py-1.5 flex gap-1 justify-center">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(contextMenu.messageId, emoji)}
                className="text-lg hover:scale-125 transition-transform p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Profile modal */}
      {showProfileModal && chatAvatar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowProfileModal(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="glass-strong rounded-3xl w-full max-w-xs p-6 flex flex-col items-center animate-scale-in relative z-10" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 glass-btn p-1.5 rounded-lg">
              <X size={16} />
            </button>
            <Avatar profile={chatAvatar} size={96} showOnline={!isGroup} />
            <h2 className="font-bold text-xl text-primary-c mt-4">{chatAvatar.full_name || chatAvatar.username}</h2>
            <p className="text-sm text-muted-c">@{chatAvatar.username}</p>
            {chatAvatar.status && (
              <p className="text-sm text-secondary-c mt-2 text-center italic">"{chatAvatar.status}"</p>
            )}
            {!isGroup && (
              <p className="text-xs text-muted-c mt-3">
                {formatLastSeen(chatAvatar.last_seen, chatAvatar.is_online)}
              </p>
            )}
            {chatAvatar.bio && (
              <div className="glass-subtle rounded-xl px-4 py-3 mt-4 w-full">
                <p className="text-xs text-muted-c mb-1">Bio</p>
                <p className="text-sm text-primary-c">{chatAvatar.bio}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 hover:glass-subtle text-sm transition-all ${danger ? 'text-error-500' : 'text-primary-c'}`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

async function getMessageReactionsSafe(messageIds: string[]): Promise<Map<string, MessageReaction[]>> {
  try {
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
  } catch {
    return new Map();
  }
}
