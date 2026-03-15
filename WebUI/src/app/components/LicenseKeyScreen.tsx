import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, ArrowLeft, Key } from 'lucide-react';
import { Logo } from './Logo';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface LicenseKeyScreenProps {
  email: string;
  password: string;
  onClose: () => void;
}

export function LicenseKeyScreen({ email, password, onClose }: LicenseKeyScreenProps) {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState({ title: '', message: '', code: '' });

  const showErrorToast = (title: string, message: string, code: string) => {
    setToastMessage({ title, message, code });
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 3000);
  };

  const handleActivate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!licenseKey.trim()) {
      showErrorToast('Missing License Key', 'Enter a valid license key to continue.', 'KEY_REQUIRED_001');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, licenseKey.trim().toUpperCase());
      navigate('/library');
    } catch (error) {
      if (error instanceof ApiError) {
        const message = error.message;
        const code = message.indexOf('already used') !== -1
          ? 'KEY_USED_004'
          : message.indexOf('Invalid license key') !== -1
            ? 'INVALID_KEY_003'
            : 'REGISTER_KEY_005';
        showErrorToast('License Activation Failed', message, code);
      } else {
        showErrorToast('Network Error', 'Unable to reach the authentication service.', 'NETWORK_001');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full box-border bg-[#0d0d0d] flex items-center justify-center overflow-hidden relative">
      {showToast ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-[slideDown_0.3s_ease-out]">
          <div className="bg-red-500/95 border border-red-600 rounded-lg p-4 shadow-2xl min-w-[400px] max-w-[500px]">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-white flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{toastMessage.title}</p>
                <p className="text-white/90 text-xs mt-1">{toastMessage.message}</p>
                <p className="text-white/70 text-xs mt-1 font-mono">Error Code: {toastMessage.code}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="w-full h-full flex items-center justify-center">
        <div className="w-full h-full bg-gradient-to-br from-[#0a1628] to-[#051018] border border-[#152a45] rounded-2xl p-8 shadow-2xl flex flex-col justify-center items-center">
          <div className="flex justify-center mb-4">
            <Logo size={70} />
          </div>

          <h1 className="text-2xl text-center mb-2 text-white font-medium">Activate Your Account</h1>
          <p className="text-center text-gray-400 mb-8 text-sm max-w-md">
            Enter your license key to activate your Proton account and get started.
          </p>

          <form onSubmit={handleActivate} className="w-full max-w-md space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Key size={16} className="text-[#2563eb]" />
                <label className="text-gray-400 text-sm">License Key</label>
              </div>
              <input
                type="text"
                placeholder="PROTON-XXXX-XXXX-XXXX-XXXX"
                className="w-full bg-[#0a1628]/50 border border-[#1e3a5f] text-white rounded-lg px-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none transition-colors font-mono"
                disabled={isLoading}
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value.toUpperCase())}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">Each license key can only be used once to activate an account.</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 bg-[#0a1628]/50 border border-[#1e3a5f] hover:border-[#2563eb] text-white rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-all duration-200"
              >
                <ArrowLeft size={16} />
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading || !licenseKey}
                className="flex-1 bg-[#2563eb] hover:bg-[#3b82f6] disabled:hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg px-4 py-3 text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:shadow-lg hover:shadow-[#2563eb]/30 font-medium"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-[spin_1.5s_linear_infinite]" />
                ) : (
                  <>
                    <Key size={16} />
                    Activate Account
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-gray-500 text-xs mt-8">Developed by Proton Team © 2025</p>
        </div>
      </div>
    </div>
  );
}