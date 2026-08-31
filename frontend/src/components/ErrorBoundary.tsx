import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in UI boundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
          <div className="max-w-md rounded-xl border border-rose-900/50 bg-slate-900 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Application Exception</h2>
            <p className="mt-2 text-sm text-slate-400">
              A UI rendering error occurred. The system safely caught the failure.
            </p>
            {this.state.error && (
              <div className="mt-4 rounded-lg bg-slate-950 p-3 text-left font-mono text-xs text-rose-300">
                {this.state.error.message}
              </div>
            )}
            <div className="mt-6">
              <Button onClick={this.handleReset} variant="primary" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" /> Reload System
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
