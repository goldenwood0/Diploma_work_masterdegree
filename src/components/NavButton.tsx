import type * as React from 'react';

export default function NavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors text-sm font-medium ${
        active 
          ? 'bg-secondary text-primary' 
          : 'text-foreground/70 hover:bg-secondary/50 hover:text-foreground'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
