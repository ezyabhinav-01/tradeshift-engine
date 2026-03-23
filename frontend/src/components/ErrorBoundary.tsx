import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from './ui/button';

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Uncaught error in ${this.props.name || 'Component'}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#131722] text-[#d1d4dc] p-6 border border-[#f23645]/20 rounded-lg">
          <AlertTriangle size={48} className="text-[#f23645] mb-4 opacity-80" />
          <h2 className="text-sm font-black uppercase tracking-widest mb-2">Component Crashed</h2>
          <p className="text-[10px] text-center text-[#d1d4dc]/60 mb-6 max-w-[200px]">
            {this.props.name || 'Chart'} encountered a critical error. {this.state.error?.message}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2 border-[#2a2e39] hover:bg-white/5 h-8 text-[10px] font-bold"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCcw size={14} />
            RESTORE CHART
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
