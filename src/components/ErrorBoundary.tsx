import React from 'react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error) {
    console.error('IMMERSO ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] text-[#2A231E] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E5DDD0] rounded-2xl p-8 text-center shadow-sm">
            <p className="text-xs tracking-[0.2em] uppercase text-[#70685E] mb-2">IMMERSO Atelier</p>
            <h1 className="font-editorial text-3xl font-medium mb-3">Something paused briefly</h1>
            <p className="text-sm text-[#70685E] mb-6 leading-relaxed">
              We encountered an unexpected state. Reloading restores your session and saved bag.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-[#2A231E] text-[#FDFBF7] text-sm font-medium rounded-lg hover:bg-[#3F352E] transition-colors cursor-pointer"
            >
              Reload IMMERSO
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
