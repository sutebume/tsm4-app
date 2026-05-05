const BASE = '/api';

function getToken() {
  return localStorage.getItem('tsm4_token');
}

async function request(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  me: () => request('GET', '/auth/me'),
  changePassword: (current_password, new_password) => request('POST', '/auth/change-password', { current_password, new_password }),
  getEntries: (engineerId, date) => request('GET', `/entries/${engineerId}/${date}`),
  getAllEntries: (engineerId) => request('GET', `/entries/${engineerId}`),
  getAllEntriesForAll: () => request('GET', '/entries/all'),
  saveEntries: (engineerId, date, entries) => request('POST', `/entries/${engineerId}/${date}`, { entries }),
  getEngineers: () => request('GET', '/settings/engineers'),
  updateEngineers: (engineers) => request('PUT', '/settings/engineers', { engineers }),
  addEngineer: (name) => request('POST', '/settings/engineers', { name }),
  deleteEngineer: (id) => request('DELETE', `/settings/engineers/${id}`),
  getWorkdayHours: () => request('GET', '/settings/workday-hours'),
  updateWorkdayHours: (hours) => request('PUT', '/settings/workday-hours', { hours }),
  getHoursGroups: () => request('GET', '/settings/hours-groups'),
  getHoursGroupsWithHours: () => request('GET', '/settings/hours-groups/with-hours'),
  createHoursGroup: (name) => request('POST', '/settings/hours-groups', { name }),
  renameHoursGroup: (id, name) => request('PUT', `/settings/hours-groups/${id}`, { name }),
  deleteHoursGroup: (id) => request('DELETE', `/settings/hours-groups/${id}`),
  getGroupWorkdayHours: (groupId) => request('GET', `/settings/hours-groups/${groupId}/workday-hours`),
  updateGroupWorkdayHours: (groupId, hours) => request('PUT', `/settings/hours-groups/${groupId}/workday-hours`, { hours }),
  assignEngineerGroup: (engId, group_id) => request('PUT', `/settings/engineers/${engId}/hours-group`, { group_id }),
  getUsers: () => request('GET', '/settings/users'),
  addUser: (data) => request('POST', '/settings/users', data),
  updateUser: (id, data) => request('PUT', `/settings/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/settings/users/${id}`),
  restoreBackup: (data) => request('POST', '/settings/restore', data),
  testReminder: (telegram_id, name) => request('POST', '/settings/test-reminder', { telegram_id, name }),
  getReminderConfig: () => request('GET', '/settings/reminder-config'),
  updateReminderConfig: (data) => request('PUT', '/settings/reminder-config', data),
};
