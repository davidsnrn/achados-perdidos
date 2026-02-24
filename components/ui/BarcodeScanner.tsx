import React, { useEffect, useRef, useState, useCallback } from 'react';
import Quagga from '@ericblade/quagga2';
import { X, Camera, RotateCw, Lightbulb, Zap } from 'lucide-react';

interface Props {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose }) => {
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [torch, setTorch] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    const stopScanner = useCallback(async () => {
        try {
            await Quagga.stop();
        } catch (e) {
            console.error("Error stopping Quagga:", e);
        }
    }, []);

    useEffect(() => {
        if (!scannerRef.current) return;

        const initScanner = async () => {
            try {
                // Determine resolution - PNLD codes need more detail
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                await Quagga.init({
                    inputStream: {
                        name: "Live",
                        type: "LiveStream",
                        target: scannerRef.current,
                        constraints: {
                            width: { min: 1280 },
                            height: { min: 720 },
                            facingMode: "environment",
                            aspectRatio: { min: 1, max: 2 }
                        },
                    },
                    locator: {
                        patchSize: "medium",
                        halfSample: false // Don't downsample - we need the high density!
                    },
                    numOfWorkers: navigator.hardwareConcurrency || 4,
                    decoder: {
                        readers: [
                            "code_128_reader",
                            "ean_reader",
                            "ean_8_reader",
                            "code_39_reader",
                            "upc_reader",
                            "upc_e_reader"
                        ],
                        multiple: false
                    },
                    locate: true,
                    frequency: 20 // Higher frequency for faster scanning
                }, (err) => {
                    if (err) {
                        setError("Erro ao iniciar o leitor: " + err.message);
                        return;
                    }
                    Quagga.start();
                    setIsReady(true);
                });

                Quagga.onDetected((data) => {
                    if (data.codeResult && data.codeResult.code) {
                        // Sophisticated validation: PNLD codes usually have a certain pattern
                        // but we'll accept any valid Code 128 for now.
                        onScanRef.current(data.codeResult.code);
                    }
                });

            } catch (err) {
                setError("Não foi possível acessar a câmera. Verifique as permissões.");
                console.error(err);
            }
        };

        const timer = setTimeout(initScanner, 300);

        return () => {
            clearTimeout(timer);
            // Quagga.stop is called via the useCallback or directly
            Quagga.offDetected();
            Quagga.stop().catch(() => { });
        };
    }, []);

    const toggleTorch = async () => {
        const track = Quagga.CameraAccess.getActiveTrack();
        if (track && typeof track.getCapabilities === 'function') {
            const capabilities = track.getCapabilities();
            if (capabilities.torch) {
                try {
                    await track.applyConstraints({
                        advanced: [{ torch: !torch } as any]
                    });
                    setTorch(!torch);
                } catch (e) {
                    console.warn("Torch toggle failed:", e);
                }
            }
        }
    };

    const handleClose = async () => {
        await stopScanner();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-500">
            <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
                {/* Modern Header */}
                <div className="p-6 border-b flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-ifrn-green/10 rounded-2xl text-ifrn-green shadow-inner">
                            <Zap size={24} className="animate-pulse" />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 text-lg tracking-tight">Leitor Ultra-Sensível</h3>
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-[0.2em]">Tecnologia Scanner 1D Ativa</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTorch}
                            className={`p-3 rounded-full transition-all ${torch ? 'bg-amber-100 text-amber-600 shadow-lg' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                            title="Ligar Lanterna"
                        >
                            <Lightbulb size={24} fill={torch ? "currentColor" : "none"} />
                        </button>
                        <button
                            onClick={handleClose}
                            className="p-3 bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-full transition-all group"
                        >
                            <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>
                </div>

                {/* Main Scanning Viewport */}
                <div className="relative bg-black overflow-hidden group" style={{ height: '60vh', maxHeight: '500px' }}>
                    {!isReady && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 z-10 bg-black/40">
                            <div className="relative">
                                <div className="w-16 h-16 border-4 border-ifrn-green/20 rounded-full"></div>
                                <div className="w-16 h-16 border-4 border-ifrn-green rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                            </div>
                            <span className="text-sm font-bold tracking-widest uppercase opacity-80">Calibrando Sensores...</span>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white z-10 gap-6">
                            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center">
                                <X size={40} strokeWidth={3} />
                            </div>
                            <div className="space-y-2">
                                <p className="font-black text-gray-900 text-xl">Ops! Algo deu errado.</p>
                                <p className="text-gray-500 text-sm font-medium px-4">{error}</p>
                            </div>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95"
                            >
                                Recarregar Página
                            </button>
                        </div>
                    )}

                    <div
                        ref={scannerRef}
                        id="reader"
                        className="w-full h-full [&>video]:object-cover [&>canvas]:hidden [&>video]:absolute [&>video]:inset-0 [&>video]:w-full [&>video]:h-full"
                    ></div>

                    {/* HUD / Scanning UI Overlay */}
                    {isReady && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            {/* Smart Viewfinder */}
                            <div className="w-[90%] h-[180px] border-2 border-white/30 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                {/* Success Pulse Area */}
                                <div className="absolute inset-0 bg-ifrn-green/10 opacity-0 group-active:opacity-100 transition-opacity rounded-3xl"></div>

                                {/* Dynamic Scanning Hub */}
                                <div className="absolute top-1/2 left-2 right-2 h-[2px] bg-sky-400 shadow-[0_0_15px_#38bdf8] animate-scanner-beam"></div>
                                <div className="absolute top-1/2 left-2 right-2 h-1 bg-white/20 blur-sm"></div>

                                {/* Modern Corner Accents */}
                                <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-ifrn-green rounded-tl-3xl"></div>
                                <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-ifrn-green rounded-tr-3xl"></div>
                                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-ifrn-green rounded-bl-3xl"></div>
                                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-ifrn-green rounded-br-3xl"></div>

                                {/* Scanning Text */}
                                <div className="absolute -bottom-10 left-0 right-0 text-center">
                                    <span className="text-[9px] font-black text-white/50 uppercase tracking-[0.3em] bg-black/20 px-4 py-1 rounded-full backdrop-blur-md">
                                        Analisando Padrões Code 128
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Pro-Tips */}
                <div className="p-8 bg-gray-50 flex items-start gap-4">
                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-ifrn-green">
                        <Camera size={20} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs font-black text-gray-900 uppercase tracking-tight">Otimizado para Livros IFRN/PNLD</p>
                        <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                            Mantenha o código <span className="text-black font-bold">horizontal e plano</span>. Se estiver escuro, use o botão de lanterna acima. O leitor agora usa resolução HD para processar detalhes minúsculos.
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scanner-beam {
                    0% { transform: translateY(-80px); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(80px); opacity: 0; }
                }
                .animate-scanner-beam {
                    animation: scanner-beam 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                #reader video {
                    image-rendering: -webkit-optimize-contrast;
                    image-rendering: crisp-edges;
                }
            `}</style>
        </div>
    );
};
