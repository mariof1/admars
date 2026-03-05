import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Search, ChevronLeft, ChevronRight, User, Mail, Building2, Shield, ShieldOff } from 'lucide-react';

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
        <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
          <User size={16} />
          <span>{total} user{total !== 1 ? 's' : ''}</span>
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
    </div>
  );
}
