export interface ProductOperationRecord {
  id: string;
  label: string;
  scriptPath: string;
  description: string;
  recommended?: boolean;
}

export interface ProductConfigRecord {
  operationIds: string[];
  notes: string;
  updatedAt: string | null;
}

const PRODUCT_CONFIG_STORAGE_PREFIX = 'proton.web.productConfig.';

export const HWID_SPOOFER_OPERATIONS: ProductOperationRecord[] = [
  {
    id: 'create-restore-point',
    label: 'Create restore point',
    scriptPath: 'scripts/create_restore_point.ps1',
    description: 'Create a system rollback point before changing hardware identifiers.',
    recommended: true,
  },
  {
    id: 'setup-vpn',
    label: 'Setup VPN',
    scriptPath: 'scripts/setup_vpn.ps1',
    description: 'Prepare the VPN adapter before spoofing to reduce network-linked detection.',
    recommended: true,
  },
  {
    id: 'change-registry-hwids',
    label: 'Change registry HWIDs',
    scriptPath: 'scripts/change_registry_hwids.ps1',
    description: 'Rotate registry-backed identifiers used by anti-cheat and telemetry checks.',
  },
  {
    id: 'change-disk-ids',
    label: 'Change disk IDs',
    scriptPath: 'scripts/change_disk_ids.ps1',
    description: 'Change exposed disk serials and volume identifiers.',
  },
  {
    id: 'change-hardware-ids',
    label: 'Change hardware IDs',
    scriptPath: 'scripts/change_hardware_ids.ps1',
    description: 'Run the main hardware ID changer with its backup and restore flow.',
    recommended: true,
  },
  {
    id: 'change-mac-address',
    label: 'Change MAC address',
    scriptPath: 'scripts/change_mac_address.ps1',
    description: 'Rotate the primary adapter MAC address after the VPN adapter is configured.',
    recommended: true,
  },
  {
    id: 'change-monitor-hwid',
    label: 'Change monitor HWID',
    scriptPath: 'scripts/change_monitor_hwid.ps1',
    description: 'Apply monitor serial changes one screen at a time if you use multiple monitors.',
  },
  {
    id: 'hide-peripheral-serials',
    label: 'Hide peripheral serials',
    scriptPath: 'scripts/hide_peripheral_serials.ps1',
    description: 'Mask serials for selected devices such as keyboard, mouse, headset, or controller.',
  },
  {
    id: 'proton-cleaner',
    label: 'Run Proton cleaner',
    scriptPath: 'scripts/Proton_cleaner.ps1',
    description: 'Clean temporary traces after the spoofing pass completes.',
  },
  {
    id: 'uninstall-game',
    label: 'Uninstall game and clear traces',
    scriptPath: 'scripts/uninstall_game.ps1',
    description: 'Use only when you need a full game cleanup before reinstalling.',
  },
];

const DEFAULT_HWID_SPOOFER_OPERATION_IDS = [
  'create-restore-point',
  'setup-vpn',
  'change-registry-hwids',
  'change-disk-ids',
  'change-hardware-ids',
  'change-mac-address',
  'proton-cleaner',
];

export function getProductOperations(productId: string) {
  if (productId === 'hwid-spoofer-temp') {
    return HWID_SPOOFER_OPERATIONS;
  }
  return [];
}

export function getDefaultProductConfig(productId: string): ProductConfigRecord {
  return {
    operationIds: productId === 'hwid-spoofer-temp'
      ? [...DEFAULT_HWID_SPOOFER_OPERATION_IDS]
      : getProductOperations(productId).map((item) => item.id),
    notes: 'Run as administrator and apply VPN before changing adapter-linked identifiers.',
    updatedAt: null,
  };
}

export function getStoredProductConfig(productId: string): ProductConfigRecord {
  const raw = localStorage.getItem(PRODUCT_CONFIG_STORAGE_PREFIX + productId);
  if (!raw) {
    return getDefaultProductConfig(productId);
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProductConfigRecord>;
    const allowedOperationIds = new Set(getProductOperations(productId).map((item) => item.id));
    const operationIds = (parsed.operationIds || []).filter((item): item is string => typeof item === 'string' && allowedOperationIds.has(item));

    return {
      operationIds: operationIds.length ? operationIds : getDefaultProductConfig(productId).operationIds,
      notes: typeof parsed.notes === 'string' ? parsed.notes : getDefaultProductConfig(productId).notes,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return getDefaultProductConfig(productId);
  }
}

export function setStoredProductConfig(productId: string, config: ProductConfigRecord) {
  localStorage.setItem(PRODUCT_CONFIG_STORAGE_PREFIX + productId, JSON.stringify(config));
}

export function resetStoredProductConfig(productId: string) {
  localStorage.removeItem(PRODUCT_CONFIG_STORAGE_PREFIX + productId);
}

export function getConfiguredOperations(productId: string, config: ProductConfigRecord) {
  const selectedIds = new Set(config.operationIds);
  return getProductOperations(productId).filter((item) => selectedIds.has(item.id));
}