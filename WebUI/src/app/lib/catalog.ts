import productImage from '../../assets/260faf0849cc1b42163fda5d0ada4b24b4c1ab64.png';

export interface ProductRecord {
  id: string;
  name: string;
  description: string;
  game: string;
  status: 'Online' | 'Locked';
  access: string;
  version: string;
  updatedAt: string;
  image: string;
}

export const PRODUCT_CATALOG: ProductRecord[] = [
  {
    id: 'hwid-spoofer-temp',
    name: 'HWID Spoofer (temp)',
    description: 'Temporary spoofing profile with clean launch flow and fast device masking for repeated testing.',
    game: 'Universal',
    status: 'Online',
    access: 'core',
    version: 'v2.4.1',
    updatedAt: '17th Nov, 2025',
    image: productImage,
  },
];

export function hasAccess(accessList: string[], access: string) {
  if (access === 'core') {
    return true;
  }
  return accessList.indexOf(access) !== -1;
}

export function getVisibleProducts(accessList: string[]) {
  return PRODUCT_CATALOG.map((product) => ({
    ...product,
    isUnlocked: hasAccess(accessList, product.access),
  }));
}

export function getUnlockedProducts(accessList: string[]) {
  return getVisibleProducts(accessList).filter((product) => product.isUnlocked);
}

export function getProductById(productId: string | undefined) {
  return PRODUCT_CATALOG.find((product) => product.id === productId) || PRODUCT_CATALOG[0];
}

export function getPrimaryProduct(accessList: string[]) {
  return getVisibleProducts(accessList).find((product) => product.isUnlocked) || PRODUCT_CATALOG[0];
}

export function formatAccessLabel(access: string) {
  return access
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}