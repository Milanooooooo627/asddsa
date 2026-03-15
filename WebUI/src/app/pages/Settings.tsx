import { useState } from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const themes = [
  { id: 'overlay', name: 'Overlay', gradient: 'from-gray-700 to-gray-800' },
  { id: 'abyssal', name: 'Abyssal Blue', gradient: 'from-blue-900 to-blue-950' },
  { id: 'slate', name: 'Slate Shadow', gradient: 'from-gray-800 to-slate-900' },
  { id: 'solar', name: 'Solar Sand', gradient: 'from-orange-900 to-yellow-950' },
  { id: 'blood', name: 'Blood Nova', gradient: 'from-red-900 to-red-950' },
  { id: 'violet', name: 'Violet Shade', gradient: 'from-purple-900 to-violet-950' },
  { id: 'emerald', name: 'Emerald Core', gradient: 'from-emerald-900 to-green-950' },
  { id: 'sun', name: 'Sun Flare', gradient: 'from-orange-800 to-red-900' },
  { id: 'plasma', name: 'Plasma Gold', gradient: 'from-yellow-700 to-amber-900' },
];

export function Settings() {
  const { apiBase, setApiBase, theme, setTheme, checkHealth } = useAuth();
  const [draftApiBase, setDraftApiBase] = useState(apiBase);
  const [healthMessage, setHealthMessage] = useState('Use the local Flask API while developing.');

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-2 text-xs mb-4 text-gray-400">
        <span className="text-gray-400">🏠</span>
        <span className="text-gray-400">/</span>
        <span className="text-white">Settings</span>
      </div>

      <h1 className="text-lg mb-1 text-white">Settings</h1>
      <p className="text-gray-400 mb-6 text-xs">
        Customize your style of Proton
      </p>

      <div className="mb-8">
        <h2 className="text-base text-white mb-1 font-medium">Overlay Theme</h2>
        <p className="text-gray-400 text-xs mb-4">
          Adds a tinted gradient overlay to the dashboard for extra depth.
        </p>

        <div className="grid grid-cols-3 gap-3">
          {themes.map((themeOption) => (
            <button
              key={themeOption.id}
              onClick={() => {
                setTheme(themeOption.id);
              }}
              className={`bg-gradient-to-br from-[#0a1628] to-[#051018] border rounded-xl p-3 text-left transition-all duration-200 ${
                theme === themeOption.id
                  ? 'border-[#2563eb] shadow-lg shadow-[#2563eb]/10'
                  : 'border-[#152a45] hover:border-[#1e3a5f] hover:scale-[1.02]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg bg-gradient-to-br ${themeOption.gradient} flex-shrink-0 shadow-md`}
                />

                <span className="text-white text-sm">{themeOption.name}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base text-white mb-1 font-medium">Connection</h2>
        <p className="text-gray-400 text-xs mb-4">Point the UI at your Flask API and verify it is reachable.</p>

        <div className="bg-gradient-to-br from-[#0a1628] to-[#051018] border border-[#152a45] rounded-xl p-4 space-y-4">
          <input
            type="text"
            value={draftApiBase}
            onChange={(event) => setDraftApiBase(event.target.value)}
            className="w-full bg-[#0a1628]/50 border border-[#1e3a5f] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#2563eb] transition-colors"
            placeholder="http://127.0.0.1:5000"
          />
          <div className="flex gap-3">
            <button
              onClick={() => {
                setApiBase(draftApiBase);
                setHealthMessage('API base updated for this session.');
              }}
              className="bg-[#2563eb] hover:bg-[#3b82f6] px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Save API URL
            </button>
            <button
              onClick={async () => {
                try {
                  const message = await checkHealth(draftApiBase);
                  setHealthMessage(message);
                } catch (error) {
                  if (error instanceof ApiError) {
                    setHealthMessage(error.message);
                  } else {
                    setHealthMessage('API unavailable');
                  }
                }
              }}
              className="bg-[#0a1628]/50 border border-[#1e3a5f] hover:border-[#2563eb] px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Check API Health
            </button>
          </div>
          <p className="text-sm text-gray-400">Current API: <span className="text-white">{apiBase}</span></p>
          <p className="text-sm text-[#9fc1ff]">{healthMessage}</p>
        </div>
      </div>
    </div>
  );
}