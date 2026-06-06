'use client';

import React from 'react';

interface Props {
  workspaceName: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class WorkspaceErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      `[Hudson] Workspace "${this.props.workspaceName}" crashed:`,
      error,
      info.componentStack,
    );
  }

  handleReload = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-950 text-center">
          <div className="text-[10px] font-mono uppercase tracking-widest text-red-400">
            Workspace Error
          </div>
          <div className="text-[13px] text-neutral-300 font-medium">
            {this.props.workspaceName} encountered an error
          </div>
          <div className="text-[11px] text-neutral-500 max-w-[400px] break-words">
            {this.state.error.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={this.handleReload}
            className="mt-2 px-4 py-2 text-[11px] font-mono uppercase tracking-wider rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            Reload Workspace
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
