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
    // Load engineer count for the left panel stat
    api.getEngineers()
      .then(engs => setEngineerCount(engs.length))
      .catch(() => setEngineerCount('—'));
  }, []);

  // Pre-fill username from "Remember me"
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
      <div style={styles.page}>
        <div style={styles.left} />
        <div style={styles.right}>
          <div style={{ textAlign: 'center' }}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginTop: 16 }}>Welcome back, {success.name}!</h2>
            <p style={{ color: 'var(--gray-500)', fontSize: 13, margin: '8px 0 24px' }}>You have been signed in successfully.</p>
            <button style={styles.btn} onClick={() => onLogin(success)}>Open App →</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Left Panel */}
      <div style={styles.left}>
        <div style={styles.logoMark}>T4</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'white', letterSpacing: -0.5, marginTop: 16 }}>TSM4 Billability</h1>
        <div style={{ width: 40, height: 2, background: 'rgba(255,255,255,0.4)', margin: '12px 0' }} />
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', maxWidth: 240, textAlign: 'center' }}>
          Track engineer billability across your 4-week billing cycle
        </p>
        <div style={styles.statsRow}>
          {[
            ['4 Week', 'Cycle'],
            ['80%', 'Target'],
            [engineerCount, 'Engineers'],
          ].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'white' }}>{val}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={styles.right}>
        <div style={{ maxWidth: 380, width: '100%' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Welcome Back</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 6 }}>Sign in to your account</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 28 }}>Enter your credentials to access TSM4</p>

          {error && (
            <div style={{ background: 'var(--red-light)', border: '1px solid var(--red-mid)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Username */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>USERNAME</label>
            <div style={{ position: 'relative' }}>
              <span style={styles.icon}>👤</span>
              <input
                style={styles.input} type="text" placeholder="Enter username"
                value={username} onChange={e => setUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>

          {/* Password */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <span style={styles.icon}>🔒</span>
              <input
                style={styles.input} type={showPass ? 'text' : 'password'} placeholder="Enter password"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)' }}>
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} style={{ accentColor: 'var(--red)' }} />
              Remember me
            </label>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', cursor: 'pointer' }}>Forgot password?</span>
          </div>

          {/* Sign In Button */}
          <button style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }} onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={styles.spinner} /> Signing in…
              </span>
            ) : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { display: 'flex', minHeight: '100vh' },
  left: {
    width: '42%', background: 'var(--red)', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 40, gap: 0,
  },
  right: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 40, background: 'white',
  },
  logoMark: {
    width: 72, height: 72, borderRadius: 20, background: 'rgba(255,255,255,0.15)',
    border: '2px solid rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 28, fontWeight: 800, color: 'white',
  },
  statsRow: { display: 'flex', gap: 32, marginTop: 32 },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 },
  icon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--gray-400)' },
  input: {
    width: '100%', padding: '12px 14px 12px 40px', border: '1.5px solid var(--gray-200)',
    borderRadius: 10, fontSize: 14, background: 'var(--gray-50)', outline: 'none',
  },
  btn: {
    width: '100%', padding: 13, background: 'var(--red)', color: 'white',
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
