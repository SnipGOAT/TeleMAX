import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { updateProfile } from '@/lib/chat';
import { Avatar } from '@/components/Avatar';
import { TelemaxLogo } from '@/components/TelemaxLogo';
import { X, Moon, Sun, LogOut, Check, Loader2, User, AtSign, MessageSquare, Info } from 'lucide-react';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { profile, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [status, setStatus] = useState(profile?.status || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await updateProfile(profile.id, {
        full_name: fullName,
        status,
        bio,
      });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="glass-strong rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col animate-scale-in relative z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="font-semibold text-primary-c text-lg">Settings</h2>
          <button onClick={onClose} className="glass-btn p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile section */}
          <div className="flex flex-col items-center px-5 py-6 border-b border-white/10">
            <Avatar profile={profile} size={88} showOnline />
            <p className="font-bold text-lg text-primary-c mt-3">{profile?.username}</p>
            <p className="text-sm text-secondary-c">{profile?.full_name || profile?.username}</p>
          </div>

          {/* Edit fields */}
          <div className="px-5 py-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-c mb-1.5 flex items-center gap-1.5">
                <User size={12} /> Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-c mb-1.5 flex items-center gap-1.5">
                <MessageSquare size={12} /> Status
              </label>
              <input
                type="text"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm"
                placeholder="Hey there! I am using TeleMAX."
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-c mb-1.5 flex items-center gap-1.5">
                <Info size={12} /> Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm resize-none"
                rows={3}
                placeholder="Tell something about yourself..."
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null}
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>

          {/* Appearance */}
          <div className="px-5 py-4 border-t border-white/10">
            <h3 className="text-xs font-semibold text-muted-c uppercase tracking-wider mb-3">Appearance</h3>
            <button
              onClick={toggleTheme}
              className="w-full glass-subtle rounded-xl p-3 flex items-center gap-3 hover:glass transition-all"
            >
              {theme === 'dark' ? <Moon size={20} className="text-primary-400" /> : <Sun size={20} className="text-accent-500" />}
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-primary-c">Theme</p>
                <p className="text-xs text-secondary-c">{theme === 'dark' ? 'Dark' : 'Light'} mode</p>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors ${theme === 'dark' ? 'bg-primary-500' : 'bg-white/30'} relative`}>
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${theme === 'dark' ? 'left-[22px]' : 'left-0.5'}`} />
              </div>
            </button>
          </div>

          {/* About */}
          <div className="px-5 py-4 border-t border-white/10">
            <h3 className="text-xs font-semibold text-muted-c uppercase tracking-wider mb-3">About</h3>
            <div className="flex items-center gap-3 mb-2">
              <TelemaxLogo size={32} />
              <div>
                <p className="text-sm font-semibold text-primary-c">TeleMAX</p>
                <p className="text-xs text-muted-c">Version 1.0.0</p>
              </div>
            </div>
            <p className="text-xs text-secondary-c leading-relaxed mt-2">
              A modern messenger with liquid glass design. Works across all your devices — iOS, Android, Windows, macOS, Linux, and web.
            </p>
          </div>

          {/* Sign out */}
          <div className="px-5 py-4 border-t border-white/10">
            <button
              onClick={signOut}
              className="w-full glass-subtle rounded-xl p-3 flex items-center gap-3 hover:bg-error-500/10 transition-all text-error-500"
            >
              <LogOut size={20} />
              <span className="text-sm font-semibold">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
