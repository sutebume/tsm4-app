import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [engineerCount, setEngineerCount] = useState('—');

  useEffect(() => {
    api.getEngineers()
      .then(engs => setEngineerCount(engs.length))
      .catch(() => setEngineerCount('—'));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('tsm4_remember');
    if (saved) {
      try { setUsername(JSON.parse(saved).username); } catch {}
    }
  }, []);

  const handleSubmit = async () => {
    if (!username || !password) return setError('Please enter username and password');
    setLoading(true);
    setError('');
    try {
      const data = await api.login(username, password);
      localStorage.setItem('tsm4_token', data.token);
      if (remember) localStorage.setItem('tsm4_remember', JSON.stringify({ username }));
      else localStorage.removeItem('tsm4_remember');
      setTimeout(() => setSuccess(data.user), 900);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-page" style={{ alignItems: 'center', justifyContent: 'center', background: 'white' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={s.successIcon}>✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 16 }}>Welcome back, {success.name}!</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: 13, margin: '8px 0 24px' }}>You have been signed in successfully.</p>
          <button style={s.btn} onClick={() => onLogin(success)}>Open App →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">

      {/* Left panel — hidden on mobile via CSS */}
      <div className="login-left">
        <div style={s.logoMark}>T4</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: -0.5, marginTop: 16, textAlign: 'center' }}>
          TSM4 Billability
        </h1>
        <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,0.4)', margin: '12px 0' }} />
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', maxWidth: 220, textAlign: 'center', lineHeight: 1.5 }}>
          Track engineer billability across your 4-week billing cycle
        </p>
        <div style={{ display: 'flex', gap: 28, marginTop: 32 }}>
          {[['4 Week', 'Cycle'], ['80%', 'Target'], [engineerCount, 'Engineers']].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — full width on mobile */}
      <div className="login-right">
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile-only header with branding */}
          <div className="login-mobile-header">
            <div style={{ ...s.logoMark, width: 44, height: 44, borderRadius: 12, fontSize: 18, background: 'var(--red)', border: '2px solid var(--red-mid)' }}>T4</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-900)' }}>TSM4 Billability</div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Engineer Tracking</div>
            </div>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Welcome Back</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>Sign in to your account</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>Enter your credentials to access TSM4</p>

          {error && (
            <div style={{ background: 'var(--red-light)', border: '1px solid var(--red-mid)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Username */}
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>USERNAME</label>
            <div style={{ position: 'relative' }}>
              <span style={s.icon}>👤</span>
              <input
                style={s.input} type="text" placeholder="Enter username"
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 14 }}>
            <label style={s.label}>PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <span style={s.icon}>🔒</span>
              <input
                style={s.input} type={showPass ? 'text' : 'password'} placeholder="Enter password"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoComplete="current-password"
              />
              <button onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)' }}>
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor: 'var(--red)', width: 16, height: 16 }} />
              Remember me
            </label>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', cursor: 'pointer' }}>Forgot password?</span>
          </div>

          <button style={{ ...s.btn, opacity: loading ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={s.spinner} /> Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  logoMark: {
    width: 72, height: 72, borderRadius: 20,
    background: 'rgba(255,255,255,0.15)',
    border: '2px solid rgba(255,255,255,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 800, color: 'white',
  },
  label: {
    fontSize: 11, fontWeight: 700, color: 'var(--gray-700)',
    textTransform: 'uppercase', letterSpacing: 0.5,
    display: 'block', marginBottom: 6,
  },
  icon: {
    position: 'absolute', left: 12, top: '50%',
    transform: 'translateY(-50%)', fontSize: 15, color: 'var(--gray-400)',
  },
  input: {
    width: '100%', padding: '13px 14px 13px 40px',
    border: '1.5px solid var(--gray-200)', borderRadius: 10,
    fontSize: 16, background: 'var(--gray-50)', outline: 'none',
  },
  btn: {
    width: '100%', padding: 14, background: 'var(--red)', color: 'white',
    borderRadius: 10, fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
  },
  spinner: {
    width: 16, height: 16, borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white',
    animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },
  successIcon: {
    width: 64, height: 64, borderRadius: '50%', background: 'var(--red-light)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, color: 'var(--red)', margin: '0 auto',
  },
};
