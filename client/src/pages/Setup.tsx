import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { Server, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

export default function Setup({ onComplete }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [form, setForm] = useState({
    url: 'ldaps://dc.example.com:636',
    baseDN: 'DC=example,DC=com',
    bindDN: 'CN=ServiceAccount,OU=Service Accounts,DC=example,DC=com',
    bindPassword: '',
    adminGroup: 'CN=Domain Admins,CN=Users,DC=example,DC=com',
    useTLS: true,
  });

  const updateField = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const handleTest = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const result = await api.testConnection(form);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.saveSettings(form);
      onComplete();
      navigate('/login');
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-2xl font-bold mb-4 shadow-lg shadow-brand-600/30">
            AD
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Setup ADMars</h1>
          <p className="text-gray-500 mt-1">Configure your Active Directory connection</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div key={s} className={`flex items-center gap-2 ${s > 1 ? 'ml-4' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                step >= s ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{s}</div>
              <span className={`text-sm font-medium ${step >= s ? 'text-gray-900' : 'text-gray-400'}`}>
                {s === 1 ? 'Connection' : 'Verify & Save'}
              </span>
              {s < 2 && <div className={`w-12 h-0.5 ml-2 ${step > s ? 'bg-brand-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSave} className="card p-8">
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-brand-600 mb-2">
                <Server size={20} />
                <h2 className="text-lg font-semibold">Server Connection</h2>
              </div>

              <div>
                <label className="label">LDAP Server URL</label>
                <input className="input" placeholder="ldaps://dc.domain.com:636" value={form.url} onChange={(e) => updateField('url', e.target.value)} required />
                <p className="text-xs text-gray-400 mt-1">Use ldaps:// for secure connection (recommended)</p>
              </div>

              <div>
                <label className="label">Base DN</label>
                <input className="input" placeholder="DC=example,DC=com" value={form.baseDN} onChange={(e) => updateField('baseDN', e.target.value)} required />
              </div>

              <div>
                <label className="label">Bind DN (Service Account)</label>
                <input className="input" placeholder="CN=svc-admars,OU=Service Accounts,DC=example,DC=com" value={form.bindDN} onChange={(e) => updateField('bindDN', e.target.value)} required />
              </div>

              <div>
                <label className="label">Bind Password</label>
                <input type="password" className="input" placeholder="••••••••" value={form.bindPassword} onChange={(e) => updateField('bindPassword', e.target.value)} required />
              </div>

              <div>
                <label className="label">Admin Group DN</label>
                <input className="input" placeholder="CN=Domain Admins,CN=Users,DC=example,DC=com" value={form.adminGroup} onChange={(e) => updateField('adminGroup', e.target.value)} required />
                <p className="text-xs text-gray-400 mt-1">Members of this group get admin privileges</p>
              </div>

              <button type="button" onClick={() => setStep(2)} className="btn-primary w-full">
                Next <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-brand-600 mb-2">
                <CheckCircle size={20} />
                <h2 className="text-lg font-semibold">Test & Save</h2>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                <div className="flex justify-between"><span className="text-gray-500">Server:</span><span className="font-mono">{form.url}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Base DN:</span><span className="font-mono">{form.baseDN}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Bind DN:</span><span className="font-mono text-xs">{form.bindDN}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Admin Group:</span><span className="font-mono text-xs">{form.adminGroup}</span></div>
              </div>

              {testResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
                  testResult.success ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
                }`}>
                  {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
                <button type="button" onClick={handleTest} disabled={loading} className="btn-secondary flex-1">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : 'Test Connection'}
                </button>
                <button type="submit" disabled={loading} className="btn-primary flex-1">Save & Finish</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
