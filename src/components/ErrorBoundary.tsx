import { Component, type ReactNode } from 'react';
import { useLanguage } from '../i18n/LanguageProvider';

function ErrorScreen() {
  const { t } = useLanguage();
  return <main role="alert" className="max-w-xl mx-auto my-16 p-8 space-y-4">
    <h1 className="text-2xl font-bold">{t('Не удалось открыть страницу')}</h1>
    <p>{t('Попробуйте перезагрузить приложение.')}</p>
    <button className="bg-primary text-primary-foreground rounded-xl px-5 py-3" onClick={() => window.location.reload()}>{t('Перезагрузить')}</button>
  </main>;
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <ErrorScreen />;
    }
    return this.props.children;
  }
}
