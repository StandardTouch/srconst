import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("3D Visualizer Error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          minHeight: '400px',
          background: '#090d16',
          borderRadius: 16,
          border: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: '#f8fafc',
          textAlign: 'center'
        }}>
          <AlertTriangle size={42} color="#f59e0b" style={{ marginBottom: 16 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.2rem', fontWeight: 700 }}>
            Visualizer Initializing
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: 420, margin: '0 0 20px 0' }}>
            The graphics canvas was momentarily refreshed. Click below to reload the interactive model.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              background: '#0284c7',
              border: 'none',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer'
            }}
          >
            <RotateCcw size={16} />
            Reload Visualizer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
