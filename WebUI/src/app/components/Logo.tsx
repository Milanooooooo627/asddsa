import logoImage from '../../assets/3abc016c8b5fa4bb86cd04babfd1ef0f412f3ad4.png';

export function Logo({ size = 48 }: { size?: number }) {
  return (
    <img src={logoImage} alt="Proton Logo" width={size} height={size} className="object-contain" />
  );
}