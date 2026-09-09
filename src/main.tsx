import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import LanguageProvider from './i18n/LanguageProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider><ErrorBoundary><App /></ErrorBoundary></LanguageProvider>
  </React.StrictMode>,
)
