import React, { Component } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('MELT Global ErrorBoundary caught an exception:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env?.DEV);
      const errorMessage = this.state.error?.toString() || 'Unknown application error';

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-brand-bg text-brand-text transition-colors duration-200">
          {/* Ambient Glow */}
          <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-primary/10 rounded-full blur-[120px] pointer-events-none" />

          <div className="w-full max-w-md bg-brand-surface border border-brand-border rounded-2xl p-6 sm:p-8 shadow-2xl relative z-10 text-center animate-fade-in">
            {/* Warning Icon Badge */}
            <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 text-amber-500 shadow-glow-primary">
              <AlertTriangle className="w-7 h-7" />
            </div>

            {/* Title & Description */}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-brand-text mb-2">
              Something went wrong
            </h1>
            <p className="text-xs sm:text-sm text-brand-muted mb-6 leading-relaxed">
              MELT encountered an unexpected interface issue. Your account data and messages remain secure.
            </p>

            {/* Dev Error Stack */}
            {isDev && this.state.error && (
              <div className="mb-6 p-3 rounded-xl bg-black/40 border border-rose-500/20 text-left overflow-x-auto max-h-36 text-[11px] font-mono text-rose-300">
                <p className="font-semibold">{errorMessage}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="mt-1 text-[10px] text-brand-muted whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium text-xs sm:text-sm hover:opacity-95 active:scale-[0.98] transition-all shadow-glow-primary"
              >
                <RefreshCw className="w-4 h-4 animate-spin-reverse" />
                <span>Reload App</span>
              </button>

              <button
                type="button"
                onClick={this.handleReset}
                className="w-full sm:flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-surface-elevated hover:bg-brand-card-hover border border-brand-border text-brand-text font-medium text-xs sm:text-sm active:scale-[0.98] transition-all"
              >
                <Home className="w-4 h-4 text-brand-muted" />
                <span>Return Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

