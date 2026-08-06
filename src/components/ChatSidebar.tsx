import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { supabase } from '@/lib/supabase';
import { getUserChats, formatTime, type ChatListItem } from '@/lib/chat';
import { Avatar } from '@/components/Avatar';
import { TelemaxLogo } from '@/components/TelemaxLogo';
import { Search, Plus, Settings, Moon, Sun, LogOut, MessageCircle, Users, X } from 'lucide-react';

interface SidebarProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
}

export function ChatSidebar({ selectedChatId, onSelectChat, onNewChat, onOpenSettings }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!profile) return;
    loadChats();
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('chat_list_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, () => {
        loadChats();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => {
        loadChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const loadChats = async () => {
    if (!profile) return;
    try {
      const data = await getUserChats(profile.id);
      setChats(data);
    } catch (err) {
      console.error('Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredChats = chats.filter((item) => {
    if (!search) return true;
    const name = item.chat.type === 'direct'
      ? item.otherProfile?.full_name || item.otherProfile?.username || ''
      : item.chat.title;
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const getChatName = (item: ChatListItem) =>
    item.chat.type === 'direct'
      ? item.otherProfile?.full_name || item.otherProfile?.username || 'Unknown'
      : item.chat.title || 'Group Chat';

  return (
    <div className="flex flex-col h-full glass-strong border-r border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <TelemaxLogo size={32} />
          <span className="font-bold text-lg text-primary-c tracking-tight">TeleMAX</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="glass-btn p-2 rounded-lg"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            onClick={onNewChat}
            className="btn-primary p-2 rounded-lg"
            aria-label="New chat"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-c" />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <MessageCircle size={40} className="text-muted-c mb-3" />
            <p className="text-secondary-c text-sm">
              {search ? 'No chats found' : 'No conversations yet'}
            </p>
            {!search && (
              <button
                onClick={onNewChat}
                className="mt-4 glass-btn px-4 py-2 rounded-lg text-sm flex items-center gap-2"
              >
                <Plus size={16} /> Start a chat
              </button>
            )}
          </div>
        ) : (
          filteredChats.map((item) => (
            <button
              key={item.chat.id}
              onClick={() => onSelectChat(item.chat.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 mb-1 text-left
                ${selectedChatId === item.chat.id
                  ? 'glass-subtle border border-primary-400/30'
                  : 'hover:glass-subtle'
                }`}
            >
              <Avatar
                profile={item.chat.type === 'direct' ? item.otherProfile : undefined}
                name={item.chat.type === 'group' ? item.chat.title : undefined}
                size={48}
                showOnline={item.chat.type === 'direct'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-primary-c truncate">
                    {getChatName(item)}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {item.unreadCount > 0 && selectedChatId !== item.chat.id && (
                      <span className="bg-primary-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {item.unreadCount > 99 ? '99+' : item.unreadCount}
                      </span>
                    )}
                    {item.lastMessage && (
                      <span className="text-xs text-muted-c">
                        {formatTime(item.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-secondary-c truncate mt-0.5">
                    {item.lastMessage
                      ? item.lastMessage.deleted_at
                        ? <span className="italic opacity-50">This message was deleted</span>
                        : item.lastMessage.sender_id === profile?.id
                          ? `You: ${item.lastMessage.content}`
                          : item.lastMessage.content
                      : 'No messages yet'}
                  </p>
                  {item.unreadCount > 0 && selectedChatId !== item.chat.id && (
                    <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* User profile bar */}
      <div className="relative px-4 py-3 border-t border-white/10">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full flex items-center gap-3 hover:glass-subtle rounded-xl p-2 transition-all"
        >
          <Avatar profile={profile} size={36} showOnline />
          <div className="flex-1 text-left min-w-0">
            <p className="font-semibold text-sm text-primary-c truncate">
              {profile?.full_name || profile?.username}
            </p>
            <p className="text-xs text-muted-c truncate">{profile?.status}</p>
          </div>
          <Settings size={18} className="text-muted-c" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute bottom-16 left-4 right-4 glass-strong rounded-xl p-2 z-20 animate-scale-in">
              <button
                onClick={() => { setMenuOpen(false); onOpenSettings(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:glass-subtle text-sm text-primary-c transition-all"
              >
                <Settings size={18} /> Settings & Profile
              </button>
              <button
                onClick={() => { setMenuOpen(false); toggleTheme(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:glass-subtle text-sm text-primary-c transition-all"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                {theme === 'dark' ? 'Light theme' : 'Dark theme'}
              </button>
              <button
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:glass-subtle text-sm text-error-500 transition-all"
              >
                <LogOut size={18} /> Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
