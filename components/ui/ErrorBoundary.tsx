import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw, Home } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    private handleGoHome = () => {
        localStorage.removeItem('currentSystem');
        localStorage.removeItem('activeTab');
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 bg-red-50 rounded-2xl border-2 border-red-100 text-center animate-fadeIn">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 mb-2">Ops! Algo deu errado.</h2>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                        Ocorreu um erro ao carregar esta parte do sistema. Isso pode ser um problema temporário de conexão ou um erro inesperado.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                        <button
                            onClick={this.handleReset}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                        >
                            <RefreshCcw size={18} /> Tentar Novamente
                        </button>
                        <button
                            onClick={this.handleGoHome}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 font-bold rounded-xl border-2 border-gray-200 hover:bg-gray-50 transition-all"
                        >
                            <Home size={18} /> Voltar ao Início
                        </button>
                    </div>

                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-8 p-4 bg-gray-800 text-red-400 rounded-lg text-left text-xs font-mono overflow-auto max-w-full">
                            {this.state.error?.toString()}
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
