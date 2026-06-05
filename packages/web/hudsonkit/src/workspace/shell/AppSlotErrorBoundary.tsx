'use client';

import React from 'react';

interface Props {
  appName: string;
  slotName: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AppSlotErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[Hudson] ${this.props.appName}/${this.props.slotName} crashed:`,
      error,
      info.componentStack,
    );
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center h-full min-h-[120px]">
          <div className="text-[10px] font-mono uppercase tracking-widest text-red-400">
            {this.props.appName} / {this.props.slotName}
          </div>
          <div className="text-[11px] text-neutral-500 max-w-[280px] break-words">
            {this.state.error.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={this.handleRetry}
            className="mt-1 px-3 py-1 text-[10px] font-mono uppercase tracking-wider rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
