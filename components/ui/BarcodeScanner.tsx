import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, RotateCw } from 'lucide-react';

interface Props {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose }) => {
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const html5QrCode = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        html5QrCode.current = new Html5Qrcode("reader");

        const startScanner = async () => {
            try {
                // Determine the config based on screen size
                const isMobile = window.innerWidth < 640;
                const qrBoxSize = isMobile ? { width: 250, height: 150 } : { width: 300, height: 180 };

                await html5QrCode.current?.start(
                    { facingMode: "environment" },
                    {
                        fps: 15,
                        qrbox: qrBoxSize,
                        aspectRatio: isMobile ? 1 : 1.777778,
                    },
                    (decodedText) => {
                        onScan(decodedText);
                    },
                    () => {
                        // silent errors (frame scan failures)
                    }
                );
                setIsReady(true);
            } catch (err) {
                setError("Não foi possível acessar a câmera. Verifique as permissões.");
                console.error(err);
            }
        };

        const timer = setTimeout(startScanner, 300);

        return () => {
            clearTimeout(timer);
            if (html5QrCode.current && html5QrCode.current.isScanning) {
                html5QrCode.current.stop().catch(e => console.error("Error stopping scanner", e));
            }
        };
    }, [onScan]);

    const handleStop = async () => {
        if (html5QrCode.current && html5QrCode.current.isScanning) {
            await html5QrCode.current.stop();
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-ifrn-green/10 rounded-xl text-ifrn-green">
                            <Camera size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800">Escanear Código</h3>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Aponte para o código de barras</p>
                        </div>
                    </div>
                    <button
                        onClick={handleStop}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors group"
                        type="button"
                    >
                        <X size={24} className="text-gray-400 group-hover:text-gray-600" />
                    </button>
                </div>

                <div className="relative aspect-square sm:aspect-video bg-gray-900 overflow-hidden">
                    {!isReady && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
                            <RotateCw className="animate-spin text-ifrn-green" size={32} />
                            <span className="text-sm font-medium">Iniciando câmera...</span>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-red-50 text-red-600 gap-3">
                            <p className="font-bold text-sm leading-tight">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-xs"
                                type="button"
                            >
                                Tentar Novamente
                            </button>
                        </div>
                    )}

                    <div id="reader" className="w-full h-full"></div>

                    {isReady && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-[250px] sm:w-[300px] h-[150px] sm:h-[180px] border-2 border-ifrn-green rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] relative">
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-scan-line"></div>

                                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-ifrn-green"></div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-ifrn-green"></div>
                                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-ifrn-green"></div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-ifrn-green"></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50 text-center">
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                        Certifique-se de que o código esteja bem iluminado e centralizado no retângulo.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes scan-line {
                    0% { top: 0% }
                    100% { top: 100% }
                }
                .animate-scan-line {
                    animation: scan-line 2s linear infinite;
                }
            `}</style>
        </div>
    );
};
