import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Individual from './pages/Individual';
import Team from './pages/Team';
import Settings from './pages/Settings';
import CalendarEntry from './pages/CalendarEntry';
import ChangePassword from './pages/ChangePassword';
import { Toast, useToast } from './components/Toast';
import { api } from './api';
import './index.css';

const TABS_BY_ROLE = {
  admin:    ['individual', 'team', 'settings'],
  manager:  ['individual', 'team', 'settings'],
  engineer: ['individual', 'team'],
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('individual');
  const [calendarEntry, setCalendarEntry] = useState(null);
  const [engineers, setEngineers] = useState([]);
  const [workdayHours, setWorkdayHours] = useState({});
  const [allEntries, setAllEntries] = useState({});
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { toast, showToast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem('tsm4_token');
    if (token) {
      api.me().then(d => setUser(d.user)).catch(() => localStorage.removeItem('tsm4_token'));
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadSettings();
  }, [user]);

  async function loadSettings() {
    const [engs, wh] = await Promise.all([api.getEngineers(), api.getWorkdayHours()]);
    setEngineers(engs);
    const map = {};
    wh.forEach(r => { map[r.date] = r.hours; });
    setWorkdayHours(map);
    const entriesMap = {};
    await Promise.all(engs.map(async (e) => {
      const rows = await api.getAllEntries(e.id);
      const byDate = {};
      rows.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
      });
      entriesMap[e.id] = byDate;
    }));
    setAllEntries(entriesMap);
  }

  async function refreshEntries(engineerId) {
    const rows = await api.getAllEntries(engineerId);
    const byDate = {};
    rows.forEach(r => {
      if (!byDate[r.date]) byDate[r.date] = [];
      byDate[r.date].push(r);
    });
    setAllEntries(prev => ({ ...prev, [engineerId]: byDate }));
  }

  function handleLogin(u) {
    setUser(u);
    // Reset to individual tab on login
    setActiveTab('individual');
  }

  function handleSignOut() {
    localStorage.removeItem('tsm4_token');
    setUser(null);
    setActiveTab('individual');
  }

  if (!user) return <Login onLogin={handleLogin} />;

  // Intercept: force password change before entering app
  if (user.must_change_password) {
    return <ChangePassword user={user} onComplete={(updatedUser) => setUser(updatedUser)} />;
  }

  const allowedTabs = TABS_BY_ROLE[user.role] || ['individual', 'team'];
  const isAdmin = user.role === 'admin';

  const tabContent = () => {
    if (calendarEntry) {
      return (
        <CalendarEntry
          {...calendarEntry}
          workdayHours={workdayHours}
          onBack={() => setCalendarEntry(null)}
          onSave={async (entries) => {
            await api.saveEntries(calendarEntry.engineerId, calendarEntry.dateKey, entries);
            await refreshEntries(calendarEntry.engineerId);
            showToast('Hours saved ✓');
            setCalendarEntry(null);
          }}
          existingEntries={(allEntries[calendarEntry.engineerId] || {})[calendarEntry.dateKey] || []}
        />
      );
    }
    if (activeTab === 'individual') return (
      <Individual
        engineers={engineers}
        allEntries={allEntries}
        workdayHours={workdayHours}
        user={user}
        onDayClick={(engineerId, dateKey, date, engineerName) =>
          setCalendarEntry({ engineerId, dateKey, date, engineerName })
        }
      />
    );
    if (activeTab === 'team') return (
      <Team engineers={engineers} allEntries={allEntries} workdayHours={workdayHours} />
    );
    if (activeTab === 'settings' && isAdmin) return (
      <Settings
        engineers={engineers}
        workdayHours={workdayHours}
        onSave={async (newEngineers, newHours) => {
          await Promise.all([
            api.updateEngineers(newEngineers),
            api.updateWorkdayHours(newHours),
          ]);
          await loadSettings();
          showToast('Settings saved ✓');
        }}
        onEngineersChange={loadSettings}
        showToast={showToast}
      />
    );
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <div style={{ background: 'var(--red)', padding: '12px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>TSM4 Billability</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
            {user.name} · <span style={{ textTransform: 'capitalize', opacity: 0.8 }}>{user.role}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowChangePassword(true)} style={{ fontSize: 11, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '5px 8px', whiteSpace: 'nowrap' }}>
            🔑
          </button>
          <button onClick={handleSignOut} style={{ fontSize: 11, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '5px 8px' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Voluntary password change modal */}
      {showChangePassword && (
        <ChangePassword
          user={{ ...user, must_change_password: false }}
          onComplete={(updatedUser) => {
            setUser(updatedUser);
            setShowChangePassword(false);
            showToast('Password updated ✓');
          }}
        />
      )}

      {/* Tab Bar */}
      {!calendarEntry && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-200)', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          {allowedTabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '13px 8px', fontSize: 13, fontWeight: 600,
              color: activeTab === tab ? 'var(--red)' : 'var(--gray-500)',
              borderBottom: activeTab === tab ? '2px solid var(--red)' : '2px solid transparent',
              textTransform: 'capitalize',
            }}>
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: 16 }}>
        {tabContent()}
      </div>

      <Toast message={toast.message} show={toast.show} />
    </div>
  );
}
