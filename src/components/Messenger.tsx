import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { getUserChats, type ChatListItem } from '@/lib/chat';
import { ChatSidebar } from '@/components/ChatSidebar';
import { ChatView } from '@/components/ChatView';
import { NewChatModal } from '@/components/NewChatModal';
import { SettingsPanel } from '@/components/SettingsPanel';
import { TelemaxLogo } from '@/components/TelemaxLogo';
import { MessageCircle } from 'lucide-react';
import type { Chat, Profile } from '@/lib/types';

export function Messenger() {
  const { profile } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [otherProfile, setOtherProfile] = useState<Profile | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  const handleSelectChat = async (chatId: string) => {
    setSelectedChatId(chatId);
    setMobileView('chat');

    // Fetch chat details
    try {
      const chats = await getUserChats(profile!.id);
      const item = chats.find((c: ChatListItem) => c.chat.id === chatId);
      if (item) {
        setSelectedChat(item.chat);
        setOtherProfile(item.otherProfile);
      }
    } catch (err) {
      console.error('Failed to load chat details:', err);
    }
  };

  const handleNewChatCreated = (chatId: string) => {
    setShowNewChat(false);
    handleSelectChat(chatId);
  };

  const handleBack = () => {
    setMobileView('list');
    setSelectedChatId(null);
  };

  return (
    <div className="relative z-10 h-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 shrink-0 ${mobileView === 'chat' ? 'hidden md:block' : 'block'}`}>
        <ChatSidebar
          selectedChatId={selectedChatId}
          onSelectChat={handleSelectChat}
          onNewChat={() => setShowNewChat(true)}
          onOpenSettings={() => setShowSettings(true)}
        />
      </div>

      {/* Chat area */}
      <div className={`flex-1 ${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-col`}>
        {selectedChatId ? (
          <ChatView
            chatId={selectedChatId}
            chat={selectedChat}
            otherProfile={otherProfile}
            onBack={handleBack}
            onOpenInfo={() => setShowSettings(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="glass-subtle rounded-3xl px-10 py-8 flex flex-col items-center text-center max-w-sm">
              <TelemaxLogo size={64} />
              <h2 className="text-xl font-bold text-primary-c mt-4">Welcome to TeleMAX</h2>
              <p className="text-sm text-secondary-c mt-2">
                Select a conversation or start a new one to begin messaging.
              </p>
              <button
                onClick={() => setShowNewChat(true)}
                className="btn-primary mt-6 px-6 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
              >
                <MessageCircle size={16} /> Start New Chat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onChatCreated={handleNewChatCreated}
        />
      )}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
