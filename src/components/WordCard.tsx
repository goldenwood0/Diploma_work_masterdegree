import { Volume2 } from 'lucide-react';

export default function WordCard({ hz, py, ru }: { hz: string, py: string, ru: string }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5 flex flex-col items-center justify-center text-center group hover:border-primary/50 transition-colors shadow-sm cursor-pointer relative overflow-hidden">
      <button className="absolute top-3 right-3 text-muted-foreground group-hover:text-primary transition-colors">
        <Volume2 size={18} />
      </button>
      <div className="sc-text text-5xl font-bold text-dark-green mb-3 mt-2">{hz}</div>
      <div className="text-primary font-bold tracking-widest mb-1">{py}</div>
      <div className="text-muted-foreground font-medium text-sm">{ru}</div>
    </div>
  )
}
