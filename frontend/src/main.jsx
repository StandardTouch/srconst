import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Clean unmount if already mounted to prevent double-rendering in Frappe Desk
if (window.__srconstReactRoot) {
  try {
    window.__srconstReactRoot.unmount();
  } catch (e) {
    console.warn('React unmount warning:', e);
  }
  window.__srconstReactRoot = null;
}

const target = document.getElementById('react-sales-dashboard') || document.getElementById('root');
if (target) {
  target.innerHTML = '';
  const root = createRoot(target);
  window.__srconstReactRoot = root;
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
