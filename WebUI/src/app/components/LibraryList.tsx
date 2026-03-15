import { useNavigate } from 'react-router';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getVisibleProducts } from '../lib/catalog';

export function LibraryList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const accessList = user ? user.uiAccess : ['core'];
  const products = getVisibleProducts(accessList);
  const showKeyReminder = Boolean(user && user.role === 'user' && user.activeKeys.length === 0);

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 text-xs mb-4 text-gray-400">
        <span>⌂</span>
        <span>/</span>
        <span className="text-white">Library</span>
      </div>

      <h1 className="text-lg mb-1 text-white">Your Library</h1>
      <p className="text-gray-400 mb-5 text-xs">
        All products available to your licenses.
      </p>

      {showKeyReminder ? (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4 flex items-center gap-2">
          <Lock size={16} className="text-yellow-500" />
          <span className="text-yellow-500 text-xs">You only have core access. Redeem a license key in Profile to unlock more products.</span>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => product.isUnlocked && navigate(`/library/${product.id}`)}
            disabled={!product.isUnlocked}
            className={`bg-gradient-to-br from-[#0a1628] to-[#051018] border border-[#152a45] rounded-xl p-4 text-left transition-all duration-200 ${
              product.isUnlocked
                ? 'hover:border-[#2563eb] hover:scale-[1.02] hover:shadow-lg hover:shadow-[#2563eb]/10 cursor-pointer'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className="relative">
                <img src={product.image} alt={product.name} className="w-8 h-8 rounded" />
                {!product.isUnlocked ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded backdrop-blur-sm">
                    <Lock size={14} className="text-white" />
                  </div>
                ) : null}
              </div>
              <div className="flex-1">
                <h3 className="text-sm text-white mb-1 font-medium">{product.name}</h3>
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{product.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-[#1a2332]">
              <span className="text-xs text-gray-400">{product.game}</span>
              <span className={`text-xs font-medium ${product.isUnlocked ? 'text-green-400' : 'text-gray-500'}`}>
                {product.isUnlocked ? product.status : 'Locked'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}