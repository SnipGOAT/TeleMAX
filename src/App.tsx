import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Auth from './Auth';
import STRINGS from './strings';

type Reactions = Record<string, number>;

type Message = {
  id?: string;
  chatName?: string;
  author: string;
  text: string;
  type: 'in' | 'out' | 'system';
  image?: string;
  sticker?: string;
  replyTo?: string;
  reactions?: Reactions;
  edited?: boolean;
  time?: string;
};

type Chat = {
  name: string;
  message: string;
  time: string;
  avatar: string;
  status: string;
  muted?: boolean;
  pinned?: boolean;
  unread?: number;
  archived?: boolean;
};

const stickers = ['🎉', '💬', '✨', '🔥', '🌈', '💎', '🚀'];

function App() {
  const [user, setUser] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>({});
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Отключено');
  const [notification, setNotification] = useState('Выберите чат или напишите сообщение.');
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'profile' | 'notifications' | 'appearance'>('appearance');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [compactView, setCompactView] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [typing, setTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [userName, setUserName] = useState('TeleMAX');
  const [userStatusText, setUserStatusText] = useState('Онлайн');
  const [mobilePanel, setMobilePanel] = useState<'chats' | 'chat'>('chat');
  const [newChatIndex, setNewChatIndex] = useState(1);
  const isDark = theme === 'dark';
  const socketRef = useRef<WebSocket | null>(null);
  const selectedChatRef = useRef<Chat | null>(selectedChat);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const quickReplies = ['👍 Отлично!', 'Сейчас посмотрю', 'Спасибо!', 'Хорошо', 'Понял', 'Через минуту', 'Давай позже'];

  useEffect(() => {
    selectedChatRef.current = selectedChat;
  }, [selectedChat]);

  const requireSelectedChat = () => {
    if (!selectedChat) {
      setNotification('Пожалуйста, выберите чат или создайте новый.');
      return null;
    }
    return selectedChat;
  };

  // Простой эффект: когда есть сокет, слушаем 'typing' события
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const handler = (evt: MessageEvent) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload?.type === 'typing' && payload.author !== user) {
          setOtherTyping(true);
          setTimeout(() => setOtherTyping(false), 1200);
        }
        if (payload?.type === 'history' && Array.isArray(payload.data)) {
          setChatMessages((prev) => ({ ...prev, [selectedChatRef.current.name]: payload.data }));
        }
      } catch (e) {
        // ignore
      }
    };
    socket.addEventListener('message', handler as any);
    return () => socket.removeEventListener('message', handler as any);
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const storedTheme = localStorage.getItem('telemax-theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
    }

    const storedAuth = localStorage.getItem('telemax-auth');
    if (storedAuth) {
      try {
        const data = JSON.parse(storedAuth);
        if (data?.name) {
          setUser(data.name);
          setUserName(data.name);
        }
      } catch {
        localStorage.removeItem('telemax-auth');
      }
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('telemax-auth');
    setUser(null);
    setUserName('TeleMAX');
    setNotification('Вы вышли из TeleMAX.');
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    const socket = new WebSocket('ws://127.0.0.1:4001');
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('Подключено');
      setNotification('WebSocket-соединение установлено.');
      const chatName = selectedChatRef.current?.name;
      if (chatName) {
        setChatMessages((prev) => ({
          ...prev,
          [chatName]: [
            ...(prev[chatName] || []),
            { author: 'TeleMAX', text: 'Соединение установлено.', type: 'system' },
          ],
        }));
      }
    };

    socket.onmessage = (event) => {
      const raw = JSON.parse(event.data) as any;
      const chatName = raw.chatName || selectedChatRef.current?.name || 'Общий';
      const reactions = typeof raw.reactions === 'string' && raw.reactions ? JSON.parse(raw.reactions) : raw.reactions;
      const normalized: Message = {
        ...raw,
        reactions,
      };
      setChatMessages((prev) => ({
        ...prev,
        [chatName]: [...(prev[chatName] || []), normalized],
      }));
    };

    socket.onclose = () => {
      setStatus('Отключено');
      setNotification('Связь потеряна. Попробуйте обновить сервер.');
    };

    socket.onerror = () => {
      setStatus('Ошибка');
      setNotification('Ошибка соединения с сервером.');
    };

    return () => {
      socket.close();
    };
  }, []);

  const visibleChats = useMemo(() => {
    const filtered = chats.filter((chat) => !chat.archived && chat.name.toLowerCase().includes(search.toLowerCase()));
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.unread || 0) - (a.unread || 0);
    });
  }, [search, chats]);

  const currentMessages = selectedChat ? chatMessages[selectedChat.name] || [] : [];
  const filteredMessages = useMemo(
    () => currentMessages.filter((message) => message.text.toLowerCase().includes(messageSearch.toLowerCase())),
    [currentMessages, messageSearch],
  );

  useEffect(() => {
    if (!autoScroll || !messageListRef.current) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [filteredMessages, autoScroll]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('telemax-theme', next);
      return next;
    });
  };

  const sendTypingSignal = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'typing', author: user }));
    }
  };

  const toggleMuteChat = () => {
    const chat = requireSelectedChat();
    if (!chat) return;
    const nextMuted = !chat.muted;
    setChats((prev) => prev.map((item) => item.name === chat.name ? { ...item, muted: nextMuted } : item));
    setSelectedChat((prev) => (prev ? { ...prev, muted: nextMuted } : prev));
    setNotification(`Звук ${nextMuted ? 'выключен' : 'включён'} для ${chat.name}.`);
  };

  const togglePinChat = () => {
    const chat = requireSelectedChat();
    if (!chat) return;
    const nextPinned = !chat.pinned;
    setChats((prev) => prev.map((item) => item.name === chat.name ? { ...item, pinned: nextPinned } : item));
    setSelectedChat((prev) => (prev ? { ...prev, pinned: nextPinned } : prev));
    setNotification(`${nextPinned ? 'Закреплен' : 'Откреплен'} чат ${chat.name}.`);
  };

  const archiveChat = () => {
    const chat = requireSelectedChat();
    if (!chat) return;
    setChats((prev) => prev.map((item) => item.name === chat.name ? { ...item, archived: true } : item));
    setSelectedChat(null);
    setNotification(`Чат с ${chat.name} перемещён в архив.`);
    setMobilePanel('chats');
  };

  const toggleChatInfo = () => {
    setShowChatInfo((prev) => !prev);
  };

  const clearChatHistory = () => {
    const chat = requireSelectedChat();
    if (!chat) return;
    setChatMessages((prev) => ({ ...prev, [chat.name]: [] }));
    setNotification(`История переписки с ${chat.name} очищена.`);
  };

  const handleNewChat = () => {
    const name = `Новый чат ${newChatIndex}`;
    const nextChat: Chat = {
      name,
      message: 'Начните переписку с новым контактом.',
      time: 'Сейчас',
      avatar: `Н${newChatIndex}`,
      status: 'Онлайн',
      muted: false,
      pinned: false,
      unread: 0,
    };

    setChats((prev) => [nextChat, ...prev]);
    setSelectedChat(nextChat);
    setNotification('Новый чат создан. Напишите первое сообщение!');
    setNewChatIndex((count) => count + 1);
    setMobilePanel('chat');
  };

  const themeIcon = useMemo(
    () => (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {isDark ? (
          <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z" />
        ) : (
          <g>
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2" />
            <path d="M12 21v2" />
            <path d="M4.22 4.22l1.42 1.42" />
            <path d="M18.36 18.36l1.42 1.42" />
            <path d="M1 12h2" />
            <path d="M21 12h2" />
            <path d="M4.22 19.78l1.42-1.42" />
            <path d="M18.36 5.64l1.42-1.42" />
          </g>
        )}
      </svg>
    ),
    [isDark],
  );

  const markChatRead = () => {
    const chat = requireSelectedChat();
    if (!chat) return;
    setChats((prev) => prev.map((item) => item.name === chat.name ? { ...item, unread: 0 } : item));
    setSelectedChat((prev) => (prev ? { ...prev, unread: 0 } : prev));
    setNotification(`Все сообщения в ${chat.name} отмечены как прочитанные.`);
  };

  const handleSearchMessages = (value: string) => {
    setMessageSearch(value);
  };

  const sendQuickReply = (text: string) => {
    setDraft(text);
    setNotification('Быстрый ответ готов. Нажмите Отправить.');
  };

  const toggleCompactView = () => {
    setCompactView((prev) => {
      const next = !prev;
      setNotification(`Компактный режим ${next ? 'включен' : 'выключен'}.`);
      return next;
    });
  };

  const toggleAutoScroll = () => {
    setAutoScroll((prev) => {
      const next = !prev;
      setNotification(`Автопрокрутка ${next ? 'включена' : 'выключена'}.`);
      return next;
    });
  };

  const selectReplyTarget = (message: Message) => {
    if (message.type !== 'system') {
      setReplyTarget(message);
      setNotification(`Ответ к сообщению: «${message.text.slice(0, 28)}...»`);
    }
  };

  const cancelReply = () => {
    setReplyTarget(null);
    setNotification('Режим ответа отменён.');
  };

  const sendMessage = () => {
    const chat = requireSelectedChat();
    if (!chat) return;
    const trimmed = draft.trim();
    if (!trimmed && !attachedImage) {
      return;
    }

    const outgoing: Message = {
      author: userName || 'Я',
      text: trimmed || (attachedImage ? 'Фото отправлено' : 'Стикер'),
      type: 'out',
      image: attachedImage || undefined,
      replyTo: replyTarget?.text,
      chatName: chat.name,
    };

    setChatMessages((prev) => ({
      ...prev,
      [chat.name]: [...(prev[chat.name] || []), outgoing],
    }));
    setDraft('');
    setAttachedImage(null);
    setAttachedImageName('');
    setShowStickerPicker(false);
    setReplyTarget(null);
    if (autoScroll && messageListRef.current) {
      setTimeout(() => {
        messageListRef.current?.scrollTo({ top: messageListRef.current.scrollHeight, behavior: 'smooth' });
      }, 20);
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(outgoing));
      setNotification(`Сообщение отправлено в ${selectedChat.name}.`);
    } else {
      setNotification('Сервер недоступен. Сообщение сохранено локально.');
    }
  };

  const addReaction = (msgIndex: number, emoji = '❤️') => {
    const chat = requireSelectedChat();
    if (!chat) return;
    setChatMessages((prev) => {
      const list = [...(prev[chat.name] || [])];
      const msg = { ...list[msgIndex] } as Message;
      msg.reactions = { ...(msg.reactions || {}) };
      msg.reactions[emoji] = (msg.reactions[emoji] || 0) + 1;
      list[msgIndex] = msg;
      return { ...prev, [chat.name]: list };
    });
  };

  const editMessage = (index: number, newText: string) => {
    const chat = requireSelectedChat();
    if (!chat) return;
    setChatMessages((prev) => {
      const list = [...(prev[chat.name] || [])];
      const msg = { ...list[index] } as Message;
      if (msg.author === 'Я') {
        msg.text = newText;
        msg.edited = true;
        list[index] = msg;
      }
      return { ...prev, [chat.name]: list };
    });
  };

  const deleteMessage = (index: number) => {
    const chat = requireSelectedChat();
    if (!chat) return;
    setChatMessages((prev) => {
      const list = [...(prev[chat.name] || [])];
      list.splice(index, 1);
      return { ...prev, [chat.name]: list };
    });
  };

  const exportChat = () => {
    const chat = requireSelectedChat();
    if (!chat) return;
    const data = chatMessages[chat.name] || [];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.name.replace(/\s+/g, '_')}_chat.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNotification('Чат экспортирован.');
  };

  const handleAction = (label: string) => {
    if (label === 'Настройки чата') {
      setShowSettings(true);
      return;
    }

    setNotification(`${label} скоро будет доступна в TeleMAX.`);
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setChats((prev) => prev.map((item) => item.name === chat.name ? { ...item, unread: 0 } : item));
    setNotification(`Открыт чат с ${chat.name}.`);
    setMobilePanel('chat');
  };

  const handleAttachImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
      setAttachedImageName(file.name);
      setNotification('Изображение добавлено. Нажмите отправить для отправки.');
    };
    reader.readAsDataURL(file);
  };

  const handleSendSticker = (sticker: string) => {
    const chat = requireSelectedChat();
    if (!chat) return;
    const outgoing: Message = {
      author: userName || 'Я',
      text: sticker,
      type: 'out',
      sticker,
      replyTo: replyTarget?.text,
      chatName: chat.name,
    };

    setChatMessages((prev) => ({
      ...prev,
      [selectedChat.name]: [...(prev[selectedChat.name] || []), outgoing],
    }));
    setShowStickerPicker(false);
    setReplyTarget(null);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(outgoing));
    }
    setNotification(`Стикер отправлен в ${chat.name}.`);
  };

  const closeSettings = () => setShowSettings(false);

  if (!user) {
    return (
      <div className="app-shell">
        <Auth onLogin={(name) => {
          setUser(name);
          setUserName(name);
        }} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className={`app-grid ${mobilePanel === 'chats' ? 'mobile-chat-list' : ''}`}>
        <aside className="sidebar glass-panel">
          <div className="brand">
            <div className="brand-icon">T</div>
            <div>
              <h1>{userName}</h1>
              <p>{userStatusText}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span className="status-pill">{status}</span>
              <button className="secondary small" onClick={logout}>Выйти</button>
            </div>
          </div>

          <button className="theme-toggle" onClick={toggleTheme}>
            {themeIcon}
            <span>{isDark ? 'Светлая тема' : 'Тёмная тема'}</span>
          </button>

          <div className="sidebar-toolbar">
            <label className="search-box">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск контактов"
              />
            </label>
            <button className="new-chat-button" onClick={handleNewChat}>Новый чат</button>
          </div>

          <div className="contacts-card">
            <div className="contacts-card-header">
              <h2>Чаты</h2>
              <span>{visibleChats.length} контактов</span>
            </div>
            <div className="contact-list">
              {visibleChats.length === 0 ? (
                <div className="empty-sidebar-state">
                  <p>Чатов пока нет. Нажмите «Новый чат», чтобы начать диалог.</p>
                </div>
              ) : (
                visibleChats.map((chat) => (
                  <button
                    key={chat.name}
                    className={`contact-item ${selectedChat?.name === chat.name ? 'active' : ''}`}
                    onClick={() => handleSelectChat(chat)}
                  >
                    <div className="contact-avatar">{chat.avatar}</div>
                    <div className="contact-info">
                      <strong>{chat.name}</strong>
                      <p>{chat.message}</p>
                    </div>
                    <div className="contact-meta">
                      {chat.pinned && <span className="chat-badge">📌</span>}
                      {chat.unread ? <span className="chat-badge unread">{chat.unread}</span> : null}
                      <span>{chat.time}</span>
                    </div>
                  </button>
                ))))}
            </div>
          </div>
        </aside>

        <main className="conversation glass-panel">
          <div className="mobile-header">
            <button className="mobile-back" onClick={() => setMobilePanel('chats')}>Чаты</button>
            <span className="mobile-title">Чат</span>
          </div>

          {!selectedChat ? (
            <div className="empty-chat-state">
              <h2>Нет открытого чата</h2>
              <p>Выберите контакт слева или создайте новый чат, чтобы начать общение.</p>
              <button className="new-chat-button" onClick={handleNewChat}>Создать чат</button>
            </div>
          ) : (
            <>
              <header className="conversation-header">
                <div className="conversation-user">
                  <div className="conversation-avatar">{selectedChat.avatar}</div>
                  <div>
                    <strong>{selectedChat.name}</strong>
                    <span>{otherTyping ? 'печатает...' : selectedChat.status}</span>
                  </div>
                </div>

                <div className="header-actions">
              <button onClick={() => handleAction('Голосовой звонок')} aria-label="Звонок" title="Голосовой звонок">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.86 19.86 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.86 19.86 0 01-3.07-8.63A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.94.3 1.85.55 2.72a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.36-1.36a2 2 0 012.11-.45c.87.25 1.78.43 2.72.55A2 2 0 0122 16.92z" />
                </svg>
              </button>
              <button onClick={() => handleAction('Видеозвонок')} aria-label="Видео" title="Видеозвонок">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </button>
              <button onClick={togglePinChat} aria-label="Закрепить чат" title={selectedChat.pinned ? 'Открепить чат' : 'Закрепить чат'}>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7l3-7z" />
                </svg>
              </button>
              <button onClick={exportChat} aria-label="Экспорт" title="Экспортировать чат">
                ⤓
              </button>
              <button onClick={toggleChatInfo} aria-label="Информация" title="Информация о чате">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
              <button onClick={archiveChat} aria-label="Архив" title="Архивировать чат">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5 9V5a2 2 0 012-2h10a2 2 0 012 2v4" />
                  <path d="M12 15v6" />
                </svg>
              </button>
              <button onClick={() => handleAction('Настройки чата')} aria-label="Настройки" title="Открыть настройки чата">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                </svg>
              </button>
            </div>
          </header>

          {showChatInfo && selectedChat && (
            <div className="chat-info-panel">
              <h3>Информация о чате</h3>
              <p><strong>Контакт:</strong> {selectedChat.name}</p>
              <p><strong>Статус:</strong> {selectedChat.status}</p>
              <p><strong>Закреплён:</strong> {selectedChat.pinned ? 'Да' : 'Нет'}</p>
              <p><strong>Отключен звук:</strong> {selectedChat.muted ? 'Да' : 'Нет'}</p>
              <p><strong>Непрочитано:</strong> {selectedChat.unread || 0}</p>
            </div>
          )}
          <div className="notification-banner">{notification}</div>

          {selectedChat && (
            <>
              <div className="conversation-actions">
                <input
                  className="search-box"
                  value={messageSearch}
                  onChange={(event) => handleSearchMessages(event.target.value)}
                  placeholder="Искать в текущем чате"
                />
                <div className="chat-action-controls">
                  <button className="glass-btn" onClick={markChatRead}>Пометить прочитанным</button>
                  <button className="glass-btn" onClick={clearChatHistory}>Очистить чат</button>
                  <button className="glass-btn" onClick={toggleMuteChat}>{selectedChat.muted ? 'Включить звук' : 'Отключить звук'}</button>
                </div>
              </div>

              <div ref={messageListRef} className={`message-list ${compactView ? 'compact' : ''}`}>
            {filteredMessages.map((message, index) => {
              const origIndex = currentMessages.indexOf(message);
              return (
                <div key={index} className={`message-row ${message.type}`}>
                  <div className="message-bubble" onClick={() => selectReplyTarget(message)}>
                    {message.replyTo && <div className="reply-snippet">Ответ на: {message.replyTo}</div>}
                    <p>{message.text}{message.edited ? ' (изменено)' : ''}</p>
                    {message.image && <img src={message.image} alt="Прикрепленное изображение" />}
                    {message.sticker && <div className="sticker-bubble">{message.sticker}</div>}
                    {message.type !== 'system' && <span className="message-author">{message.author}</span>}
                    <div className="message-actions">
                      <button className="glass-btn" onClick={() => addReaction(origIndex)}>❤️</button>
                      {message.author === 'Я' && (
                        <>
                          <button className="glass-btn" onClick={() => {
                            const value = prompt('Редактировать сообщение', message.text);
                            if (value !== null) editMessage(origIndex, value);
                          }}>✏️</button>
                          <button className="glass-btn" onClick={() => { if (confirm('Удалить сообщение?')) deleteMessage(origIndex); }}>🗑️</button>
                        </>
                      )}
                    </div>
                    {message.reactions && (
                      <div className="reactions-bar">
                        {Object.entries(message.reactions).map(([emoji, count]) => (
                          <span key={emoji} className="reaction-item">{emoji} {count}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {attachedImage && (
            <div className="attachment-preview">
              <span>В приложении готово к отправке:</span>
              <strong>{attachedImageName}</strong>
            </div>
          )}

          {replyTarget && (
            <div className="reply-banner">
              <span>Ответ на сообщение: «{replyTarget.text}»</span>
              <button className="glass-btn" onClick={cancelReply}>Отменить</button>
            </div>
          )}

          <footer className="composer">
            <div className="composer-actions">
              <button className="composer-action" onClick={() => fileInputRef.current?.click()} aria-label="Прикрепить фото">
                📎
              </button>
              <button className="composer-action" onClick={() => setShowStickerPicker((prev) => !prev)} aria-label="Стикеры">
                😊
              </button>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Напишите сообщение…"
            />
            <button className="send-button" onClick={sendMessage}>
              Отправить
            </button>
          </footer>

          <div className="quick-replies">
            {quickReplies.map((reply) => (
              <button key={reply} type="button" className="glass-btn" onClick={() => sendQuickReply(reply)}>
                {reply}
              </button>
            ))}
          </div>

          {showStickerPicker && (
            <div className="sticker-picker">
              {stickers.map((sticker) => (
                <button key={sticker} type="button" className="sticker-item" onClick={() => handleSendSticker(sticker)}>
                  {sticker}
                </button>
              ))}
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAttachImage} />
              </>
            )}
        </main>
      </div>

      {showSettings && (
        <div className="modal-backdrop" onClick={closeSettings}>
          <section className="settings-modal" onClick={(event) => event.stopPropagation()}>
            <header className="settings-header">
              <div>
                <h2>Настройки TeleMAX</h2>
                <p>Быстрые параметры для чата и темы.</p>
              </div>
              <button className="close-button" onClick={closeSettings} aria-label="Закрыть">×</button>
            </header>

            <div className="settings-tabs">
              <button className={settingsSection === 'profile' ? 'active' : ''} onClick={() => setSettingsSection('profile')}>Профиль</button>
              <button className={settingsSection === 'notifications' ? 'active' : ''} onClick={() => setSettingsSection('notifications')}>Уведомления</button>
              <button className={settingsSection === 'appearance' ? 'active' : ''} onClick={() => setSettingsSection('appearance')}>Внешний вид</button>
            </div>

            <div className="settings-body">
              {settingsSection === 'profile' && (
                <div className="settings-section">
                  <label>Имя пользователя</label>
                  <input value={userName} onChange={(event) => setUserName(event.target.value)} placeholder="TeleMAX" />
                  <label>Статус</label>
                  <input value={userStatusText} onChange={(event) => setUserStatusText(event.target.value)} placeholder="Онлайн" />
                </div>
              )}
              {settingsSection === 'notifications' && (
                <div className="settings-section">
                  <label>Звуки</label>
                  <button className="secondary">Включить</button>
                  <label>Уведомления</label>
                  <button className="secondary">Включить</button>
                </div>
              )}
              {settingsSection === 'appearance' && (
                <div className="settings-section">
                  <label>Тема</label>
                  <button className="secondary" onClick={toggleTheme}>
                    {isDark ? 'Светлая тема' : 'Тёмная тема'}
                  </button>
                  <label>Режим отображения</label>
                  <button className="secondary" onClick={toggleCompactView}>
                    {compactView ? 'Обычный' : 'Компактный'}
                  </button>
                  <label>Автопрокрутка</label>
                  <button className="secondary" onClick={toggleAutoScroll}>
                    {autoScroll ? 'Выключить' : 'Включить'}
                  </button>
                  <label>Стиль</label>
                  <p>Liquid glass с плавными градиентами и мягкой подсветкой.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
