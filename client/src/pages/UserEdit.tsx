import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import {
  ArrowLeft, Save, Camera, Trash2, Key, Loader2, CheckCircle, AlertCircle,
  User, Mail, Building2, Phone, MapPin, Briefcase, Globe, Hash,
  Plus, X, Search, Users, ShieldOff, ShieldCheck, UserX, Lock, Unlock,
  ZoomIn, ZoomOut
} from 'lucide-react';

interface AdUser {
  dn: string;
  sAMAccountName: string;
  userPrincipalName: string;
  displayName: string;
  givenName: string;
  sn: string;
  mail: string;
  title: string;
  department: string;
  company: string;
  manager: string;
  telephoneNumber: string;
  mobile: string;
  streetAddress: string;
  l: string;
  st: string;
  postalCode: string;
  co: string;
  physicalDeliveryOfficeName: string;
  description: string;
  info: string;
  employeeID: string;
  employeeNumber: string;
  lockoutTime: string;
  userAccountControl: number;
  memberOf: string[];
  thumbnailPhoto?: string;
  [key: string]: any;
}

interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
}

// Field definitions for the edit form
const fieldSections: { title: string; icon: typeof User; fields: FieldDef[] }[] = [
  {
    title: 'Identity',
    icon: User,
    fields: [
      { key: 'givenName', label: 'First Name' },
      { key: 'sn', label: 'Last Name' },
      { key: 'displayName', label: 'Display Name' },
      { key: 'userPrincipalName', label: 'User Principal Name' },
      { key: 'description', label: 'Description' },
    ],
  },
  {
    title: 'Contact',
    icon: Mail,
    fields: [
      { key: 'mail', label: 'Email' },
      { key: 'telephoneNumber', label: 'Phone' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'facsimileTelephoneNumber', label: 'Fax' },
      { key: 'ipPhone', label: 'IP Phone' },
      { key: 'pager', label: 'Pager' },
      { key: 'wWWHomePage', label: 'Web Page' },
    ],
  },
  {
    title: 'Organization',
    icon: Building2,
    fields: [
      { key: 'title', label: 'Job Title' },
      { key: 'department', label: 'Department' },
      { key: 'company', label: 'Company' },
      { key: 'manager', label: 'Manager (DN)' },
      { key: 'physicalDeliveryOfficeName', label: 'Office' },
    ],
  },
  {
    title: 'Employee',
    icon: Hash,
    fields: [
      { key: 'employeeID', label: 'Employee ID' },
      { key: 'employeeNumber', label: 'Employee Number' },
    ],
  },
  {
    title: 'Address',
    icon: MapPin,
    fields: [
      { key: 'streetAddress', label: 'Street Address' },
      { key: 'l', label: 'City' },
      { key: 'st', label: 'State/Province' },
      { key: 'postalCode', label: 'Postal Code' },
      { key: 'co', label: 'Country' },
    ],
  },
  {
    title: 'Profile',
    icon: Globe,
    fields: [
      { key: 'homeDrive', label: 'Home Drive' },
      { key: 'homeDirectory', label: 'Home Directory' },
      { key: 'scriptPath', label: 'Logon Script' },
      { key: 'profilePath', label: 'Profile Path' },
    ],
  },
  {
    title: 'Notes',
    icon: Briefcase,
    fields: [
      { key: 'info', label: 'Notes', multiline: true },
    ],
  },
];

export default function UserEdit() {
  const { username } = useParams<{ username: string }>();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  const [user, setUser] = useState<AdUser | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [originalForm, setOriginalForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password reset
  const [showPwModal, setShowPwModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Group management
  const [showGroupModal, setShowGroupModal] = useState(false);

  // Confirmation modal
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    variant?: 'danger' | 'warning' | 'default';
    onConfirm: () => void;
  } | null>(null);

  // Delete modal (requires typing "delete")
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Photo crop modal
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [cropUploading, setCropUploading] = useState(false);

  const isAdmin = authUser?.isAdmin ?? false;
  const isSelf = authUser?.sAMAccountName === username;
  const canEdit = isAdmin;

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    api.getUser(username)
      .then((data) => {
        setUser(data);
        const formData: Record<string, string> = {};
        for (const section of fieldSections) {
          for (const field of section.fields) {
            formData[field.key] = data[field.key] || '';
          }
        }
        setForm(formData);
        setOriginalForm(formData);
      })
      .catch((err) => setToast({ type: 'error', text: err.message }))
      .finally(() => setLoading(false));
  }, [username]);

  const handleSave = async () => {
    if (!username) return;
    setSaving(true);
    setToast(null);
    try {
      await api.updateUser(username, form);
      setOriginalForm({ ...form });
      setToast({ type: 'success', text: 'User updated successfully' });
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ type: 'error', text: err.message });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropUpload = async () => {
    if (!cropImage || !croppedAreaPixels || !username) return;
    setCropUploading(true);
    try {
      const blob = await getCroppedBlob(cropImage, croppedAreaPixels);
      await api.uploadPhoto(username, blob);
      const data = await api.getUser(username);
      setUser(data);
      setCropImage(null);
      setToast({ type: 'success', text: 'Photo updated' });
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ type: 'error', text: err.message });
    } finally {
      setCropUploading(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!username) return;
    try {
      await api.deletePhoto(username);
      setUser((u) => u ? { ...u, thumbnailPhoto: undefined } : null);
      setToast({ type: 'success', text: 'Photo removed' });
      setTimeout(() => setToast(null), 3000);
    } catch (err: any) {
      setToast({ type: 'error', text: err.message });
    }
  };

  const handlePasswordReset = async () => {
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setPwMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }
    if (!username) return;
    setPwLoading(true);
    setPwMessage(null);
    try {
      await api.resetPassword(username, newPassword);
      setPwMessage({ type: 'success', text: 'Password reset successfully' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setShowPwModal(false); setPwMessage(null); }, 2000);
    } catch (err: any) {
      setPwMessage({ type: 'error', text: err.message });
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-gray-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">User not found</p>
        <button onClick={() => navigate(-1)} className="btn-secondary mt-4"><ArrowLeft size={16} /> Go Back</button>
      </div>
    );
  }

  const UAC_DISABLED = 0x0002;
  const isDisabled = (user.userAccountControl & UAC_DISABLED) !== 0;
  const isLocked = user.lockoutTime && user.lockoutTime !== '0' && user.lockoutTime !== '';

  const isDirty = Object.keys(form).some((k) => form[k] !== originalForm[k]);
  const changedCount = Object.keys(form).filter((k) => form[k] !== originalForm[k]).length;

  return (
    <div className="pb-20">
      {/* Floating toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg text-sm shadow-lg border transition-all animate-slide-in ${
          toast.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.text}
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70"><X size={14} /></button>
        </div>
      )}
      <div className="flex items-center gap-4 mb-6">
        {isAdmin && (
          <button onClick={() => navigate('/users')} className="btn-ghost p-2"><ArrowLeft size={20} /></button>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{user.displayName || user.sAMAccountName}</h1>
          <p className="text-gray-500 text-sm">{user.sAMAccountName} • {user.userPrincipalName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Photo & quick info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Photo card */}
          <div className="card p-6">
            <div className="flex flex-col items-center">
              <div className="relative group">
                {user.thumbnailPhoto ? (
                  <img
                    src={`data:image/jpeg;base64,${user.thumbnailPhoto}`}
                    alt={user.displayName}
                    className="w-32 h-32 rounded-full object-cover ring-4 ring-gray-100 shadow-md"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-4xl font-bold ring-4 ring-gray-100">
                    {(user.displayName || user.sAMAccountName).charAt(0).toUpperCase()}
                  </div>
                )}
                {canEdit && (
                  <label className="absolute bottom-0 right-0 w-10 h-10 bg-brand-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-brand-700 transition-colors">
                    <Camera size={16} />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                  </label>
                )}
              </div>
              <h2 className="text-lg font-semibold mt-4">{user.displayName}</h2>
              <p className="text-sm text-gray-500">{user.title || 'No title'}</p>

              <span className={`mt-3 inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full ${
                isDisabled ? 'bg-red-50 text-red-700' : isLocked ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
              }`}>
                {isDisabled ? 'Disabled' : isLocked ? <><Lock size={12} /> Locked</> : 'Active'}
              </span>

              {canEdit && user.thumbnailPhoto && (
                <button onClick={handlePhotoDelete} className="btn-ghost text-red-500 hover:text-red-700 mt-3 text-xs">
                  <Trash2 size={14} /> Remove photo
                </button>
              )}
            </div>
          </div>

          {/* Actions card */}
          {canEdit && (
            <div className="card p-4 space-y-2">
              <button onClick={() => setShowPwModal(true)} className="btn-secondary w-full">
                <Key size={16} /> Reset Password
              </button>
              {isAdmin && isLocked && (
                <button
                  onClick={async () => {
                    try {
                      await api.unlockUser(user.sAMAccountName);
                      const updated = await api.getUser(user.sAMAccountName);
                      setUser(updated);
                      setToast({ type: 'success', text: 'Account unlocked' });
                      setTimeout(() => setToast(null), 3000);
                    } catch (err: any) {
                      setToast({ type: 'error', text: err.message });
                    }
                  }}
                  className="btn-secondary w-full text-amber-600 hover:text-amber-700"
                >
                  <Unlock size={16} /> Unlock Account
                </button>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      const action = isDisabled ? 'enable' : 'disable';
                      setConfirmModal({
                        title: `${isDisabled ? 'Enable' : 'Disable'} Account`,
                        message: `Are you sure you want to ${action} ${user.displayName}?`,
                        confirmLabel: `${isDisabled ? 'Enable' : 'Disable'} Account`,
                        variant: isDisabled ? 'default' : 'warning',
                        onConfirm: async () => {
                          try {
                            await api.toggleUser(user.sAMAccountName, isDisabled);
                            const updated = await api.getUser(user.sAMAccountName);
                            setUser(updated);
                            setToast({ type: 'success', text: `Account ${action}d` });
                            setTimeout(() => setToast(null), 3000);
                          } catch (err: any) {
                            setToast({ type: 'error', text: err.message });
                          }
                          setConfirmModal(null);
                        },
                      });
                    }}
                    className={`w-full ${isDisabled ? 'btn-secondary' : 'btn-secondary text-amber-600 hover:text-amber-700'}`}
                  >
                    {isDisabled ? <><ShieldCheck size={16} /> Enable Account</> : <><ShieldOff size={16} /> Disable Account</>}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteConfirmText('');
                      setShowDeleteModal(true);
                    }}
                    className="btn-danger w-full"
                  >
                    <UserX size={16} /> Delete User
                  </button>
                </>
              )}
            </div>
          )}

          {/* Groups card */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Users size={14} /> Groups</h3>
              {isAdmin && (
                <button onClick={() => setShowGroupModal(true)} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
                  <Plus size={14} /> Add
                </button>
              )}
            </div>
            {user.memberOf.length === 0 ? (
              <p className="text-xs text-gray-400">No group memberships</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {user.memberOf.map((group, i) => {
                  const cn = group.match(/^CN=([^,]+)/)?.[1] || group;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded bg-gray-50 group/item hover:bg-gray-100 transition-colors" title={group}>
                      <span className="text-gray-600 truncate">{cn}</span>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setConfirmModal({
                              title: 'Remove from Group',
                              message: `Remove ${user.displayName} from ${cn}?`,
                              confirmLabel: 'Remove',
                              variant: 'warning',
                              onConfirm: async () => {
                                try {
                                  await api.removeFromGroup(user.sAMAccountName, group);
                                  setUser((u) => u ? { ...u, memberOf: u.memberOf.filter((g) => g !== group) } : null);
                                  setToast({ type: 'success', text: `Removed from ${cn}` });
                                  setTimeout(() => setToast(null), 3000);
                                } catch (err: any) {
                                  setToast({ type: 'error', text: err.message });
                                }
                                setConfirmModal(null);
                              },
                            });
                          }}
                          className="opacity-0 group-hover/item:opacity-100 text-red-400 hover:text-red-600 shrink-0 transition-opacity"
                          title={`Remove from ${cn}`}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Edit form */}
        <div className="lg:col-span-2 space-y-6">
          {fieldSections.map(({ title, icon: Icon, fields }) => (
            <div key={title} className="card">
              <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
                <Icon size={18} className="text-brand-600" />
                <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fields.map((field) => (
                  <div key={field.key} className={field.multiline ? 'sm:col-span-2' : ''}>
                    <label className="label">{field.label}</label>
                    {field.multiline ? (
                      <textarea
                        className="input min-h-[80px] resize-y"
                        value={form[field.key] || ''}
                        onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                        disabled={!canEdit}
                      />
                    ) : (
                      <input
                        type="text"
                        className="input"
                        value={form[field.key] || ''}
                        onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                        disabled={!canEdit}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* Sticky save bar */}
      {canEdit && isDirty && (
        <div className="fixed bottom-0 left-0 lg:left-64 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-6 py-3 z-40 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">{changedCount} unsaved change{changedCount !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-3">
            <button onClick={() => setForm({ ...originalForm })} className="btn-secondary px-4 py-2 text-sm">
              Discard
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary px-6 py-2 text-sm">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          </div>
        </div>
      )}
      {showPwModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPwModal(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold flex items-center gap-2"><Key size={20} className="text-brand-600" /> Reset Password</h2>
            <p className="text-sm text-gray-500">Set a new password for <strong>{user.displayName}</strong></p>

            {pwMessage && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
                pwMessage.type === 'success' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {pwMessage.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {pwMessage.text}
              </div>
            )}

            <div>
              <label className="label">New Password</label>
              <input type="password" className="input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimum 8 characters" />
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input type="password" className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowPwModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handlePasswordReset} disabled={pwLoading} className="btn-primary flex-1">
                {pwLoading ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Crop Modal */}
      {cropImage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2"><Camera size={20} className="text-brand-600" /> Crop Photo</h2>
              <button onClick={() => setCropImage(null)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="relative w-full" style={{ height: 340 }}>
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                zoomSpeed={0.2}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="px-6 py-3 flex items-center gap-3">
              <ZoomOut size={16} className="text-gray-400 shrink-0" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-brand-600"
              />
              <ZoomIn size={16} className="text-gray-400 shrink-0" />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setCropImage(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleCropUpload} disabled={cropUploading} className="btn-primary flex-1">
                {cropUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Upload Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to Group Modal */}
      {showGroupModal && user && (
        <AddGroupModal
          username={user.sAMAccountName}
          currentGroups={user.memberOf}
          onClose={() => setShowGroupModal(false)}
          onAdded={(groupDn) => {
            setUser((u) => u ? { ...u, memberOf: [...u.memberOf, groupDn] } : null);
            setToast({ type: 'success', text: 'Added to group' });
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setConfirmModal(null)}>
          <div className="card w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{confirmModal.title}</h2>
            <p className="text-sm text-gray-600">{confirmModal.message}</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setConfirmModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 ${
                  confirmModal.variant === 'danger' ? 'btn-danger' :
                  confirmModal.variant === 'warning' ? 'btn-primary bg-amber-600 hover:bg-amber-700' :
                  'btn-primary'
                }`}
              >
                {confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {showDeleteModal && user && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div className="card w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-red-600 flex items-center gap-2"><AlertCircle size={20} /> Delete User</h2>
            <p className="text-sm text-gray-600">
              This will permanently delete <strong>{user.displayName}</strong>. This action cannot be undone.
            </p>
            <div>
              <label className="label">Type <strong className="text-red-600">delete</strong> to confirm</label>
              <input
                type="text"
                className="input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button
                disabled={deleteConfirmText !== 'delete' || deleteLoading}
                onClick={async () => {
                  setDeleteLoading(true);
                  try {
                    await api.deleteUser(user.sAMAccountName);
                    setShowDeleteModal(false);
                    navigate('/users');
                  } catch (err: any) {
                    setToast({ type: 'error', text: err.message });
                    setShowDeleteModal(false);
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                className="btn-danger flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteLoading ? <Loader2 size={16} className="animate-spin" /> : <UserX size={16} />}
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddGroupModal({ username, currentGroups, onClose, onAdded }: {
  username: string;
  currentGroups: string[];
  onClose: () => void;
  onAdded: (groupDn: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<{ dn: string; cn: string; description: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState('');

  const searchGroupsDebounced = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const { groups } = await api.searchGroups(username, q || undefined);
      // Filter out groups the user is already in
      const currentLower = new Set(currentGroups.map((g) => g.toLowerCase()));
      setGroups(groups.filter((g) => !currentLower.has(g.dn.toLowerCase())));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [username, currentGroups]);

  useEffect(() => {
    const t = setTimeout(() => searchGroupsDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query, searchGroupsDebounced]);

  const handleAdd = async (group: { dn: string; cn: string }) => {
    setAdding(group.dn);
    setError('');
    try {
      await api.addToGroup(username, group.dn);
      onAdded(group.dn);
      setGroups((g) => g.filter((item) => item.dn !== group.dn));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold flex items-center gap-2"><Users size={20} className="text-brand-600" /> Add to Group</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search groups..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-3 flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
            <AlertCircle size={16} className="shrink-0" />{error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Searching groups...
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              {query ? 'No matching groups found' : 'Type to search for groups'}
            </div>
          ) : (
            <div className="space-y-1">
              {groups.map((group) => {
                const isAdding = adding === group.dn;
                return (
                  <div key={group.dn} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{group.cn}</p>
                      {group.description && <p className="text-xs text-gray-500 truncate">{group.description}</p>}
                    </div>
                    <button
                      onClick={() => handleAdd(group)}
                      disabled={isAdding}
                      className="btn-primary text-xs px-3 py-1.5 shrink-0"
                    >
                      {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getCroppedBlob(imageSrc: string, crop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not supported'));
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create blob'));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageSrc;
  });
}
