import type * as React from 'react';

export default function MobileNavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex min-w-0 min-h-16 flex-col items-center justify-start gap-1 px-1 py-2 rounded-xl border-2 transition-colors ${
        active 
          ? 'bg-secondary border-primary text-primary font-bold' 
          : 'border-transparent text-foreground hover:bg-secondary font-medium'
      }`}
    >
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="w-full text-center text-xs leading-4 [overflow-wrap:anywhere]">{label}</span>
    </button>
  );
}
