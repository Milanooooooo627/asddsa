import { X } from 'lucide-react';
import { useState } from 'react';

interface ProductConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProductConfigModal({ isOpen, onClose }: ProductConfigModalProps) {
  const [selectedBypass, setSelectedBypass] = useState<string>('proton');

  if (!isOpen) return null;

  const bypassOptions = [
    { id: 'proton', name: 'Proton', icon: '⚛️' },
    { id: 'stealth', name: 'Stealth Mode', icon: '👁️' },
    { id: 'hardware', name: 'Hardware Spoof', icon: '🔧' },
    { id: 'kernel', name: 'Kernel Guard', icon: '🛡️' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#0d0d0d] border border-[#1a2332] rounded-xl w-[340px] p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-white text-base mb-1">Product Configuration</h2>
            <p className="text-gray-400 text-xs">Set your own rules for your product.</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* TPM Bypass Options */}
        <div className="mt-6">
          <h3 className="text-white text-sm mb-2">TPM Bypass Method</h3>
          <p className="text-gray-400 text-xs mb-3">Select the bypass method you wish to use.</p>

          <div className="grid grid-cols-2 gap-2">
            {bypassOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedBypass(option.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                  selectedBypass === option.id
                    ? 'bg-[#1a2332] border-[#2a3342] text-white'
                    : 'bg-transparent border-dashed border-[#1a2332] text-gray-400 hover:text-white hover:border-[#2a3342]'
                }`}
              >
                <span className="text-base">{option.icon}</span>
                <span className="text-xs">{option.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={onClose}
          className="w-full mt-6 bg-[#4A7FE7] hover:bg-[#5a8ff7] text-white rounded-lg py-2.5 text-sm transition-colors"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
}
