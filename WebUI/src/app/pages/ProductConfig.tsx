import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, Check, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProductById, hasAccess } from '../lib/catalog';
import {
  getConfiguredOperations,
  getDefaultProductConfig,
  getProductOperations,
  getStoredProductConfig,
  resetStoredProductConfig,
  setStoredProductConfig,
  type ProductConfigRecord,
} from '../lib/productConfig';

export function ProductConfig() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const product = getProductById(productId);
  const isUnlocked = hasAccess(user ? user.uiAccess : ['core'], product.access);
  const operations = useMemo(() => getProductOperations(product.id), [product.id]);
  const [config, setConfig] = useState<ProductConfigRecord>(() => getDefaultProductConfig(product.id));
  const [message, setMessage] = useState('');

  useEffect(() => {
    setConfig(getStoredProductConfig(product.id));
    setMessage('');
  }, [product.id]);

  const configuredOperations = useMemo(() => getConfiguredOperations(product.id, config), [product.id, config]);

  const toggleOperation = (operationId: string) => {
    setConfig((current) => {
      const nextIds = current.operationIds.includes(operationId)
        ? current.operationIds.filter((item) => item !== operationId)
        : [...current.operationIds, operationId];

      return {
        ...current,
        operationIds: nextIds,
      };
    });
    setMessage('');
  };

  const handleSave = () => {
    const nextConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    setStoredProductConfig(product.id, nextConfig);
    setConfig(nextConfig);
    setMessage('Product configuration saved locally.');
  };

  const handleReset = () => {
    resetStoredProductConfig(product.id);
    const nextConfig = getDefaultProductConfig(product.id);
    setConfig(nextConfig);
    setMessage('Product configuration reset to defaults.');
  };

  if (!isUnlocked) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-xs mb-4 text-gray-400">
          <span>⌂</span>
          <span>/</span>
          <Link to="/library" className="hover:text-white transition-colors">Library</Link>
          <span>/</span>
          <span className="text-white">Product Config</span>
        </div>

        <div className="bg-gradient-to-br from-[#160d12] to-[#0a0e1a] border border-[#4b2027] rounded-xl p-6 text-center">
          <div className="text-5xl text-white mb-2">401</div>
          <p className="text-sm text-gray-300">Your current license does not unlock this product configuration.</p>
          <Link to="/library" className="inline-block mt-4 bg-[#4A7FE7] hover:bg-[#5B8DEF] px-4 py-2 rounded-lg text-sm transition-colors">
            Return to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="flex items-center gap-2 text-xs mb-4 text-gray-400">
        <span>⌂</span>
        <span>/</span>
        <Link to="/library" className="hover:text-white transition-colors">Library</Link>
        <span>/</span>
        <Link to={`/library/${product.id}`} className="hover:text-white transition-colors">{product.name}</Link>
        <span>/</span>
        <span className="text-white">Config</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg mb-1 text-white">{product.name} Config</h1>
          <p className="text-gray-400 text-xs leading-relaxed max-w-2xl">
            Configure the local spoofing plan that matches the scripts bundled in this workspace. This page saves your selected steps locally and keeps the product detail screen in sync.
          </p>
        </div>
        <button
          onClick={() => navigate(`/library/${product.id}`)}
          className="rounded-lg border border-[#1a2840] bg-[#0a0e1a] px-4 py-2 text-sm text-white transition-colors hover:border-[#4A7FE7]"
        >
          Back to Product
        </button>
      </div>

      <div className="grid grid-cols-[1.4fr_0.9fr] gap-5">
        <div className="space-y-5">
          <div className="bg-gradient-to-br from-[#0a1628] to-[#051018] border border-[#152a45] rounded-xl p-4">
            <div className="mb-4">
              <h2 className="text-sm text-white font-medium">Execution Plan</h2>
              <p className="text-gray-400 text-xs mt-1">Choose which local scripts should be part of this product configuration.</p>
            </div>

            <div className="space-y-3">
              {operations.map((operation) => {
                const selected = config.operationIds.includes(operation.id);
                return (
                  <button
                    key={operation.id}
                    onClick={() => toggleOperation(operation.id)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${selected ? 'border-[#4A7FE7] bg-[#4A7FE7]/10' : 'border-[#1a2840] bg-[#0a0e1a] hover:border-[#31599e]'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-white">
                          <span>{operation.label}</span>
                          {operation.recommended ? <span className="rounded bg-green-500/15 px-2 py-0.5 text-[11px] text-green-300">Recommended</span> : null}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">{operation.description}</div>
                        <div className="mt-2 text-[11px] text-[#8fa8d3]">{operation.scriptPath}</div>
                      </div>
                      <div className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${selected ? 'border-[#4A7FE7] bg-[#4A7FE7] text-white' : 'border-[#3c4c68] text-transparent'}`}>
                        <Check size={12} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-gradient-to-br from-[#0a1628] to-[#051018] border border-[#152a45] rounded-xl p-4">
            <h2 className="text-sm text-white font-medium">Config Summary</h2>
            <div className="mt-4 space-y-3 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Selected steps</span>
                <span className="text-white">{configuredOperations.length}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Last saved</span>
                <span className="text-white">{config.updatedAt ? new Date(config.updatedAt).toLocaleString() : 'Not saved yet'}</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-[#1a2840] bg-[#0a0a0a] p-3">
              <div className="text-xs text-gray-500 mb-2">Execution order</div>
              <div className="space-y-2 text-xs text-gray-300">
                {configuredOperations.length ? configuredOperations.map((operation, index) => (
                  <div key={operation.id} className="flex gap-2">
                    <span className="text-[#4A7FE7]">{index + 1}.</span>
                    <span>{operation.label}</span>
                  </div>
                )) : <div className="text-gray-500">No steps selected.</div>}
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#16100a] to-[#0a0e1a] border border-[#4b3e20] rounded-xl p-4">
            <div className="flex items-center gap-2 text-sm text-yellow-200">
              <AlertTriangle size={16} />
              Operational Notes
            </div>
            <textarea
              value={config.notes}
              onChange={(event) => {
                setConfig((current) => ({ ...current, notes: event.target.value }));
                setMessage('');
              }}
              className="mt-3 h-32 w-full rounded-xl border border-[#3b311c] bg-[#0a0a0a] p-3 text-xs text-gray-200 focus:outline-none focus:border-[#4A7FE7]"
              placeholder="Add operator notes for this profile..."
            />
            <p className="mt-3 text-[11px] text-yellow-100/75">
              This UI does not execute the PowerShell scripts directly. It stores the local run plan for the product, using the actual script layout already bundled in the workspace.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 rounded-lg bg-[#4A7FE7] px-4 py-2 text-sm text-white transition-colors hover:bg-[#5B8DEF]"
            >
              <span className="inline-flex items-center gap-2"><Save size={15} />Save Config</span>
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-[#1a2840] bg-[#0a0e1a] px-4 py-2 text-sm text-white transition-colors hover:border-[#4A7FE7]"
            >
              <span className="inline-flex items-center gap-2"><RotateCcw size={15} />Reset</span>
            </button>
          </div>

          {message ? (
            <div className="rounded-xl border border-[#4A7FE7]/30 bg-[#4A7FE7]/10 px-4 py-3 text-xs text-[#bfd4ff]">
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}