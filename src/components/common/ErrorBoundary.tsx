import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ShieldAlert, Home } from 'lucide-react';
import { safeStorage } from '../../lib/safeStorage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Motoride Uncaught Crash Error]:', error, errorInfo);
    this.setState({
      hasError: true,
      error,
      errorInfo,
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleClearCacheAndRestart = () => {
    try {
      safeStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.href = window.location.origin + window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center gap-4">
            
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <AlertTriangle className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-black tracking-tight text-white">
                Motoride Encountered an Issue
              </h2>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                The mobile app caught a runtime exception. You can recover instantly without losing your account.
              </p>
            </div>

            {this.state.error && (
              <div className="w-full p-3 rounded-2xl bg-slate-950 border border-slate-800/80 text-left overflow-hidden">
                <span className="text-[10px] font-mono font-bold text-amber-400 block mb-1 uppercase tracking-wider">
                  Diagnostic Info:
                </span>
                <p className="text-xs font-mono text-slate-300 break-words line-clamp-3">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}

            <div className="flex flex-col w-full gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4 stroke-[2.5]" />
                Restart Motoride App
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndRestart}
                className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-750 active:scale-98 text-slate-300 hover:text-white font-bold text-xs border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4 text-slate-400" />
                Clear Cache & Reset Screen
              </button>
            </div>

            <span className="text-[10px] text-slate-500 font-mono">
              Motoride v1.0.0 • Mobile Crash Shield Active
            </span>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
