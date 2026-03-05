import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Search, ChevronLeft, ChevronRight, User, Mail, Building2, Shield, ShieldOff, UserPlus, X, Loader2, CheckCircle, AlertCircle, FolderTree, ChevronDown, ChevronUp } from 'lucide-react';

interface AdUser {
  sAMAccountName: string;
  displayName: string;
  mail: string;
  title: string;
  department: string;
  userAccountControl: number;
  thumbnailPhoto?: string;
}

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdUser[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 30;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getUsers(debouncedQuery || undefined, page, pageSize);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const totalPages = Math.ceil(total / pageSize);
  const UAC_DISABLED = 0x0002;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 mt-1">Manage Active Directory user accounts</p>
      </div>

      {/* Search & stats */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            className="input pl-10"
            placeholder="Search by name, email, department, title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-gray-500 flex items-center gap-1"><User size={16} />{total} user{total !== 1 ? 's' : ''}</span>
          <button onClick={() => setShowAddModal(true)} className="btn-primary">
            <UserPlus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">User</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Title</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Department</th>
                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
                    Loading users...
                  </div>
                </td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No users found</td></tr>
              ) : (
                users.map((user) => {
                  const disabled = (user.userAccountControl & UAC_DISABLED) !== 0;
                  return (
                    <tr
                      key={user.sAMAccountName}
                      onClick={() => navigate(`/users/${user.sAMAccountName}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {user.thumbnailPhoto ? (
                            <img src={`data:image/jpeg;base64,${user.thumbnailPhoto}`} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-semibold text-sm">
                              {(user.displayName || user.sAMAccountName).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{user.displayName || user.sAMAccountName}</p>
                            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                              <Mail size={11} />
                              {user.mail || user.sAMAccountName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{user.title || '—'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {user.department ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                            <Building2 size={11} />
                            {user.department}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                          disabled ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                        }`}>
                          {disabled ? <ShieldOff size={11} /> : <Shield size={11} />}
                          {disabled ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} users)
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost p-2">
                <ChevronLeft size={16} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-ghost p-2">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onCreated={(username) => {
            setShowAddModal(false);
            fetchUsers();
            navigate(`/users/${username}`);
          }}
        />
      )}
    </div>
  );
}

function AddUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: (username: string) => void }) {
  const [form, setForm] = useState({
    sAMAccountName: '',
    givenName: '',
    sn: '',
    displayName: '',
    userPrincipalName: '',
    mail: '',
    password: '',
    confirmPassword: '',
    enabled: true,
    ou: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ous, setOus] = useState<{ dn: string; name: string; description: string; depth: number }[]>([]);
  const [ouLoading, setOuLoading] = useState(false);
  const [ouExpanded, setOuExpanded] = useState(false);

  useEffect(() => {
    setOuLoading(true);
    api.getOUs()
      .then(({ ous }) => setOus(ous))
      .catch(() => {})
      .finally(() => setOuLoading(false));
  }, []);

  const updateField = (key: string, value: any) => {
    setForm((f) => {
      const updated = { ...f, [key]: value };
      // Auto-fill display name from first + last
      if (key === 'givenName' || key === 'sn') {
        const first = key === 'givenName' ? value : f.givenName;
        const last = key === 'sn' ? value : f.sn;
        updated.displayName = `${first} ${last}`.trim();
      }
      return updated;
    });
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.sAMAccountName || !form.givenName || !form.sn || !form.password) {
      setError('Please fill in all required fields');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await api.createUser({
        sAMAccountName: form.sAMAccountName,
        givenName: form.givenName,
        sn: form.sn,
        displayName: form.displayName,
        userPrincipalName: form.userPrincipalName || `${form.sAMAccountName}@${window.location.hostname}`,
        mail: form.mail || undefined,
        password: form.password,
        enabled: form.enabled,
        ou: form.ou || undefined,
      });
      onCreated(result.sAMAccountName);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold flex items-center gap-2"><UserPlus size={20} className="text-brand-600" /> New User</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
              <AlertCircle size={16} className="shrink-0" />{error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input className="input" value={form.givenName} onChange={(e) => updateField('givenName', e.target.value)} placeholder="John" />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className="input" value={form.sn} onChange={(e) => updateField('sn', e.target.value)} placeholder="Doe" />
            </div>
          </div>

          <div>
            <label className="label">Display Name</label>
            <input className="input" value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)} />
          </div>

          <div>
            <label className="label">Username (sAMAccountName) *</label>
            <input className="input" value={form.sAMAccountName} onChange={(e) => updateField('sAMAccountName', e.target.value)} placeholder="jdoe" />
          </div>

          <div>
            <label className="label">User Principal Name</label>
            <input className="input" value={form.userPrincipalName} onChange={(e) => updateField('userPrincipalName', e.target.value)} placeholder="jdoe@domain.com" />
          </div>

          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.mail} onChange={(e) => updateField('mail', e.target.value)} placeholder="jdoe@company.com" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Password *</label>
              <input type="password" className="input" value={form.password} onChange={(e) => updateField('password', e.target.value)} placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="label">Confirm Password *</label>
              <input type="password" className="input" value={form.confirmPassword} onChange={(e) => updateField('confirmPassword', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Organizational Unit</label>
            <button
              type="button"
              onClick={() => setOuExpanded(!ouExpanded)}
              className="input w-full text-left flex items-center justify-between gap-2"
            >
              <span className={form.ou ? 'text-gray-900' : 'text-gray-400'}>
                {form.ou ? ous.find(o => o.dn === form.ou)?.name || form.ou : 'Default (base DN)'}
              </span>
              {ouExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {ouExpanded && (
              <div className="mt-1 border border-gray-200 rounded-lg max-h-48 overflow-y-auto bg-white shadow-sm">
                {ouLoading ? (
                  <div className="flex items-center justify-center py-4"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors ${!form.ou ? 'bg-brand-50 text-brand-700 font-medium' : ''}`}
                      onClick={() => { updateField('ou', ''); setOuExpanded(false); }}
                    >
                      <FolderTree size={14} className="inline mr-2 text-gray-400" />Default (base DN)
                    </button>
                    {ous.map((ou) => (
                      <button
                        key={ou.dn}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 transition-colors ${form.ou === ou.dn ? 'bg-brand-50 text-brand-700 font-medium' : ''}`}
                        style={{ paddingLeft: `${12 + ou.depth * 16}px` }}
                        onClick={() => { updateField('ou', ou.dn); setOuExpanded(false); }}
                      >
                        <FolderTree size={14} className="inline mr-2 text-amber-500" />
                        {ou.name}
                        {ou.description && <span className="text-gray-400 text-xs ml-2">— {ou.description}</span>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => updateField('enabled', e.target.checked)} className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-gray-700">Enable account</span>
          </label>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary flex-1">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Create User
          </button>
        </div>
      </div>
    </div>
  );
}
