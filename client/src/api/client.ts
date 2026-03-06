const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  async fetch<T = any>(path: string, options: FetchOptions = {}): Promise<T> {
    const { skipAuth, ...fetchOpts } = options;
    const headers: Record<string, string> = {
      ...(fetchOpts.headers as Record<string, string>),
    };

    if (!skipAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    // Only set Content-Type for non-FormData bodies
    if (fetchOpts.body && !(fetchOpts.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...fetchOpts,
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401 && !skipAuth) {
        this.token = null;
        localStorage.removeItem('admars_token');
        window.location.href = '/login';
      }
      throw new Error(data.error || `Request failed (${res.status})`);
    }

    return data as T;
  }

  // Settings
  getStatus() { return this.fetch<{ configured: boolean }>('/settings/status', { skipAuth: true }); }
  getSettings() { return this.fetch('/settings'); }
  saveSettings(settings: any) { return this.fetch('/settings', { method: 'POST', body: JSON.stringify(settings) }); }
  testConnection(settings: any) { return this.fetch<{ success: boolean; message: string; userCount?: number }>('/settings/test', { method: 'POST', body: JSON.stringify(settings) }); }

  // Auth
  login(username: string, password: string) { return this.fetch<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }), skipAuth: true }); }
  getMe() { return this.fetch<{ user: any }>('/auth/me'); }

  // Users
  createUser(data: any) { return this.fetch<{ success: boolean; sAMAccountName: string }>('/users', { method: 'POST', body: JSON.stringify(data) }); }
  getUsers(query?: string, page = 1, pageSize = 50) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    return this.fetch<{ users: any[]; total: number }>(`/users?${params}`);
  }
  getUser(username: string) { return this.fetch<any>(`/users/${username}`); }
  updateUser(username: string, data: any) { return this.fetch(`/users/${username}`, { method: 'PUT', body: JSON.stringify(data) }); }
  toggleUser(username: string, enabled: boolean) { return this.fetch(`/users/${username}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) }); }
  unlockUser(username: string) { return this.fetch(`/users/${username}/unlock`, { method: 'POST' }); }
  deleteUser(username: string) { return this.fetch(`/users/${username}`, { method: 'DELETE' }); }

  uploadPhoto(username: string, file: File | Blob) {
    const form = new FormData();
    form.append('photo', file, file instanceof File ? file.name : 'photo.jpg');
    return this.fetch(`/users/${username}/photo`, { method: 'POST', body: form });
  }
  deletePhoto(username: string) { return this.fetch(`/users/${username}/photo`, { method: 'DELETE' }); }
  resetPassword(username: string, newPassword: string) { return this.fetch(`/users/${username}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) }); }

  // Groups
  searchGroups(username: string, query?: string) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    return this.fetch<{ groups: { dn: string; cn: string; description: string }[] }>(`/users/${username}/groups/search?${params}`);
  }
  addToGroup(username: string, groupDn: string) { return this.fetch(`/users/${username}/groups`, { method: 'POST', body: JSON.stringify({ groupDn }) }); }
  removeFromGroup(username: string, groupDn: string) { return this.fetch(`/users/${username}/groups`, { method: 'DELETE', body: JSON.stringify({ groupDn }) }); }

  // OUs
  getOUs() { return this.fetch<{ ous: { dn: string; name: string; description: string; depth: number }[] }>('/users/ous/list'); }
  moveUser(username: string, targetOu: string) { return this.fetch(`/users/${username}/move`, { method: 'POST', body: JSON.stringify({ targetOu }) }); }

  // UPN suffixes
  getUpnSuffixes() { return this.fetch<{ suffixes: string[] }>('/users/upn-suffixes'); }

  // Audit
  getAuditLogs(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params);
    return this.fetch<{ logs: any[]; total: number; page: number; pageSize: number }>(`/audit/logs?${qs}`);
  }
  getAuditActions() { return this.fetch<{ actions: string[] }>('/audit/actions'); }
  getAuditStats() { return this.fetch<any>('/audit/stats'); }
}

export const api = new ApiClient();
export default api;
