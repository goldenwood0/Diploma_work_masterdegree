import type * as React from 'react';

export default function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 min-w-0 items-center gap-2 border-2 px-3 py-2 rounded-full transition-colors text-sm font-medium ${
        active 
          ? 'bg-secondary border-primary text-primary' 
          : 'border-transparent text-foreground hover:bg-secondary'
      }`}
    >
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="[overflow-wrap:anywhere]">{label}</span>
    </button>
  );
}
