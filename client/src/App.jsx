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
  const [loading, setLoading] = useState(true); // start true — checking token
  const { toast, showToast } = useToast();

  // On mount: check for existing valid token
  useEffect(() => {
    const token = localStorage.getItem('tsm4_token');
    if (!token) {
      setLoading(false);
      return;
    }
    api.me()
      .then(d => setUser(d.user))
      .catch(() => {
        // Token expired or invalid — clear it and show login
        localStorage.removeItem('tsm4_token');
        setLoading(false);
      });
  }, []);

  // Load all data whenever user changes
  useEffect(() => {
    if (!user) return;
    loadAllData(user);
  }, [user]);

  async function loadAllData(currentUser) {
    setLoading(true);
    try {
      // Always load engineers and workday hours
      const [engs, wh] = await Promise.all([
        api.getEngineers(),
        api.getWorkdayHours(),
      ]);

      const whMap = {};
      wh.forEach(r => { whMap[r.date] = r.hours; });

      // Fetch strategy:
      // ALL roles use /entries/all for Team tab aggregation
      // Engineers get their own detail from /entries/:id for Individual tab
      // Write access remains owner-restricted on the server
      const entriesMap = {};

      // Initialize empty maps for all engineers
      engs.forEach(e => { entriesMap[e.id] = {}; });

      if (currentUser.role === 'engineer' && currentUser.engineer_id) {
        // Step 1: fetch own detailed entries for Individual tab
        const ownRows = await api.getAllEntries(currentUser.engineer_id);
        const byDate = {};
        ownRows.forEach(r => {
          if (!byDate[r.date]) byDate[r.date] = [];
          byDate[r.date].push(r);
        });
        entriesMap[currentUser.engineer_id] = byDate;

        // Step 2: fetch all entries for Team tab (read-only aggregation)
        const allRows = await api.getAllEntriesForAll();
        allRows.forEach(r => {
          if (r.engineer_id === currentUser.engineer_id) return; // already have own
          if (!entriesMap[r.engineer_id]) entriesMap[r.engineer_id] = {};
          if (!entriesMap[r.engineer_id][r.date]) entriesMap[r.engineer_id][r.date] = [];
          entriesMap[r.engineer_id][r.date].push(r);
        });
      } else {
        // Admin/manager: single bulk fetch, group by engineer_id then date
        const allRows = await api.getAllEntriesForAll();
        allRows.forEach(r => {
          if (!entriesMap[r.engineer_id]) entriesMap[r.engineer_id] = {};
          if (!entriesMap[r.engineer_id][r.date]) entriesMap[r.engineer_id][r.date] = [];
          entriesMap[r.engineer_id][r.date].push(r);
        });
      }

      // Set all state at once — prevents partial renders
      setEngineers(engs);
      setWorkdayHours(whMap);
      setAllEntries(entriesMap);
    } catch (err) {
      console.error('Failed to load data:', err);
      // If unauthorized, token likely expired — force logout
      if (err.message?.includes('token') || err.message?.includes('401')) {
        handleSignOut();
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  async function refreshEntries(engineerId) {
    try {
      const rows = await api.getAllEntries(engineerId);
      const byDate = {};
      rows.forEach(r => {
        if (!byDate[r.date]) byDate[r.date] = [];
        byDate[r.date].push(r);
      });
      setAllEntries(prev => ({ ...prev, [engineerId]: byDate }));
    } catch (err) {
      console.error('Failed to refresh entries:', err);
    }
  }

  function handleLogin(u) {
    setUser(u);
    setActiveTab('individual');
  }

  function handleSignOut() {
    localStorage.removeItem('tsm4_token');
    setUser(null);
    setEngineers([]);
    setAllEntries({});
    setWorkdayHours({});
    setActiveTab('individual');
    setCalendarEntry(null);
    setLoading(false);
  }

  // Still checking token on mount
  if (loading && !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'white', margin: '0 auto 16px' }}>T4</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;

  // Force password change before entering app
  if (user.must_change_password) {
    return <ChangePassword user={user} onComplete={(updatedUser) => setUser(updatedUser)} />;
  }

  // Data still loading after login
  if (loading) {
    return (
      <div className="app-shell">
        {/* Header */}
        <div style={{ background: 'var(--red)', padding: '12px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>TSM4 Billability</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{user.name} · <span style={{ textTransform: 'capitalize' }}>{user.role}</span></div>
          </div>
          <button onClick={handleSignOut} style={{ fontSize: 11, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '5px 8px' }}>Sign Out</button>
        </div>
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-500)', fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>⏳</div>
          Loading your data…
        </div>
      </div>
    );
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
          await loadAllData(user);
          showToast('Settings saved ✓');
        }}
        onEngineersChange={() => loadAllData(user)}
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
          <button onClick={() => setShowChangePassword(true)} style={{ fontSize: 11, fontWeight: 600, color: 'white', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '5px 8px' }}>
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
