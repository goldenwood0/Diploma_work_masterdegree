import { useState } from 'react';
import { authAction, type Account } from '../api/auth';
import { Settings, Bell } from 'lucide-react';

export default function Profile({ account, onSignedOut }: { account: Account; onSignedOut: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function logout(all: boolean) {
    setBusy(true); setError('');
    try { await authAction(all ? 'logout-all' : 'logout'); await onSignedOut(); }
    catch { setError('Не удалось выйти. Попробуйте ещё раз.'); }
    finally { setBusy(false); }
  }
  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <header className="flex items-center gap-6 bg-white p-6 sm:p-8 rounded-3xl border border-border shadow-sm">
        <div className="size-20 sm:size-24 rounded-full bg-coral text-white flex items-center justify-center text-3xl font-bold uppercase">
          {account.name.charAt(0)}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-dark-green">{account.name}</h1>
          <p className="text-muted-foreground font-medium mt-1">{account.email}</p>
          <div className="mt-3 inline-flex items-center gap-2 bg-accent/20 text-accent-foreground px-3 py-1 rounded-lg text-sm font-bold border border-accent/30">
            Email подтверждён
          </div>
        </div>
      </header>

      <section className="bg-white rounded-3xl border border-border p-6 space-y-4">
        <h2 className="font-bold text-xl">Безопасность аккаунта</h2>
        {error && <p role="alert">{error}</p>}
        <div className="flex flex-wrap gap-4">
          <button disabled={busy} className="text-primary underline disabled:opacity-50" onClick={() => void logout(false)}>Выйти</button>
          <button disabled={busy} className="text-primary underline disabled:opacity-50" onClick={() => void logout(true)}>Выйти со всех устройств</button>
        </div>
      </section>
      <p className="text-sm text-muted-foreground">Настройки обучения появятся на следующем этапе.</p>
      <fieldset disabled className="bg-white rounded-3xl border border-border shadow-sm overflow-hidden opacity-60">
        <div className="p-6 sm:p-8 border-b border-border">
          <h2 className="text-xl font-bold text-dark-green flex items-center gap-2 mb-6">
            <Settings size={20} className="text-primary" /> Настройки обучения
          </h2>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-bold text-dark-green">Язык объяснений</label>
              <div className="flex bg-secondary p-1 rounded-xl">
                <button className="flex-1 py-2 text-sm font-bold bg-white text-foreground rounded-lg shadow-sm">Русский</button>
                <button className="flex-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Қазақша</button>
                <button className="flex-1 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">English</button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-bold text-dark-green">Целевой уровень</label>
              <select className="w-full bg-white border border-border rounded-xl py-3 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none">
                <option value="hsk1">HSK 1 (Начинающий)</option>
                <option value="hsk2">HSK 2 (Элементарный)</option>
                <option value="hsk3">HSK 3 (Средний)</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-bold text-dark-green">Дневная норма (мин)</label>
              <div className="flex items-center gap-4">
                 <input type="range" min="5" max="60" step="5" defaultValue="20" className="flex-1 accent-primary" />
                 <span className="font-bold text-primary w-12 text-right">20 м</span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 bg-sage/30">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-3">
               <div className="p-2 bg-white rounded-xl shadow-sm">
                 <Bell size={20} className="text-primary" />
               </div>
               <div>
                 <h3 className="font-bold text-dark-green">Уведомления о практике</h3>
                 <p className="text-sm text-muted-foreground">Напоминать о ежедневной цели</p>
               </div>
             </div>
             {/* Toggle switch mock */}
             <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
               <div className="absolute right-1 top-1 bottom-1 w-4 bg-white rounded-full"></div>
             </div>
           </div>
        </div>
      </fieldset>
    </div>
  );
}
