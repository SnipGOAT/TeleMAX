import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { searchProfiles, createDirectChat, createGroupChat } from '@/lib/chat';
import type { Profile } from '@/lib/types';
import { Avatar } from '@/components/Avatar';
import { X, Search, Users, User, Check, Loader2, ArrowLeft } from 'lucide-react';

interface NewChatModalProps {
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

export function NewChatModal({ onClose, onChatCreated }: NewChatModalProps) {
  const { profile } = useAuth();
  const [mode, setMode] = useState<'select' | 'direct' | 'group'>('select');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setSearch(query);
    if (query.trim().length < 1) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await searchProfiles(query, profile?.id);
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreateDirect = async (userId: string) => {
    if (!profile) return;
    setCreating(true);
    setError(null);
    try {
      const chat = await createDirectChat(profile.id, userId);
      if (chat) onChatCreated(chat.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create chat');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!profile || selectedUsers.size === 0 || !groupName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const chat = await createGroupChat(profile.id, groupName.trim(), Array.from(selectedUsers));
      if (chat) onChatCreated(chat.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col animate-scale-in relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
          {mode !== 'select' && (
            <button
              onClick={() => { setMode('select'); setSelectedUsers(new Set()); setSearch(''); setResults([]); }}
              className="glass-btn p-1.5 rounded-lg"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 className="font-semibold text-primary-c flex-1">
            {mode === 'select' ? 'New Chat' : mode === 'direct' ? 'New Direct Chat' : 'New Group'}
          </h2>
          <button onClick={onClose} className="glass-btn p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Mode select */}
        {mode === 'select' && (
          <div className="p-5 space-y-3">
            <button
              onClick={() => setMode('direct')}
              className="w-full glass-subtle rounded-2xl p-4 flex items-center gap-4 hover:glass transition-all text-left"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <User size={22} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-primary-c">Direct Chat</p>
                <p className="text-sm text-secondary-c">Start a private conversation</p>
              </div>
            </button>
            <button
              onClick={() => setMode('group')}
              className="w-full glass-subtle rounded-2xl p-4 flex items-center gap-4 hover:glass transition-all text-left"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary-400 to-secondary-600 flex items-center justify-center">
                <Users size={22} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-primary-c">Group Chat</p>
                <p className="text-sm text-secondary-c">Create a group with multiple people</p>
              </div>
            </button>
          </div>
        )}

        {/* Direct chat search */}
        {mode === 'direct' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 py-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-c" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {searching && (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-muted-c" />
                </div>
              )}
              {!searching && results.length > 0 && (
                results.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleCreateDirect(user.id)}
                    disabled={creating}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:glass-subtle transition-all text-left mb-1"
                  >
                    <Avatar profile={user} size={44} showOnline />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-primary-c truncate">
                        {user.full_name || user.username}
                      </p>
                      <p className="text-xs text-muted-c truncate">@{user.username}</p>
                    </div>
                  </button>
                ))
              )}
              {!searching && search && results.length === 0 && (
                <div className="text-center py-8 text-secondary-c text-sm">
                  No users found
                </div>
              )}
            </div>
          </div>
        )}

        {/* Group creation */}
        {mode === 'group' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 py-3 space-y-3">
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
              />
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-c" />
                <input
                  type="text"
                  placeholder="Add members by username..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="glass-input w-full pl-9 pr-4 py-2.5 rounded-xl text-sm"
                />
              </div>
            </div>

            {selectedUsers.size > 0 && (
              <div className="px-5 py-2 flex flex-wrap gap-2">
                {Array.from(selectedUsers).map((id) => {
                  const user = results.find((r) => r.id === id);
                  if (!user) return null;
                  return (
                    <div key={id} className="glass-subtle rounded-full px-3 py-1 flex items-center gap-2 text-xs">
                      {user.username}
                      <button onClick={() => toggleUser(id)} className="text-muted-c hover:text-error-500">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 pb-3">
              {searching && (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-muted-c" />
                </div>
              )}
              {!searching && results.length > 0 && (
                results.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:glass-subtle transition-all text-left mb-1"
                  >
                    <Avatar profile={user} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-primary-c truncate">
                        {user.full_name || user.username}
                      </p>
                      <p className="text-xs text-muted-c truncate">@{user.username}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                      ${selectedUsers.has(user.id) ? 'bg-primary-500 border-primary-500' : 'border-white/30'}`}>
                      {selectedUsers.has(user.id) && <Check size={14} className="text-white" />}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-white/10">
              {error && <p className="text-sm text-error-500 mb-2">{error}</p>}
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedUsers.size === 0 || creating}
                className="btn-primary w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                {creating && <Loader2 size={16} className="animate-spin" />}
                Create Group ({selectedUsers.size} members)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
