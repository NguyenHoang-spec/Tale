import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  onReset: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset();
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 text-parchment-100 font-serif p-6 animate-fade-in">
            <div className="max-w-md w-full bg-ink-900 border-2 border-crimson-600 rounded-xl p-8 text-center shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-pulse-slow relative overflow-hidden">
                {/* Background Noise */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none"></div>
                
                <div className="text-6xl mb-6 text-crimson-500 animate-bounce"><i className="fas fa-biohazard"></i></div>
                <h2 className="text-2xl font-bold text-crimson-400 mb-4 font-display uppercase tracking-widest">Lỗi Dòng Thời Gian</h2>
                <p className="text-zinc-400 mb-8 text-sm leading-relaxed">
                    Thiên đạo vận hành gặp trục trặc nghiêm trọng (Lỗi hiển thị/Dữ liệu). Thế giới đang đứng trước nguy cơ sụp đổ.
                    <br/>
                    <span className="text-xs italic text-crimson-500/70 mt-3 block border-t border-crimson-900/50 pt-2">
                        {this.state.error?.message || "Unknown Error"}
                    </span>
                </p>
                <button 
                    onClick={this.handleReset}
                    className="w-full bg-crimson-600 hover:bg-crimson-500 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-105 uppercase tracking-wider flex items-center justify-center gap-3 border border-crimson-400"
                >
                    <i className="fas fa-history text-xl"></i>
                    Quay Ngược Thời Gian (Fix)
                </button>
                <div className="mt-4 text-[10px] text-zinc-600 uppercase tracking-widest">
                    Hệ thống tự động bảo vệ dữ liệu
                </div>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}