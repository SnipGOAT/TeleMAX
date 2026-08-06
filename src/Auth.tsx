import { useState } from 'react';
import STRINGS from './strings';

type Props = {
  onLogin: (name: string) => void;
};

export default function Auth({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/login' : '/api/register';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: email.split('@')[0] || 'user' }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || 'Ошибка авторизации');
      } else {
        if (remember) {
          localStorage.setItem('telemax-auth', JSON.stringify({ email, name: data.user.name, remember }));
        } else {
          localStorage.removeItem('telemax-auth');
        }
        onLogin(data.user.name);
      }
    } catch (err) {
      setError('Сервер недоступен.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-panel glass-panel">
        <h2>{mode === 'login' ? STRINGS.loginTitle : STRINGS.registerTitle}</h2>
        <form onSubmit={submit} className="auth-form">
          <label>{STRINGS.email}</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <label>{STRINGS.password}</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Загрузка...' : mode === 'login' ? STRINGS.login : STRINGS.register}
            </button>
            <button type="button" className="glass-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? STRINGS.register : STRINGS.login}
            </button>
            <label className="auth-checkbox">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              Запомнить меня на этом устройстве
            </label>
          </div>
          {error && <p className="auth-error">{error}</p>}
        </form>
      </section>
    </div>
  );
}
