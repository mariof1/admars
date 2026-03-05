import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Settings as SettingsIcon, Save, Loader2, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    url: '',
    baseDN: '',
    bindDN: '',
    bindPassword: '',
    adminGroup: '',
    useTLS: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.getSettings()
      .then((data) => {
        if (data.settings) setForm(data.settings);
      })
      .catch((err) => setMessage({ type: 'error', text: err.message }))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const result = await api.testConnection(form);
      setMessage({ type: result.success ? 'success' : 'error', text: result.message });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.saveSettings(form);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2"><ArrowLeft size={20} /></button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 text-sm">Active Directory connection configuration</p>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border mb-6 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <SettingsIcon size={18} className="text-brand-600" />
          <h3 className="text-sm font-semibold text-gray-900">AD Connection</h3>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">LDAP Server URL</label>
              <input className="input" value={form.url} onChange={(e) => updateField('url', e.target.value)} placeholder="ldaps://dc.domain.com:636" />
            </div>
            <div>
              <label className="label">Base DN</label>
              <input className="input" value={form.baseDN} onChange={(e) => updateField('baseDN', e.target.value)} placeholder="DC=example,DC=com" />
            </div>
            <div>
              <label className="label">Admin Group DN</label>
              <input className="input" value={form.adminGroup} onChange={(e) => updateField('adminGroup', e.target.value)} />
            </div>
            <div>
              <label className="label">Bind DN</label>
              <input className="input" value={form.bindDN} onChange={(e) => updateField('bindDN', e.target.value)} />
            </div>
            <div>
              <label className="label">Bind Password</label>
              <input type="password" className="input" value={form.bindPassword} onChange={(e) => updateField('bindPassword', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleTest} disabled={testing} className="btn-secondary">
              {testing ? <Loader2 size={16} className="animate-spin" /> : null}
              Test Connection
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
