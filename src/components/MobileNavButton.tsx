import type * as React from 'react';

export default function MobileNavButton({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`p-3 rounded-2xl transition-colors ${
        active 
          ? 'bg-secondary text-primary' 
          : 'text-foreground/50 hover:bg-secondary/30 hover:text-foreground/80'
      }`}
    >
      {icon}
    </button>
  );
}
