import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RotateCw } from 'lucide-react';

interface Props {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose }) => {
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const html5QrCode = useRef<Html5Qrcode | null>(null);
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    useEffect(() => {
        html5QrCode.current = new Html5Qrcode("reader", {
            verbose: false,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.ITF,
                Html5QrcodeSupportedFormats.CODABAR
            ]
        });

        const startScanner = async () => {
            try {
                await html5QrCode.current?.start(
                    {
                        facingMode: "environment"
                    },
                    {
                        fps: 30,
                        // NO qrbox - scan the ENTIRE camera frame
                        // This is critical for dense/long 1D barcodes like PNLD Code 128
                        disableFlip: false,
                    },
                    (decodedText) => {
                        onScanRef.current(decodedText);
                    },
                    () => {
                        // silent scan failure per frame
                    }
                );
                setIsReady(true);
            } catch (err) {
                setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
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
    }, []);

    const handleStop = useCallback(async () => {
        if (html5QrCode.current && html5QrCode.current.isScanning) {
            await html5QrCode.current.stop();
        }
        onClose();
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b flex justify-between items-center bg-white">
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

                {/* Camera View */}
                <div className="relative bg-gray-900 overflow-hidden" style={{ height: '50vh', maxHeight: '400px' }}>
                    {!isReady && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 z-10">
                            <RotateCw className="animate-spin text-ifrn-green" size={32} />
                            <span className="text-sm font-medium">Iniciando câmera...</span>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-red-50 text-red-600 gap-3 z-10">
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

                    <div id="reader" className="w-full h-full" style={{ minHeight: '300px' }}></div>

                    {/* Scan guide overlay - visual only, does NOT restrict scan area */}
                    {isReady && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            {/* Horizontal guide line */}
                            <div className="w-[85%] relative">
                                <div className="h-[100px] border-2 border-ifrn-green/70 rounded-lg relative">
                                    <div className="absolute top-1/2 left-2 right-2 h-0.5 bg-red-500/60 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-scan-line"></div>

                                    <div className="absolute -top-1 -left-1 w-5 h-5 border-t-[3px] border-l-[3px] border-ifrn-green"></div>
                                    <div className="absolute -top-1 -right-1 w-5 h-5 border-t-[3px] border-r-[3px] border-ifrn-green"></div>
                                    <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-[3px] border-l-[3px] border-ifrn-green"></div>
                                    <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-[3px] border-r-[3px] border-ifrn-green"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Instruction */}
                <div className="p-5 bg-gray-50 text-center space-y-2">
                    <p className="text-xs text-gray-600 leading-relaxed font-semibold">
                        📌 Posicione o código de barras na área central da câmera.
                    </p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                        Dica: Mantenha o celular parado e a uma distância de 10-15cm do código.
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes scan-line {
                    0% { top: 10% }
                    50% { top: 85% }
                    100% { top: 10% }
                }
                .animate-scan-line {
                    animation: scan-line 2.5s ease-in-out infinite;
                }
                #reader video {
                    object-fit: cover !important;
                    width: 100% !important;
                    height: 100% !important;
                }
                #reader {
                    border: none !important;
                }
                #reader img[alt="Info icon"] {
                    display: none !important;
                }
                #qr-shaded-region {
                    display: none !important;
                }
            `}</style>
        </div>
    );
};
