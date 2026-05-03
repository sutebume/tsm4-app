import { useState } from 'react';
import { api } from '../api';

export default function ChangePassword({ user, onComplete }) {
  const isForced = user.must_change_password;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = (p) => {
    if (!p) return { label: '', color: 'var(--gray-200)', width: '0%' };
    if (p.length < 6) return { label: 'Too short', color: '#e74c3c', width: '20%' };
    if (p.length < 8) return { label: 'Weak', color: '#e67e22', width: '40%' };
    if (!/[0-9]/.test(p) || !/[a-zA-Z]/.test(p)) return { label: 'Fair', color: '#f1c40f', width: '60%' };
    if (p.length < 12) return { label: 'Good', color: '#2ecc71', width: '80%' };
    return { label: 'Strong', color: '#27ae60', width: '100%' };
  };

  const pw = strength(newPassword);

  const handleSubmit = async () => {
    setError('');
    if (newPassword.length < 6) return setError('Password must be at least 6 characters');
    if (newPassword !== confirmPassword) return setError('Passwords do not match');
    if (!isForced && !currentPassword) return setError('Please enter your current password');

    setLoading(true);
    try {
      const data = await api.changePassword(
        isForced ? null : currentPassword,
        newPassword
      );
      // Update stored token with new one (must_change_password now false)
      localStorage.setItem('tsm4_token', data.token);
      onComplete(data.user);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Icon */}
        <div style={styles.iconWrap}>🔑</div>

        {/* Title */}
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 6, textAlign: 'center' }}>
          {isForced ? 'Set Your Password' : 'Change Password'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
          {isForced
            ? 'Your account was created with a default password. Please set a new password before continuing.'
            : `Changing password for ${user.name}`}
        </p>

        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {/* Current password — only for voluntary change */}
        {!isForced && (
          <div style={styles.fieldGroup}>
            <label style={styles.label}>CURRENT PASSWORD</label>
            <input
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              style={styles.input}
            />
          </div>
        )}

        {/* New password */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>NEW PASSWORD</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showNew ? 'text' : 'password'}
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              style={styles.input}
            />
            <button onClick={() => setShowNew(s => !s)} style={styles.showBtn}>
              {showNew ? 'Hide' : 'Show'}
            </button>
          </div>
          {/* Strength bar */}
          {newPassword.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ height: 4, background: 'var(--gray-200)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: pw.width, background: pw.color, borderRadius: 4, transition: 'width 0.3s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: pw.color, fontWeight: 600, marginTop: 3 }}>{pw.label}</div>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>CONFIRM PASSWORD</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={{
                ...styles.input,
                borderColor: confirmPassword && confirmPassword !== newPassword ? '#e74c3c' : 'var(--gray-200)',
              }}
            />
            <button onClick={() => setShowConfirm(s => !s)} style={styles.showBtn}>
              {showConfirm ? 'Hide' : 'Show'}
            </button>
          </div>
          {confirmPassword && confirmPassword !== newPassword && (
            <div style={{ fontSize: 11, color: '#e74c3c', fontWeight: 600, marginTop: 3 }}>Passwords do not match</div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{ ...styles.btn, opacity: loading ? 0.6 : 1, marginTop: 8 }}
        >
          {loading ? 'Saving…' : isForced ? 'Set Password & Continue' : 'Update Password'}
        </button>

        {/* Skip not allowed if forced */}
        {!isForced && (
          <button onClick={() => onComplete(user)} style={styles.cancelBtn}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 24,
  },
  card: {
    background: 'white', borderRadius: 20, padding: 28,
    width: '100%', maxWidth: 400,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: '50%',
    background: 'var(--red-light)', display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    fontSize: 24, margin: '0 auto 16px',
  },
  fieldGroup: { marginBottom: 16 },
  label: {
    fontSize: 11, fontWeight: 700, color: 'var(--gray-700)',
    textTransform: 'uppercase', letterSpacing: 0.5,
    display: 'block', marginBottom: 6,
  },
  input: {
    width: '100%', padding: '11px 44px 11px 14px',
    border: '1.5px solid var(--gray-200)', borderRadius: 10,
    fontSize: 14, background: 'var(--gray-50)', outline: 'none',
    boxSizing: 'border-box',
  },
  showBtn: {
    position: 'absolute', right: 12, top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 12, fontWeight: 600, color: 'var(--gray-500)',
  },
  btn: {
    width: '100%', padding: 13, background: 'var(--red)', color: 'white',
    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  cancelBtn: {
    width: '100%', padding: 11, marginTop: 8,
    background: 'none', border: '1px solid var(--gray-200)',
    borderRadius: 10, fontSize: 13, fontWeight: 600,
    color: 'var(--gray-500)', cursor: 'pointer',
  },
  errorBox: {
    background: 'var(--red-light)', border: '1px solid var(--red-mid)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: 'var(--red)', marginBottom: 16,
  },
};
