import { useState } from 'react';
import { AlertTriangle, Check, Clock, Key, Plus } from 'lucide-react';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatAccessLabel } from '../lib/catalog';

export function Profile() {
  const { redeemKey, user } = useAuth();
  const handle = user ? '@' + user.email.split('@')[0] : '@guest';
  const [redeemValue, setRedeemValue] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [showRedeemForm, setShowRedeemForm] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState(false);

  const licenses = user ? user.activeKeys : [];

  const handleRedeemKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!redeemValue.trim()) {
      setRedeemError('License key is required.');
      return;
    }

    setIsRedeeming(true);
    setRedeemError('');
    setRedeemSuccess(false);

    try {
      await redeemKey(redeemValue.trim().toUpperCase());
      setRedeemSuccess(true);
      setRedeemValue('');
      window.setTimeout(() => {
        setShowRedeemForm(false);
        setRedeemSuccess(false);
      }, 2000);
    } catch (error) {
      if (error instanceof ApiError) {
        setRedeemError(error.message);
      } else if (error instanceof Error) {
        setRedeemError(error.message);
      } else {
        setRedeemError('Unable to redeem license key.');
      }
    } finally {
      setIsRedeeming(false);
    }
  };

  const formatExpiration = (expiresAt: string | null) => {
    if (!expiresAt) {
      return 'Lifetime';
    }
    return new Date(expiresAt).toLocaleString();
  };

  const getTimeRemaining = (expiresAt: string | null) => {
    if (!expiresAt) {
      return 'No expiration';
    }
    const timeDiff = new Date(expiresAt).getTime() - Date.now();
    if (timeDiff <= 0) {
      return 'Expired';
    }
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} remaining`;
    }
    if (hours > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min remaining`;
    }
    return `${minutes} minute${minutes !== 1 ? 's' : ''} remaining`;
  };

  return (
    <div className="p-6 max-w-4xl overflow-y-auto h-full">
      <div className="flex items-center gap-2 text-xs mb-4 text-gray-400">
        <span>⌂</span>
        <span>/</span>
        <span className="text-white">Profile</span>
      </div>

      <h1 className="text-lg mb-1 text-white">Your Profile</h1>
      <p className="text-gray-400 mb-6 text-xs">
        To manage your account head over to proton.gg
      </p>

      <div className="bg-gradient-to-br from-[#0a1628] to-[#051018] border border-[#152a45] rounded-xl p-4 mb-5 transition-all duration-200 hover:border-[#1e3a5f]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#1e3a5f] to-[#0f1e3a] rounded-full flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-xl">👤</span>
          </div>

          <div>
            <h3 className="text-white text-sm font-medium">{user ? user.email : 'user@example.com'}</h3>
            <p className="text-gray-400 text-xs">{handle}</p>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-[#FFA500]" />
            <h2 className="text-base text-white font-medium">Your Licenses</h2>
            <span className="bg-[#4A7FE7]/20 text-[#4A7FE7] text-xs px-2 py-0.5 rounded">
              {licenses.length} {licenses.length === 1 ? 'License' : 'Licenses'}
            </span>
          </div>

          {!showRedeemForm ? (
            <button
              onClick={() => setShowRedeemForm(true)}
              className="bg-[#4A7FE7] hover:bg-[#5B8DEF] text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-all duration-200 hover:shadow-lg hover:shadow-[#4A7FE7]/20"
            >
              <Plus size={14} />
              Redeem Key
            </button>
          ) : null}
        </div>
        <p className="text-gray-400 text-xs mb-4">
          Redeem additional license keys to access more products. Each key can only be used once.
        </p>

        {showRedeemForm ? (
          <div className="bg-gradient-to-br from-[#0f1623] to-[#0a0e1a] border border-[#1a2332] rounded-2xl p-6 mb-6">
            <h3 className="text-white text-lg mb-4">Redeem License Key</h3>

            <form onSubmit={handleRedeemKey} className="space-y-4">
              {redeemSuccess ? (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-start gap-2">
                  <Check size={16} className="text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-green-500 text-sm font-semibold">Key Redeemed Successfully!</p>
                    <p className="text-green-400 text-sm mt-1">The license has been added to your account.</p>
                  </div>
                </div>
              ) : null}

              {redeemError ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-500 text-sm font-semibold">License Key Error</p>
                    <p className="text-red-400 text-sm mt-1">{redeemError}</p>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="text-gray-400 text-sm mb-2 block">Enter License Key</label>
                <input
                  type="text"
                  placeholder="PROTON-XXXX-XXXX-XXXX-XXXX"
                  className="w-full bg-[#0a0e1a] border border-[#1a2840] text-white rounded-lg px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-[#4A7FE7] transition-colors font-mono"
                  disabled={isRedeeming || redeemSuccess}
                  value={redeemValue}
                  onChange={(event) => setRedeemValue(event.target.value.toUpperCase())}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isRedeeming || !redeemValue || redeemSuccess}
                  className="bg-[#4A7FE7] hover:bg-[#5B8DEF] disabled:bg-[#4A7FE7]/50 text-white rounded-lg px-4 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {isRedeeming ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-[spin_1.5s_linear_infinite]" />
                  ) : (
                    <>
                      <Key size={16} />
                      Redeem Key
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRedeemForm(false);
                    setRedeemValue('');
                    setRedeemError('');
                    setRedeemSuccess(false);
                  }}
                  disabled={isRedeeming}
                  className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}

        {licenses.length === 0 ? (
          <div className="bg-gradient-to-br from-[#0f1623] to-[#0a0e1a] border border-[#1a2332] rounded-2xl p-12 text-center">
            <Key size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No Licenses Found</p>
            <p className="text-gray-500 text-sm">Redeem a license key to access Proton products.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {licenses.map((license) => (
              <div key={license.keyValue} className="bg-gradient-to-br from-[#0f1623] to-[#0a0e1a] border border-[#1a2332] rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-white text-lg font-medium">{license.label || 'Proton License'}</div>
                    <div className="text-gray-400 text-sm mt-1 font-mono break-all">{license.keyValue}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${license.expired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {license.expired ? 'Expired' : 'Active'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">Access</div>
                    <div className="text-white">{license.grantedAccess.map((item) => formatAccessLabel(item)).join(', ')}</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Expiration</div>
                    <div className="text-white">{formatExpiration(license.expiresAt)}</div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#1a2332] flex items-center gap-2 text-xs text-gray-400">
                  <Clock size={14} />
                  <span>{getTimeRemaining(license.expiresAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}