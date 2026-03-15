import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Key,
  Lock,
  Package,
  Plus,
  RefreshCcw,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import {
  ApiError,
  createAdminRelease,
  deleteAdminKey,
  deleteAdminUser,
  generateAdminKeys,
  listAdminReleases,
  listAdminReleaseTokens,
  loadAdminOverview,
  revokeAdminReleaseToken,
  toggleAdminRelease,
  updateAdminStatus,
  type AdminReleaseRecord,
  type AuthUser,
  type LicenseKeyRecord,
  type ReleaseDownloadTokenRecord,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

type OwnerTab = 'keys' | 'accounts' | 'releases';

const RELEASE_PRODUCT = 'tracex-launcher';

function formatDate(value: string | null) {
  if (!value) {
    return 'N/A';
  }
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string | null) {
  if (!value) {
    return 'N/A';
  }
  return new Date(value).toLocaleString();
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) {
    return 'Unknown';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function OwnerPanel() {
  const { apiBase, login, secret, syncUser, user } = useAuth();
  const [activeTab, setActiveTab] = useState<OwnerTab>('keys');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AuthUser[]>([]);
  const [licenseKeys, setLicenseKeys] = useState<LicenseKeyRecord[]>([]);
  const [releases, setReleases] = useState<AdminReleaseRecord[]>([]);
  const [releaseTokens, setReleaseTokens] = useState<ReleaseDownloadTokenRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReleaseLoading, setIsReleaseLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [requiresOwnerReauth, setRequiresOwnerReauth] = useState(false);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [selectedProduct] = useState('HWID Spoofer (temp)');
  const [selectedDurationDays, setSelectedDurationDays] = useState(365);
  const [showReleaseForm, setShowReleaseForm] = useState(false);
  const [releaseForm, setReleaseForm] = useState({
    version: '',
    fileName: '',
    channel: 'stable' as 'stable' | 'beta',
    notes: '',
    requiredAccess: 'core',
    forceUpdate: false,
    sha256: '',
  });

  const totals = useMemo(() => ({
    users: accounts.length,
    keys: licenseKeys.length,
    unusedKeys: licenseKeys.filter((item) => !item.assignedEmail && item.active && !item.expired).length,
    usedKeys: licenseKeys.filter((item) => Boolean(item.assignedEmail) || !item.active || item.expired).length,
  }), [accounts, licenseKeys]);

  const setNotice = (nextMessage: string, error = false) => {
    setMessage(nextMessage);
    setIsError(error);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500';
      case 'restricted':
        return 'text-yellow-500';
      case 'blacklisted':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  const getDurationLabel = (key: LicenseKeyRecord) => {
    if (!key.expiresAt || !key.createdAt) {
      return 'Lifetime';
    }
    const created = new Date(key.createdAt).getTime();
    const expires = new Date(key.expiresAt).getTime();
    const days = Math.max(1, Math.ceil((expires - created) / (1000 * 60 * 60 * 24)));
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const buildAccountLicenses = (account: AuthUser) => {
    return account.activeKeys.map((license) => ({
      key: license.keyValue,
      product: selectedProduct,
      expiry: license.expiresAt ? formatDate(license.expiresAt) : 'Lifetime',
    }));
  };

  const refreshOverview = async (ownerPassword = secret) => {
    if (!user || !ownerPassword) {
      setRequiresOwnerReauth(true);
      setNotice('Owner session secret is missing. Log in again to continue.', true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const overview = await loadAdminOverview(apiBase, user.email, ownerPassword);
      setRequiresOwnerReauth(false);
      syncUser(overview.actor);
      setAccounts(overview.users);
      setLicenseKeys(overview.keys);
      setNotice('Owner panel synced.');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401 || /owner authentication failed|invalid owner credentials|owner session/i.test(error.message)) {
          setRequiresOwnerReauth(true);
        }
        setNotice(error.message, true);
      } else {
        setNotice('Failed to load owner overview.', true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const refreshReleaseData = async (ownerPassword = secret) => {
    if (!user || !ownerPassword) {
      return;
    }

    setIsReleaseLoading(true);
    try {
      const [releaseResult, tokenResult] = await Promise.all([
        listAdminReleases(apiBase, user.email, ownerPassword),
        listAdminReleaseTokens(apiBase, user.email, ownerPassword, 100),
      ]);
      setReleases(releaseResult.releases);
      setReleaseTokens(tokenResult.tokens);
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('Failed to load release data.', true);
      }
    } finally {
      setIsReleaseLoading(false);
    }
  };

  useEffect(() => {
    refreshOverview();
    refreshReleaseData();
  }, [apiBase, secret, user?.email]);

  const copyToClipboard = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(value);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleOwnerReauth = async () => {
    if (!user || !reauthPassword.trim()) {
      setNotice('Enter the owner password to continue.', true);
      return;
    }

    setIsReauthenticating(true);
    try {
      const ownerPassword = reauthPassword;
      await Promise.all([
        refreshOverview(ownerPassword),
        refreshReleaseData(ownerPassword),
      ]);
      await login(user.email, ownerPassword);
      setReauthPassword('');
      setRequiresOwnerReauth(false);
      setNotice('Owner authentication restored.');
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('Owner re-authentication failed.', true);
      }
    } finally {
      setIsReauthenticating(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!user || !secret) {
      return;
    }

    try {
      const result = await generateAdminKeys(apiBase, user.email, secret, {
        label: selectedProduct,
        grantedAccess: 'core',
        durationHours: String(selectedDurationDays * 24),
        count: 1,
      });
      setNotice(result.message);
      await refreshOverview();
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('Key generation failed.', true);
      }
    }
  };

  const handleDeleteKey = async (keyValue: string) => {
    if (!user || !secret) {
      setNotice('Owner session secret is missing.', true);
      return;
    }

    try {
      const result = await deleteAdminKey(apiBase, user.email, secret, keyValue);
      setNotice(result.message);
      await refreshOverview();
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('Key deletion failed.', true);
      }
    }
  };

  const handleStatusUpdate = async (targetEmailValue: string, status: 'active' | 'restricted' | 'blacklisted') => {
    if (!user || !secret) {
      setNotice('Owner session secret is missing.', true);
      return;
    }

    try {
      const result = await updateAdminStatus(apiBase, user.email, secret, targetEmailValue, status);
      setNotice(result.message);
      await refreshOverview();
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('Status update failed.', true);
      }
    }
  };

  const handleDeleteUser = async (targetEmailValue: string) => {
    if (!user || !secret) {
      setNotice('Owner session secret is missing.', true);
      return;
    }

    try {
      const result = await deleteAdminUser(apiBase, user.email, secret, targetEmailValue);
      setNotice(result.message);
      await refreshOverview();
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('User deletion failed.', true);
      }
    }
  };

  const handleCreateRelease = async () => {
    if (!user || !secret) {
      setNotice('Owner session secret is missing.', true);
      return;
    }

    try {
      const result = await createAdminRelease(apiBase, user.email, secret, {
        product: RELEASE_PRODUCT,
        channel: releaseForm.channel,
        version: releaseForm.version,
        fileName: releaseForm.fileName,
        notes: releaseForm.notes,
        requiredAccess: releaseForm.requiredAccess,
        forceUpdate: releaseForm.forceUpdate,
        sha256: releaseForm.sha256,
      });
      setNotice(result.message);
      setShowReleaseForm(false);
      setReleaseForm({
        version: '',
        fileName: '',
        channel: 'stable',
        notes: '',
        requiredAccess: 'core',
        forceUpdate: false,
        sha256: '',
      });
      await refreshReleaseData();
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('Failed to create release.', true);
      }
    }
  };

  const handleToggleRelease = async (release: AdminReleaseRecord) => {
    if (!user || !secret) {
      setNotice('Owner session secret is missing.', true);
      return;
    }

    try {
      const result = await toggleAdminRelease(apiBase, user.email, secret, release.id, !release.active);
      setNotice(result.message);
      setReleases((current) => current.map((item) => item.id === release.id ? result.release : item));
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('Failed to update release state.', true);
      }
    }
  };

  const handleRevokeToken = async (tokenId: number) => {
    if (!user || !secret) {
      setNotice('Owner session secret is missing.', true);
      return;
    }

    try {
      const result = await revokeAdminReleaseToken(apiBase, user.email, secret, tokenId);
      setNotice(result.message);
      setReleaseTokens((current) => current.map((item) => item.id === tokenId ? result.token : item));
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice(error.message, true);
      } else {
        setNotice('Failed to revoke token.', true);
      }
    }
  };

  return (
    <div className="p-6 max-w-6xl overflow-y-auto h-full text-white">
      <div className="flex items-center gap-2 text-xs mb-4 text-gray-400">
        <span>⌂</span>
        <span>/</span>
        <span className="text-white">Owner Panel</span>
      </div>

      <h1 className="text-lg mb-1 text-white">Owner Panel</h1>
      <p className="text-gray-400 mb-6 text-xs">Manage license keys, accounts, and releases.</p>

      <div className={`mb-6 rounded-xl border px-4 py-3 text-sm ${isError ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-[#4A7FE7]/30 bg-[#4A7FE7]/10 text-[#bfd4ff]'}`}>
        {isLoading ? 'Loading owner overview...' : message || 'Owner controls ready.'}
      </div>

      {requiresOwnerReauth ? (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 text-sm text-yellow-200">
            <Lock size={16} />
            Owner password confirmation required
          </div>
          <p className="mt-2 text-xs text-yellow-100/80">
            Your saved owner session no longer matches the backend. Re-enter the owner password to unlock the panel.
          </p>
          <div className="mt-4 flex gap-3">
            <input
              type="password"
              value={reauthPassword}
              onChange={(event) => setReauthPassword(event.target.value)}
              placeholder="Owner password"
              className="flex-1 rounded-lg border border-[#1a2840] bg-[#0a0a0a] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#4A7FE7]"
            />
            <button
              onClick={handleOwnerReauth}
              disabled={isReauthenticating}
              className="rounded-lg bg-[#4A7FE7] px-4 py-2 text-sm text-white transition-colors hover:bg-[#5B8DEF] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isReauthenticating ? 'Checking...' : 'Unlock'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2 mb-6 border-b border-[#1a2840]">
        <button
          onClick={() => setActiveTab('keys')}
          className={`px-4 py-2 text-sm transition-colors relative ${activeTab === 'keys' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <div className="flex items-center gap-2"><Key size={16} />License Keys</div>
          {activeTab === 'keys' ? <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A7FE7]" /> : null}
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 text-sm transition-colors relative ${activeTab === 'accounts' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <div className="flex items-center gap-2"><Users size={16} />Registered Accounts</div>
          {activeTab === 'accounts' ? <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A7FE7]" /> : null}
        </button>
        <button
          onClick={() => setActiveTab('releases')}
          className={`px-4 py-2 text-sm transition-colors relative ${activeTab === 'releases' ? 'text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <div className="flex items-center gap-2"><Package size={16} />Releases</div>
          {activeTab === 'releases' ? <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4A7FE7]" /> : null}
        </button>
      </div>

      {activeTab === 'keys' ? (
        <div>
          <div className="mb-4">
            <div className="flex gap-4 text-sm text-gray-400 mb-4">
              <span>Total Keys: <span className="text-white">{totals.keys}</span></span>
              <span>Unused: <span className="text-green-500">{totals.unusedKeys}</span></span>
              <span>Used: <span className="text-gray-500">{totals.usedKeys}</span></span>
            </div>

            <div className="bg-[#0a0e1a] border border-[#1a2840] rounded-lg p-4">
              <h3 className="text-white text-sm mb-3">Generate New License Key</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Product</label>
                  <select value={selectedProduct} disabled className="w-full bg-[#0a0a0a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm opacity-80">
                    <option value={selectedProduct}>{selectedProduct}</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1.5 block">Duration</label>
                  <select
                    value={selectedDurationDays}
                    onChange={(event) => setSelectedDurationDays(Number(event.target.value))}
                    className="w-full bg-[#0a0a0a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4A7FE7] transition-colors"
                  >
                    <option value={1}>1 Day</option>
                    <option value={7}>7 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>1 Year</option>
                    <option value={36500}>Lifetime</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleGenerateKey}
                    className="w-full bg-[#4A7FE7] hover:bg-[#5B8DEF] px-3 py-2 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <Plus size={16} />
                    Generate Key
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {licenseKeys.map((key) => (
              <div key={key.keyValue} className="bg-[#0a0e1a] border border-[#1a2840] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="text-sm text-white font-mono bg-[#0a0a0a] px-2 py-1 rounded">{key.keyValue}</code>
                      <button onClick={() => copyToClipboard(key.keyValue)} className="text-gray-400 hover:text-white transition-colors">
                        {copiedKey === key.keyValue ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                      <div className="flex items-center gap-1.5">
                        {!key.assignedEmail && key.active && !key.expired ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-gray-500" />}
                        <span className={`text-xs ${!key.assignedEmail && key.active && !key.expired ? 'text-green-500' : 'text-gray-500'} capitalize`}>
                          {!key.assignedEmail && key.active && !key.expired ? 'unused' : 'used'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-xs text-gray-400">
                      <div><span className="block text-gray-500">Created</span>{formatDate(key.createdAt)}</div>
                      <div><span className="block text-gray-500">Product</span><span className="text-white">{selectedProduct}</span></div>
                      <div><span className="block text-gray-500">Duration</span>{getDurationLabel(key)}</div>
                      <div><span className="block text-gray-500">Used By</span>{key.assignedEmail || 'Not used yet'}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.keyValue)}
                    className="text-red-500 hover:text-red-400 transition-colors p-1 disabled:text-gray-600"
                    disabled={Boolean(key.assignedEmail)}
                    title={key.assignedEmail ? 'Cannot delete used keys' : 'Delete key'}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'accounts' ? (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-400">Total Accounts: <span className="text-white">{accounts.length}</span></div>
            <button
              onClick={() => refreshOverview()}
              className="text-xs bg-[#0a0e1a] border border-[#1a2840] text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCcw size={13} />
              Refresh
            </button>
          </div>

          <div className="space-y-2">
            {accounts.map((account) => (
              <div key={account.email} className="bg-[#0a0e1a] border border-[#1a2840] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm text-white">{account.email}</span>
                      <span className={`text-xs ${getStatusColor(account.status)} capitalize`}>{account.status}</span>
                      <span className="bg-[#4A7FE7]/20 text-[#4A7FE7] text-xs px-2 py-0.5 rounded">
                        {account.activeKeys.length} {account.activeKeys.length === 1 ? 'License' : 'Licenses'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-gray-400 mb-3">
                      <div><span className="block text-gray-500">Registered</span>{formatDate(account.createdAt)}</div>
                      <div><span className="block text-gray-500">Last Login</span>{formatDate(account.lastLoginAt)}</div>
                    </div>

                    <div className="bg-[#0a0a0a] border border-[#1a2840] rounded-lg p-3 mb-3">
                      <div className="text-xs text-gray-500 mb-2">Licenses:</div>
                      <div className="space-y-2">
                        {buildAccountLicenses(account).length ? buildAccountLicenses(account).map((license) => (
                          <div key={license.key} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <code className="text-white bg-[#0d0d0d] px-2 py-1 rounded font-mono">{license.key}</code>
                              <span className="text-gray-400">{license.product}</span>
                            </div>
                            <span className="text-gray-500">Exp: {license.expiry}</span>
                          </div>
                        )) : <div className="text-xs text-gray-500">No active licenses</div>}
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3 flex-wrap">
                      {account.status !== 'active' ? (
                        <button onClick={() => handleStatusUpdate(account.email, 'active')} className="text-xs bg-green-500/20 text-green-500 hover:bg-green-500/30 px-2 py-1 rounded transition-colors">Activate</button>
                      ) : null}
                      {account.status !== 'restricted' ? (
                        <button onClick={() => handleStatusUpdate(account.email, 'restricted')} className="text-xs bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 px-2 py-1 rounded transition-colors flex items-center gap-1"><Lock size={12} />Restrict</button>
                      ) : null}
                      {account.status !== 'blacklisted' ? (
                        <button onClick={() => handleStatusUpdate(account.email, 'blacklisted')} className="text-xs bg-red-500/20 text-red-500 hover:bg-red-500/30 px-2 py-1 rounded transition-colors flex items-center gap-1"><Ban size={12} />Blacklist</button>
                      ) : null}
                      {!account.isOwner ? (
                        <button onClick={() => handleDeleteUser(account.email)} className="text-xs bg-red-500/20 text-red-500 hover:bg-red-500/30 px-2 py-1 rounded transition-colors flex items-center gap-1"><Trash2 size={12} />Remove</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeTab === 'releases' ? (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-400">Total Releases: <span className="text-white">{releases.length}</span></div>
            <button onClick={() => setShowReleaseForm((current) => !current)} className="bg-[#4A7FE7] hover:bg-[#5B8DEF] px-3 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-colors"><Plus size={14} />New Release</button>
          </div>

          {showReleaseForm ? (
            <div className="bg-[#0a0e1a] border border-[#1a2840] rounded-lg p-4 mb-4">
              <h3 className="text-white text-sm mb-3">Create New Release</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div><label className="text-gray-400 text-xs mb-1.5 block">Version</label><input value={releaseForm.version} onChange={(event) => setReleaseForm((current) => ({ ...current, version: event.target.value }))} placeholder="1.0.0" className="w-full bg-[#0a0a0a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4A7FE7] transition-colors" /></div>
                <div><label className="text-gray-400 text-xs mb-1.5 block">File Name</label><input value={releaseForm.fileName} onChange={(event) => setReleaseForm((current) => ({ ...current, fileName: event.target.value }))} placeholder="TraceX-Launcher-1.0.0.zip" className="w-full bg-[#0a0a0a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4A7FE7] transition-colors" /></div>
                <div><label className="text-gray-400 text-xs mb-1.5 block">Channel</label><select value={releaseForm.channel} onChange={(event) => setReleaseForm((current) => ({ ...current, channel: event.target.value as 'stable' | 'beta' }))} className="w-full bg-[#0a0a0a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4A7FE7] transition-colors"><option value="stable">Stable</option><option value="beta">Beta</option></select></div>
                <div><label className="text-gray-400 text-xs mb-1.5 block">Required Access</label><input value={releaseForm.requiredAccess} onChange={(event) => setReleaseForm((current) => ({ ...current, requiredAccess: event.target.value }))} placeholder="core" className="w-full bg-[#0a0a0a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4A7FE7] transition-colors" /></div>
                <div className="col-span-2"><label className="text-gray-400 text-xs mb-1.5 block">SHA-256</label><input value={releaseForm.sha256} onChange={(event) => setReleaseForm((current) => ({ ...current, sha256: event.target.value }))} placeholder="optional sha256 hash" className="w-full bg-[#0a0a0a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4A7FE7] transition-colors" /></div>
                <div className="col-span-2"><label className="text-gray-400 text-xs mb-1.5 block">Notes</label><textarea value={releaseForm.notes} onChange={(event) => setReleaseForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full bg-[#0a0a0a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#4A7FE7] transition-colors resize-none" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-300 mb-4"><input type="checkbox" checked={releaseForm.forceUpdate} onChange={(event) => setReleaseForm((current) => ({ ...current, forceUpdate: event.target.checked }))} />Force update</label>
              <div className="flex gap-3"><button onClick={handleCreateRelease} className="bg-[#4A7FE7] hover:bg-[#5B8DEF] px-4 py-2 rounded-lg text-sm transition-colors">Create Release</button><button onClick={() => setShowReleaseForm(false)} className="border border-[#1a2840] px-4 py-2 rounded-lg text-sm text-gray-300 hover:text-white transition-colors">Cancel</button></div>
            </div>
          ) : null}

          <div className="space-y-3 mb-6">
            {releases.map((release) => (
              <div key={release.id} className="bg-[#0a0e1a] border border-[#1a2840] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm text-white font-medium">v{release.version}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${release.channel === 'stable' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}>{release.channel}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${release.active ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{release.active ? 'active' : 'disabled'}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-xs text-gray-400 mb-2">
                      <div><span className="block text-gray-500">File</span>{release.fileName}</div>
                      <div><span className="block text-gray-500">Size</span>{formatBytes(release.fileSize)}</div>
                      <div><span className="block text-gray-500">Created</span>{formatDateTime(release.createdAt)}</div>
                      <div><span className="block text-gray-500">By</span>{release.createdBy || 'Unknown'}</div>
                    </div>
                    <div className="text-xs text-gray-300">{release.notes || 'No release notes.'}</div>
                  </div>
                  <button onClick={() => handleToggleRelease(release)} className="text-sm rounded-lg border border-[#1a2840] bg-[#0a0a0a] px-3 py-2 text-gray-300 hover:text-white transition-colors flex items-center gap-2">{release.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}{release.active ? 'Disable' : 'Enable'}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-400">Recent Download Tokens</div>
            <button onClick={() => refreshReleaseData()} className="text-xs bg-[#0a0e1a] border border-[#1a2840] text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"><RefreshCcw size={13} />Refresh</button>
          </div>

          <div className="space-y-2">
            {releaseTokens.map((token) => (
              <div key={token.id} className="bg-[#0a0e1a] border border-[#1a2840] rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm text-white">{token.email}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${token.revoked ? 'bg-red-500/20 text-red-500' : token.consumed ? 'bg-gray-500/20 text-gray-400' : 'bg-green-500/20 text-green-500'}`}>{token.revoked ? 'revoked' : token.consumed ? 'used' : 'active'}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-xs text-gray-400">
                      <div><span className="block text-gray-500">Device</span>{token.deviceId || 'N/A'}</div>
                      <div><span className="block text-gray-500">Issued</span>{formatDateTime(token.issuedAt)}</div>
                      <div><span className="block text-gray-500">Expires</span>{formatDateTime(token.expiresAt)}</div>
                      <div><span className="block text-gray-500">Downloaded</span>{formatDateTime(token.downloadedAt)}</div>
                    </div>
                  </div>
                  {!token.revoked && !token.consumed ? <button onClick={() => handleRevokeToken(token.id)} className="text-xs bg-red-500/20 text-red-500 hover:bg-red-500/30 px-3 py-2 rounded transition-colors">Revoke</button> : null}
                </div>
              </div>
            ))}
          </div>
          {isReleaseLoading ? <div className="text-xs text-gray-500 mt-3">Refreshing release data...</div> : null}
        </div>
      ) : null}
    </div>
  );
}