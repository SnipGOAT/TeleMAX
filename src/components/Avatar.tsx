import type { Profile } from '@/lib/types';
import { getInitials } from '@/lib/chat';

interface AvatarProps {
  profile?: Profile | null;
  name?: string;
  src?: string;
  size?: number;
  showOnline?: boolean;
  isOnline?: boolean;
}

const colorPairs = [
  ['#14a8a4', '#0d8a87'],
  ['#3470ff', '#1d52f5'],
  ['#ff6b4a', '#f32e0a'],
  ['#1bb577', '#0d9461'],
  ['#fbbf24', '#f59e0b'],
  ['#5990ff', '#3470ff'],
  ['#3fcc91', '#1bb577'],
  ['#ff9778', '#ff6b4a'],
];

function colorForName(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const pair = colorPairs[Math.abs(hash) % colorPairs.length];
  return [pair[0], pair[1]];
}

export function Avatar({ profile, name, src, size = 44, showOnline = false, isOnline }: AvatarProps) {
  const displayName = profile?.full_name || profile?.username || name || '?';
  const avatarSrc = profile?.avatar_url || src;
  const online = profile?.is_online ?? isOnline ?? false;
  const [c1, c2] = colorForName(displayName);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatarSrc ? (
        <img
          src={avatarSrc}
          alt={displayName}
          className="rounded-full object-cover w-full h-full"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-semibold text-white w-full h-full"
          style={{
            width: size,
            height: size,
            background: `linear-gradient(135deg, ${c1}, ${c2})`,
            fontSize: size * 0.36,
          }}
        >
          {getInitials(displayName)}
        </div>
      )}
      {showOnline && online && (
        <div
          className="absolute bottom-0 right-0 rounded-full bg-success-500 border-2 border-white dark:border-gray-800 pulse-ring"
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
