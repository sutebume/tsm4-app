import { useState, useEffect } from 'react';
import {
  getBillingCycleDatesFromMonth, getCycleStartMonth, getCycleLabel,
  offsetCycle, formatDateKey, isWeekend
} from '../utils/billing';
import { api } from '../api';

const SECTION = { HOURS: 'hours', ENGINEERS: 'engineers', USERS: 'users', BACKUP: 'backup', REMINDER: 'reminder' };

export default function Settings({ engineers, hoursGroups, onDataChange, showToast }) {
  const [section, setSection] = useState(SECTION.HOURS);

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: SECTION.HOURS, label: 'Work Hours' },
          { key: SECTION.ENGINEERS, label: 'Engineers' },
          { key: SECTION.USERS, label: 'Users' },
          { key: SECTION.BACKUP, label: 'Backup' },
          { key: SECTION.REMINDER, label: '🔔 Alerts' },
        ].map(s => (
          <button key={s.key} onClick={() => setSection(s.key)} style={{
            flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, borderRadius: 8,
            background: section === s.key ? 'var(--red)' : 'var(--gray-100)',
            color: section === s.key ? 'white' : 'var(--gray-700)',
            border: `1px solid ${section === s.key ? 'var(--red)' : 'var(--gray-200)'}`,
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {section === SECTION.HOURS && (
        <HoursGroupsSection hoursGroups={hoursGroups} onDataChange={onDataChange} showToast={showToast} />
      )}
      {section === SECTION.ENGINEERS && (
        <EngineersSection hoursGroups={hoursGroups} onDataChange={onDataChange} showToast={showToast} />
      )}
      {section === SECTION.USERS && (
        <UsersSection showToast={showToast} />
      )}
      {section === SECTION.BACKUP && (
        <BackupSection showToast={showToast} />
      )}
      {section === SECTION.REMINDER && (
        <ReminderSection showToast={showToast} />
      )}
    </div>
  );
}

// ── Working Hours Groups ────────────────────────────────────────
function HoursGroupsSection({ hoursGroups, onDataChange, showToast }) {
  const today = new Date();
  const currentCycleMonth = getCycleStartMonth(today);

  const [selectedGroupId, setSelectedGroupId] = useState(1);
  const [cycleMonth, setCycleMonth] = useState(currentCycleMonth);
  const [hours, setHours] = useState({});
  const [saving, setSaving] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupName, setEditGroupName] = useState('');

  const isCurrentCycle =
    cycleMonth.getFullYear() === currentCycleMonth.getFullYear() &&
    cycleMonth.getMonth() === currentCycleMonth.getMonth();

  // Sync hours when selected group or groups data changes
  useEffect(() => {
    const group = hoursGroups.find(g => g.id === selectedGroupId);
    setHours(group ? { ...group.workdayHours } : {});
  }, [selectedGroupId, hoursGroups]);

  // If selected group was deleted, fall back to Default
  useEffect(() => {
    if (hoursGroups.length > 0 && !hoursGroups.find(g => g.id === selectedGroupId)) {
      setSelectedGroupId(1);
    }
  }, [hoursGroups]);

  const weeks = getBillingCycleDatesFromMonth(cycleMonth);
  const allDays = weeks.flat();

  const weekTotals = weeks.map(days =>
    days.reduce((s, d) => {
      const key = formatDateKey(d);
      const defaultH = isWeekend(d) ? 0 : 8;
      return s + (hours[key] ?? defaultH);
    }, 0)
  );

  async function handleSaveHours() {
    setSaving(true);
    try {
      await api.updateGroupWorkdayHours(selectedGroupId, hours);
      await onDataChange();
      showToast('Work hours saved ✓');
    } catch (e) { showToast(e.message); }
    setSaving(false);
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    try {
      const g = await api.createHoursGroup(newGroupName.trim());
      setNewGroupName('');
      setCreatingGroup(false);
      await onDataChange();
      setSelectedGroupId(g.id);
      showToast(`Group "${g.name}" created ✓`);
    } catch (e) { showToast(e.message); }
  }

  async function handleRenameGroup(id) {
    if (!editGroupName.trim()) return;
    try {
      await api.renameHoursGroup(id, editGroupName.trim());
      setEditingGroupId(null);
      await onDataChange();
      showToast('Group renamed ✓');
    } catch (e) { showToast(e.message); }
  }

  async function handleDeleteGroup(id, name) {
    const group = hoursGroups.find(g => g.id === id);
    const memberCount = group?.engineers?.length || 0;
    const msg = memberCount > 0
      ? `Delete "${name}"? Its ${memberCount} engineer(s) will be moved to the Default group.`
      : `Delete "${name}"?`;
    if (!confirm(msg)) return;
    try {
      await api.deleteHoursGroup(id);
      await onDataChange();
      setSelectedGroupId(1);
      showToast(`Group "${name}" deleted ✓`);
    } catch (e) { showToast(e.message); }
  }

  const selectedGroup = hoursGroups.find(g => g.id === selectedGroupId);

  return (
    <div>
      {/* Group list */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>Working Hours Groups</div>
        <button
          onClick={() => setCreatingGroup(v => !v)}
          style={{ fontSize: 12, fontWeight: 600, color: 'white', background: 'var(--red)', border: 'none', borderRadius: 8, padding: '6px 12px' }}
        >
          + New Group
        </button>
      </div>

      {creatingGroup && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            autoFocus
            type="text" placeholder="Group name (e.g. Manila, Singapore)"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
            style={{ flex: 1, border: '1.5px solid var(--red)', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}
          />
          <button onClick={handleCreateGroup} style={{ fontSize: 12, fontWeight: 600, color: 'white', background: 'var(--red)', border: 'none', borderRadius: 8, padding: '8px 14px' }}>Create</button>
          <button onClick={() => { setCreatingGroup(false); setNewGroupName(''); }} style={{ fontSize: 12, color: 'var(--gray-500)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '8px 12px' }}>Cancel</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {hoursGroups.map(g => (
          <div
            key={g.id}
            onClick={() => { if (editingGroupId !== g.id) setSelectedGroupId(g.id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
              borderRadius: 10, cursor: 'pointer',
              background: selectedGroupId === g.id ? 'var(--red-light)' : 'var(--gray-50)',
              border: `1.5px solid ${selectedGroupId === g.id ? 'var(--red-mid)' : 'var(--gray-200)'}`,
            }}
          >
            {editingGroupId === g.id ? (
              <>
                <input
                  autoFocus
                  value={editGroupName}
                  onChange={ev => setEditGroupName(ev.target.value)}
                  onKeyDown={ev => ev.key === 'Enter' && handleRenameGroup(g.id)}
                  onClick={ev => ev.stopPropagation()}
                  style={{ flex: 1, border: '1.5px solid var(--red)', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
                />
                <button onClick={ev => { ev.stopPropagation(); handleRenameGroup(g.id); }} style={{ fontSize: 12, fontWeight: 600, color: 'white', background: 'var(--red)', border: 'none', borderRadius: 6, padding: '4px 10px' }}>Save</button>
                <button onClick={ev => { ev.stopPropagation(); setEditingGroupId(null); }} style={{ fontSize: 12, color: 'var(--gray-500)', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px' }}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: selectedGroupId === g.id ? 'var(--red)' : 'var(--gray-700)' }}>
                  {g.name}
                  {g.id === 1 && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--gray-400)', fontWeight: 400 }}>default</span>}
                </span>
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                  {g.engineers?.length || 0} engineer{g.engineers?.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={ev => { ev.stopPropagation(); setEditingGroupId(g.id); setEditGroupName(g.name); }}
                  style={{ fontSize: 11, color: 'var(--red)', border: '1px solid var(--red-mid)', borderRadius: 6, padding: '3px 8px', background: 'var(--red-light)' }}
                >Edit</button>
                <button
                  onClick={ev => { ev.stopPropagation(); handleDeleteGroup(g.id, g.name); }}
                  disabled={g.id === 1}
                  style={{ fontSize: 11, color: g.id === 1 ? 'var(--gray-300)' : '#888', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '3px 8px', cursor: g.id === 1 ? 'not-allowed' : 'pointer' }}
                >✕</button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Members display */}
      {selectedGroup && (
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 16 }}>
          <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>Members: </span>
          {selectedGroup.engineers?.length > 0
            ? selectedGroup.engineers.map(e => e.name).join(', ')
            : <span style={{ color: 'var(--gray-400)' }}>No engineers assigned</span>
          }
        </div>
      )}

      <div style={{ height: 1, background: 'var(--gray-200)', marginBottom: 16 }} />

      {/* Cycle navigator */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, background: 'var(--gray-50)',
        border: '1px solid var(--gray-200)', borderRadius: 10, padding: '8px 12px',
      }}>
        <button
          onClick={() => setCycleMonth(m => offsetCycle(m, -1))}
          style={{ fontSize: 20, color: 'var(--red)', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}
        >‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-900)' }}>
            {getCycleLabel(cycleMonth)}
          </div>
          {isCurrentCycle && (
            <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, marginTop: 2 }}>● Current Cycle</div>
          )}
        </div>
        <button
          onClick={() => setCycleMonth(m => offsetCycle(m, 1))}
          disabled={isCurrentCycle}
          style={{ fontSize: 20, color: isCurrentCycle ? 'var(--gray-300)' : 'var(--red)', fontWeight: 700, padding: '0 4px', lineHeight: 1 }}
        >›</button>
      </div>

      {/* Week totals */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {weeks.map((_, i) => (
          <div key={i} style={{ flex: 1, background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '6px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-700)' }}>Wk{i + 1}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)' }}>{weekTotals[i]}h</div>
          </div>
        ))}
      </div>

      {/* Day list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {allDays.map(d => {
          const key = formatDateKey(d);
          const weekend = isWeekend(d);
          const defaultH = weekend ? 0 : 8;
          return (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', borderRadius: 8,
              background: weekend ? 'rgba(0,0,0,0.02)' : 'transparent',
              border: weekend ? '1px dashed var(--gray-200)' : '1px solid transparent',
            }}>
              <span style={{ flex: 1, fontSize: 12, color: weekend ? 'var(--gray-400)' : 'var(--gray-700)', fontWeight: weekend ? 400 : 500 }}>
                {d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                {weekend && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--gray-400)' }}>Weekend</span>}
              </span>
              <input
                type="number" min={0} max={24} step={0.5}
                value={hours[key] ?? defaultH}
                onChange={e => setHours(h => ({ ...h, [key]: parseFloat(e.target.value) || 0 }))}
                style={{ width: 60, border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px', textAlign: 'center', fontSize: 13, background: weekend ? 'var(--gray-50)' : 'white' }}
              />
              <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>hrs</span>
            </div>
          );
        })}
      </div>

      <button onClick={handleSaveHours} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : `Save Hours for "${selectedGroup?.name || ''}"`}
      </button>
    </div>
  );
}

// ── Engineers ────────────────────────────────────────────────
function EngineersSection({ hoursGroups, onDataChange, showToast }) {
  const [engineers, setEngineers] = useState([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const engs = await api.getEngineers();
    setEngineers(engs);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await api.addEngineer(newName.trim());
      setNewName('');
      await load();
      await onDataChange();
      showToast('Engineer added ✓');
    } catch (e) { showToast(e.message); }
    setLoading(false);
  }

  async function handleRename(id) {
    if (!editName.trim()) return;
    try {
      await api.updateEngineers([{ id, name: editName.trim() }]);
      setEditingId(null);
      await load();
      await onDataChange();
      showToast('Engineer updated ✓');
    } catch (e) { showToast(e.message); }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}" and all their entries?`)) return;
    try {
      await api.deleteEngineer(id);
      await load();
      await onDataChange();
      showToast('Engineer deleted ✓');
    } catch (e) { showToast(e.message); }
  }

  async function handleGroupChange(engId, groupId) {
    try {
      await api.assignEngineerGroup(engId, parseInt(groupId));
      await load();
      await onDataChange();
    } catch (e) { showToast(e.message); }
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 12 }}>Engineer List</div>

      {/* Existing engineers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {engineers.map((e, i) => (
          <div key={e.id} style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', minWidth: 20 }}>{i + 1}</span>
              {editingId === e.id ? (
                <>
                  <input
                    autoFocus
                    value={editName}
                    onChange={ev => setEditName(ev.target.value)}
                    onKeyDown={ev => ev.key === 'Enter' && handleRename(e.id)}
                    style={{ flex: 1, border: '1.5px solid var(--red)', borderRadius: 6, padding: '5px 8px', fontSize: 13 }}
                  />
                  <button onClick={() => handleRename(e.id)} style={{ fontSize: 12, fontWeight: 600, color: 'white', background: 'var(--red)', border: 'none', borderRadius: 6, padding: '5px 10px' }}>Save</button>
                  <button onClick={() => setEditingId(null)} style={{ fontSize: 12, color: 'var(--gray-500)', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '5px 8px' }}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>{e.name}</span>
                  <button onClick={() => { setEditingId(e.id); setEditName(e.name); }} style={{ fontSize: 11, color: 'var(--red)', border: '1px solid var(--red-mid)', borderRadius: 6, padding: '4px 8px', background: 'var(--red-light)' }}>Edit</button>
                  <button onClick={() => handleDelete(e.id, e.name)} style={{ fontSize: 11, color: '#888', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px' }}>✕</button>
                </>
              )}
            </div>
            {/* Hours group assignment row */}
            {hoursGroups.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 8px', borderTop: '1px solid var(--gray-100)' }}>
                <span style={{ fontSize: 11, color: 'var(--gray-500)', minWidth: 80 }}>Hours Group</span>
                <select
                  value={e.hours_group_id || 1}
                  onChange={ev => handleGroupChange(e.id, ev.target.value)}
                  style={{ flex: 1, border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px', fontSize: 12, background: 'white' }}
                >
                  {hoursGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 10 }}>Add Engineer</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text" placeholder="Engineer name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1, border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
        />
        <button onClick={handleAdd} disabled={loading} style={{ ...btnStyle, width: 'auto', padding: '10px 16px' }}>Add</button>
      </div>
    </div>
  );
}

// ── Users ────────────────────────────────────────────────────
function UsersSection({ showToast }) {
  const [users, setUsers] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', role: 'engineer', name: '', engineer_id: '', telegram_id: '' });
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState(null);

  useEffect(() => {
    load();
    api.getEngineers().then(setEngineers);
  }, []);

  async function load() {
    const u = await api.getUsers();
    setUsers(u);
  }

  function openAdd() {
    setEditUser(null);
    setForm({ username: '', password: '', role: 'engineer', name: '', engineer_id: '', telegram_id: '' });
    setShowForm(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({ username: u.username, password: '', role: u.role, name: u.name, engineer_id: u.engineer_id || '', telegram_id: u.telegram_id || '' });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.username || !form.name || !form.role) return showToast('All fields required');
    if (!editUser && !form.password) return showToast('Password required for new user');
    if (form.role === 'engineer' && !form.engineer_id) return showToast('Please link this user to an engineer profile');
    setLoading(true);
    try {
      const payload = {
        ...form,
        engineer_id: form.engineer_id ? parseInt(form.engineer_id) : null,
        telegram_id: form.telegram_id.trim() || null,
      };
      if (editUser) {
        await api.updateUser(editUser.id, payload);
        showToast('User updated ✓');
      } else {
        await api.addUser(payload);
        showToast('User added ✓');
      }
      setShowForm(false);
      await load();
    } catch (e) { showToast(e.message); }
    setLoading(false);
  }

  async function handleTestReminder(u) {
    setTestingId(u.id);
    try {
      await api.testReminder(u.telegram_id, u.name);
      showToast(`Test message sent to ${u.name} ✓`);
    } catch (e) {
      showToast(`Failed: ${e.message}`);
    }
    setTestingId(null);
  }

  async function handleDelete(id, username) {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      await api.deleteUser(id);
      await load();
      showToast('User deleted ✓');
    } catch (e) { showToast(e.message); }
  }

  // Find engineer name linked to a user
  const getLinkedEngineer = (engineer_id) => {
    if (!engineer_id) return null;
    return engineers.find(e => e.id === engineer_id);
  };

  const roleBadge = (role) => ({
    admin:    { bg: '#fff0f0', color: 'var(--red)',    label: 'Admin' },
    manager:  { bg: '#fff8e6', color: '#b87000',       label: 'Manager' },
    engineer: { bg: '#f0f4ff', color: '#3b5bdb',       label: 'Engineer' },
  }[role] || { bg: 'var(--gray-100)', color: 'var(--gray-500)', label: role });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>User Accounts</div>
        <button onClick={openAdd} style={{ fontSize: 12, fontWeight: 600, color: 'white', background: 'var(--red)', border: 'none', borderRadius: 8, padding: '6px 12px' }}>+ Add User</button>
      </div>

      {/* User list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {users.map(u => {
          const badge = roleBadge(u.role);
          const linked = getLinkedEngineer(u.engineer_id);
          return (
            <div key={u.id} style={{ padding: '10px 12px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>{u.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                    @{u.username}
                    {linked && <span style={{ marginLeft: 6, color: 'var(--red)' }}>→ {linked.name}</span>}
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: badge.bg, color: badge.color }}>{badge.label}</span>
                <button onClick={() => openEdit(u)} style={{ fontSize: 11, color: 'var(--red)', border: '1px solid var(--red-mid)', borderRadius: 6, padding: '4px 8px', background: 'var(--red-light)' }}>Edit</button>
                <button onClick={() => handleDelete(u.id, u.username)} style={{ fontSize: 11, color: '#888', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '4px 8px' }}>✕</button>
              </div>
              {/* Telegram row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--gray-100)' }}>
                {u.telegram_id ? (
                  <>
                    <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                      ✈️ <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{u.telegram_id}</span>
                    </span>
                    <button
                      onClick={() => handleTestReminder(u)}
                      disabled={testingId === u.id}
                      style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#1976D2', border: '1px solid #90CAF9', borderRadius: 6, padding: '3px 10px', background: '#E3F2FD', cursor: 'pointer' }}
                    >
                      {testingId === u.id ? 'Sending…' : '📨 Test'}
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>✈️ No Telegram ID — reminders disabled</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div style={{ background: 'var(--gray-50)', border: '1.5px solid var(--red-mid)', borderRadius: 12, padding: 16, marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 14 }}>
            {editUser ? `Edit — ${editUser.username}` : 'New User'}
          </div>

          {/* Role picker first — drives whether engineer picker shows */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>ROLE</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['admin', 'manager', 'engineer'].map(r => (
                <button key={r} onClick={() => setForm(p => ({ ...p, role: r, engineer_id: r !== 'engineer' ? '' : p.engineer_id }))} style={{
                  flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, borderRadius: 8, textTransform: 'capitalize',
                  background: form.role === r ? 'var(--red)' : 'white',
                  color: form.role === r ? 'white' : 'var(--gray-700)',
                  border: `1.5px solid ${form.role === r ? 'var(--red)' : 'var(--gray-200)'}`,
                }}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          {[
            { label: 'FULL NAME', key: 'name', type: 'text', placeholder: 'Display name' },
            { label: 'USERNAME', key: 'username', type: 'text', placeholder: 'Login username' },
            { label: editUser ? 'NEW PASSWORD (leave blank to keep)' : 'PASSWORD', key: 'password', type: 'password', placeholder: editUser ? 'Leave blank to keep current' : 'Set password' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 12 }}>
              <label style={labelStyle}>{f.label}</label>
              <input type={f.type} placeholder={f.placeholder} value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}
              />
            </div>
          ))}

          {/* Engineer profile link — only shown for engineer role */}
          {form.role === 'engineer' && (
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>LINKED ENGINEER PROFILE</label>
              <select
                value={form.engineer_id}
                onChange={e => setForm(p => ({ ...p, engineer_id: e.target.value }))}
                style={{ width: '100%', border: `1.5px solid ${!form.engineer_id ? 'var(--red)' : 'var(--gray-200)'}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, background: 'white' }}
              >
                <option value="">— Select engineer profile —</option>
                {engineers.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>
                This controls which engineer's data the user can access
              </div>
            </div>
          )}

          {/* Telegram ID */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>
              TELEGRAM USER ID
              <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--gray-400)', marginLeft: 6 }}>
                (optional — for reminders)
              </span>
            </label>
            <input
              type="text"
              placeholder="e.g. 1627298638"
              value={form.telegram_id}
              onChange={e => setForm(p => ({ ...p, telegram_id: e.target.value }))}
              style={{ width: '100%', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '9px 12px', fontSize: 13 }}
            />
            <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
              Engineer must message @tsm4billability_bot on Telegram first, then share their Telegram ID with you
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={loading} style={{ ...btnStyle, flex: 1 }}>
              {loading ? 'Saving…' : editUser ? 'Update User' : 'Create User'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 12, fontSize: 13, fontWeight: 600, borderRadius: 10, border: '1px solid var(--gray-200)', background: 'white', color: 'var(--gray-700)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  width: '100%', background: 'var(--red)', color: 'white', border: 'none',
  borderRadius: 10, padding: 13, fontSize: 14, fontWeight: 700, cursor: 'pointer',
};

const labelStyle = {
  fontSize: 11, fontWeight: 700, color: 'var(--gray-700)',
  textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5,
};

// ── Backup & Restore ─────────────────────────────────────────
function BackupSection({ showToast }) {
  const [restoring, setRestoring] = useState(false);
  const [lastBackupDate, setLastBackupDate] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const [pendingFilename, setPendingFilename] = useState('');

  function handleDownload() {
    const token = localStorage.getItem('tsm4_token');
    const link = document.createElement('a');
    link.href = `/api/settings/backup`;
    // We need auth header — fetch as blob instead
    fetch('/api/settings/backup', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => {
        const filename = r.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
          || `tsm4-backup-${new Date().toISOString().slice(0,10)}.json`;
        setLastBackupDate(new Date().toLocaleString());
        return r.blob().then(blob => ({ blob, filename }));
      })
      .then(({ blob, filename }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Backup downloaded ✓');
      })
      .catch(() => showToast('Backup failed'));
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.version || !data.engineers || !data.entries) {
          showToast('Invalid backup file');
          return;
        }
        setPendingData(data);
        setPendingFilename(file.name);
        setConfirmRestore(true);
      } catch {
        showToast('Could not read file — must be a valid TSM4 backup JSON');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  async function handleConfirmRestore() {
    if (!pendingData) return;
    setRestoring(true);
    setConfirmRestore(false);
    try {
      await api.restoreBackup(pendingData);
      showToast('Database restored ✓ — please refresh the page');
      setPendingData(null);
      // Force full reload so all state is fresh
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast('Restore failed: ' + e.message);
    }
    setRestoring(false);
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Backup & Restore</div>
      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 20 }}>
        Backups include all engineers, entries, work hours, and user accounts. Download regularly and store safely.
      </div>

      {/* Download */}
      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 28 }}>💾</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>Download Backup</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Exports entire database as a JSON file</div>
          </div>
        </div>
        {lastBackupDate && (
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginBottom: 10 }}>Last downloaded: {lastBackupDate}</div>
        )}
        <button onClick={handleDownload} style={btnStyle}>
          Download Backup
        </button>
      </div>

      {/* Restore */}
      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 28 }}>📂</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-900)' }}>Restore from Backup</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
              Replaces ALL current data with the backup. This cannot be undone.
            </div>
          </div>
        </div>
        <label style={{
          display: 'block', width: '100%', padding: 13, textAlign: 'center',
          background: restoring ? '#ccc' : 'white',
          border: '1.5px dashed var(--gray-300)', borderRadius: 10,
          fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', cursor: 'pointer',
        }}>
          {restoring ? 'Restoring…' : '📁  Choose backup file (.json)'}
          <input type="file" accept=".json" onChange={handleFileSelect} style={{ display: 'none' }} disabled={restoring} />
        </label>
      </div>

      {/* Confirm dialog */}
      {confirmRestore && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
        }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 24, maxWidth: 340, width: '100%' }}>
            <div style={{ fontSize: 28, textAlign: 'center', marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-900)', textAlign: 'center', marginBottom: 8 }}>
              Confirm Restore
            </div>
            <div style={{ fontSize: 13, color: 'var(--gray-500)', textAlign: 'center', marginBottom: 6 }}>
              This will replace <strong>all current data</strong> with:
            </div>
            <div style={{ background: 'var(--gray-100)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--gray-700)', marginBottom: 16, textAlign: 'center' }}>
              📄 {pendingFilename}<br />
              <span style={{ color: 'var(--gray-400)' }}>
                {pendingData?.engineers?.length} engineers · {pendingData?.entries?.length} entries · {pendingData?.users?.length} users
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--red)', textAlign: 'center', marginBottom: 20, fontWeight: 600 }}>
              This action cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleConfirmRestore} style={{ ...btnStyle, flex: 1 }}>Yes, Restore</button>
              <button onClick={() => { setConfirmRestore(false); setPendingData(null); }} style={{
                flex: 1, padding: 13, fontSize: 13, fontWeight: 600, borderRadius: 10,
                border: '1px solid var(--gray-200)', background: 'white', color: 'var(--gray-700)', cursor: 'pointer',
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reminder Settings ────────────────────────────────────────
function ReminderSection({ showToast }) {
  const [appUrl, setAppUrl] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getReminderConfig().then(cfg => {
      setAppUrl(cfg.app_url || '');
      setMessage(cfg.reminder_message || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateReminderConfig({ app_url: appUrl, reminder_message: message });
      showToast('Reminder settings saved ✓');
    } catch (e) {
      showToast('Save failed: ' + e.message);
    }
    setSaving(false);
  };

  const handleReset = () => {
    setMessage([
      `⏰ <b>TSM4 Billability Reminder</b>`,
      ``,
      `Hi <b>{name}</b>! 👋`,
      ``,
      `You have <b>{count} missing {days}</b> in the current billing cycle:`,
      ``,
      `{day_list}`,
      ``,
      `Please open TSM4 and log your activities:`,
      `🔗 {app_url}`,
      ``,
      `🎯 Target: <b>80%</b> billability per cycle`,
    ].join('\n'));
    showToast('Message reset to default');
  };

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-500)' }}>Loading…</div>;

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Reminder Settings</div>
      <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 20 }}>
        Configure the Telegram reminder message sent to engineers with missing entries.
        Reminders run at 9AM and 6PM Philippine time daily.
      </div>

      {/* App URL */}
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>APP URL <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', color: 'var(--gray-400)' }}>(included in reminder messages)</span></label>
        <input
          type="text"
          placeholder="e.g. http://123.456.789.0"
          value={appUrl}
          onChange={e => setAppUrl(e.target.value)}
          style={{ width: '100%', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '10px 12px', fontSize: 13 }}
        />
      </div>

      {/* Message template */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={labelStyle}>MESSAGE TEMPLATE</label>
          <button onClick={handleReset} style={{ fontSize: 11, color: 'var(--gray-500)', border: '1px solid var(--gray-200)', borderRadius: 6, padding: '3px 8px' }}>
            Reset to default
          </button>
        </div>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={14}
          style={{ width: '100%', border: '1.5px solid var(--gray-200)', borderRadius: 8, padding: '10px 12px', fontSize: 12, fontFamily: 'monospace', lineHeight: 1.6, resize: 'vertical' }}
        />
      </div>

      {/* Available variables */}
      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 6 }}>AVAILABLE VARIABLES</div>
        {[
          ['{name}', "Engineer's display name"],
          ['{count}', 'Number of missing days'],
          ['{days}', '"day" or "days" (auto-plural)'],
          ['{day_list}', 'Bullet list of missing dates'],
          ['{app_url}', 'App URL link'],
        ].map(([v, desc]) => (
          <div key={v} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <code style={{ fontSize: 11, background: 'var(--gray-200)', padding: '1px 6px', borderRadius: 4, minWidth: 80 }}>{v}</code>
            <span style={{ fontSize: 11, color: 'var(--gray-500)' }}>{desc}</span>
          </div>
        ))}
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>
          HTML supported: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={{ ...btnStyle, opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : 'Save Reminder Settings'}
      </button>
    </div>
  );
}
