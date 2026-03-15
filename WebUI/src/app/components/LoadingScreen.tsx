import { Logo } from './Logo';

export function LoadingScreen() {
  return (
    <div className="w-full h-full box-border bg-gradient-to-br from-[#0a1628] to-[#051018] flex flex-col items-center justify-center overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-[#2563eb]/10 rounded-full blur-3xl -top-20 -left-20 animate-pulse" />
        <div className="absolute w-96 h-96 bg-[#1e40af]/10 rounded-full blur-3xl -bottom-20 -right-20 animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 animate-pulse">
          <Logo size={80} />
        </div>
        <div className="w-8 h-8 border-[3px] border-[#2563eb]/30 border-t-[#2563eb] rounded-full animate-spin" />
      </div>
    </div>
  );
}