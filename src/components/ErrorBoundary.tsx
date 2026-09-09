import { Component, type ReactNode } from 'react';

export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <main role="alert" className="max-w-xl mx-auto my-16 p-8 space-y-4">
          <h1 className="text-2xl font-bold">Не удалось открыть страницу</h1>
          <p>Попробуйте перезагрузить приложение.</p>
          <button className="bg-primary text-primary-foreground rounded-xl px-5 py-3" onClick={() => window.location.reload()}>Перезагрузить</button>
        </main>
      );
    }
    return this.props.children;
  }
}
