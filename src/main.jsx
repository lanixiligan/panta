import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Panta could not render this view.', error, info);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-render-error" role="alert">
          <span className="section-kicker">PANTA</span>
          <h1>This view couldn’t load.</h1>
          <p>Reload Panta to try again. If it keeps happening, open the browser console and share the error.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload Panta</button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>,
);
