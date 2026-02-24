import React, { useEffect, useRef, useState, useCallback } from 'react';
import Quagga from '@ericblade/quagga2';
import { X, Camera, RotateCw, Lightbulb, Zap, CheckCircle2 } from 'lucide-react';

interface Props {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose }) => {
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [torch, setTorch] = useState(false);
    const [scanBuffer, setScanBuffer] = useState<{ code: string; count: number }>({ code: '', count: 0 });
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

        let lastResult = '';
        let consecutiveCount = 0;

        const initScanner = async () => {
            try {
                await Quagga.init({
                    inputStream: {
                        name: "Live",
                        type: "LiveStream",
                        target: scannerRef.current,
                        constraints: {
                            width: { min: 1280 },
                            height: { min: 720 },
                            facingMode: "environment",
                            focusMode: "continuous"
                        },
                    },
                    locator: {
                        patchSize: "medium",
                        halfSample: false
                    },
                    numOfWorkers: navigator.hardwareConcurrency || 4,
                    decoder: {
                        readers: [
                            // Code 128 is the primary target for PNLD
                            {
                                format: "code_128_reader",
                                config: {
                                    // Optimization for alphanumeric
                                }
                            },
                            "code_39_reader",
                            "ean_reader",
                            "ean_8_reader"
                        ]
                    },
                    locate: true,
                    frequency: 15
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
                        const code = data.codeResult.code;

                        // CONSENSUS LOGIC:
                        // Web scanners often produce "ghost" reads (incorrect numbers).
                        // To solve this, we wait until we see the EXACT same code 3 times in a row.
                        if (code === lastResult) {
                            consecutiveCount++;
                            if (consecutiveCount >= 3) {
                                // Provide visual feedback before closing
                                setScanBuffer({ code, count: consecutiveCount });
                                setTimeout(() => {
                                    onScanRef.current(code);
                                }, 500);
                                consecutiveCount = 0; // reset
                            } else {
                                setScanBuffer({ code, count: consecutiveCount });
                            }
                        } else {
                            lastResult = code;
                            consecutiveCount = 1;
                            setScanBuffer({ code, count: 1 });
                        }
                    }
                });

            } catch (err) {
                setError("Não foi possível acessar a câmera.");
                console.error(err);
            }
        };

        const timer = setTimeout(initScanner, 300);

        return () => {
            clearTimeout(timer);
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
                    console.warn("Torch failed:", e);
                }
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-white z-20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-ifrn-green/10 rounded-2xl text-ifrn-green">
                            <Zap size={24} className={isReady ? "animate-pulse" : ""} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 text-lg tracking-tight">Scanner Ultra-Sensível</h3>
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Otimizado para PNLD Alfanumérico</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTorch}
                            className={`p-3 rounded-full transition-all ${torch ? 'bg-amber-100 text-amber-600 shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                        >
                            <Lightbulb size={24} fill={torch ? "currentColor" : "none"} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-3 bg-gray-100 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-full transition-all"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Viewport */}
                <div className="relative bg-black overflow-hidden" style={{ height: '55vh', maxHeight: '450px' }}>
                    {!isReady && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 z-20 bg-black/40">
                            <RotateCw className="animate-spin text-ifrn-green" size={32} />
                        </div>
                    )}

                    <div
                        ref={scannerRef}
                        id="reader"
                        className="w-full h-full [&>video]:object-cover [&>canvas]:hidden [&>video]:absolute [&>video]:inset-0 [&>video]:w-full [&>video]:h-full"
                    ></div>

                    {/* HUD Overlay */}
                    {isReady && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="w-[85%] h-[140px] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                {/* Success visualization */}
                                {scanBuffer.count >= 1 && (
                                    <div className="absolute -top-12 left-0 right-0 flex justify-center">
                                        <div className="bg-ifrn-green text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-bounce">
                                            {scanBuffer.count < 3 ? (
                                                <>Capturando... ({scanBuffer.count}/3)</>
                                            ) : (
                                                <><CheckCircle2 size={14} /> Código Identificado!</>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="absolute top-1/2 left-2 right-2 h-[2px] bg-sky-400 shadow-[0_0_15px_#38bdf8] animate-scanner-beam"></div>

                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-ifrn-green rounded-tl-3xl"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-ifrn-green rounded-tr-3xl"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-ifrn-green rounded-bl-3xl"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-ifrn-green rounded-br-3xl"></div>

                                {scanBuffer.code && (
                                    <div className="absolute -bottom-8 left-0 right-0 text-center">
                                        <span className="text-[11px] font-mono font-bold text-white bg-black/40 px-3 py-1 rounded-lg backdrop-blur-sm">
                                            {scanBuffer.code}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50 flex flex-col gap-3">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-2xl flex-shrink-0 flex items-center justify-center text-ifrn-green">
                            <Camera size={20} />
                        </div>
                        <div className="space-y-1">
                            <p className="text-[11px] font-black text-gray-900 uppercase tracking-tight">Consenso de Verificação Ativo</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                                Este scanner exige que o código seja lido <span className="text-black font-bold">3 vezes seguidas de forma idêntica</span>. Isso evita erros e garante que letras e números sejam capturados corretamente.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scanner-beam {
                    0% { transform: translateY(-70px); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(70px); opacity: 0; }
                }
                .animate-scanner-beam {
                    animation: scanner-beam 1.8s ease-in-out infinite;
                }
                #reader video {
                    image-rendering: -webkit-optimize-contrast;
                }
            `}</style>
        </div>
    );
};
