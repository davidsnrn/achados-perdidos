import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, RotateCw, Lightbulb, Zap, CheckCircle2, AlertTriangle, ScanLine, Image as ImageIcon } from 'lucide-react';

interface Props {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose }) => {
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [torch, setTorch] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [scanBuffer, setScanBuffer] = useState<{ code: string; count: number }>({ code: '', count: 0 });

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    const stopScanner = useCallback(async () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            try {
                await scannerRef.current.stop();
            } catch (e) {
                console.error("Error stopping scanner:", e);
            }
        }
    }, []);

    useEffect(() => {
        const scanner = new Html5Qrcode("reader", {
            verbose: false,
            formatsToSupport: [Html5QrcodeSupportedFormats.CODE_128]
        });
        scannerRef.current = scanner;

        let lastResult = '';
        let consecutiveCount = 0;

        const startScanner = async () => {
            try {
                const config = {
                    fps: 25,
                    // No qrbox = full frame scan (essential for long 1D)
                    aspectRatio: 1.777778, // 16:9
                    videoConstraints: {
                        facingMode: "environment",
                        width: { min: 1280, ideal: 1920 },
                        height: { min: 720, ideal: 1080 }
                    }
                };

                await scanner.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        console.log("[Scanner] Lido:", decodedText);

                        // Strict consensus check
                        if (decodedText === lastResult) {
                            consecutiveCount++;
                            if (consecutiveCount >= 3) {
                                setScanBuffer({ code: decodedText, count: 3 });
                                stopScanner();
                                setTimeout(() => onScanRef.current(decodedText), 500);
                            } else {
                                setScanBuffer({ code: decodedText, count: consecutiveCount });
                            }
                        } else {
                            lastResult = decodedText;
                            consecutiveCount = 1;
                            setScanBuffer({ code: decodedText, count: 1 });
                        }
                    },
                    () => { } // silent scan failure per frame
                );
                setIsReady(true);
            } catch (err: any) {
                setError("Falha ao iniciar câmera. Verifique as permissões.");
                console.error(err);
            }
        };

        const timer = setTimeout(startScanner, 300);

        return () => {
            clearTimeout(timer);
            if (scanner.isScanning) {
                scanner.stop().catch(() => { });
            }
        };
    }, [stopScanner]);

    // OBLIGATORY: "Sophisticated" Image Analysis (like AvePDF)
    // Takes a high-res frame and analyzes it with maximum precision
    const handleDeepScan = async () => {
        if (!scannerRef.current || isAnalyzing) return;

        setIsAnalyzing(true);
        try {
            // Give 1 second to the user to hold still
            await new Promise(r => setTimeout(r, 500));

            // Get the video element
            const video = document.querySelector('#reader video') as HTMLVideoElement;
            if (!video) throw new Error("Câmera não encontrada");

            // Create a high-res canvas for the snapshot
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(video, 0, 0);

            // Convert to file/blob for high-precision file scan
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const file = new File([blob], "scan.jpg", { type: "image/jpeg" });

                try {
                    // This uses the image decoder which is MUCH more precise than the live stream
                    const decodedText = await scannerRef.current!.scanFile(file, true);
                    setScanBuffer({ code: decodedText, count: 3 });
                    await stopScanner();
                    onScanRef.current(decodedText);
                } catch (e) {
                    setError("Não foi possível identificar o código nesta posição. Tente aproximar um pouco mais.");
                    setTimeout(() => setError(null), 3000);
                } finally {
                    setIsAnalyzing(false);
                }
            }, 'image/jpeg', 1.0);

        } catch (e) {
            console.error(e);
            setIsAnalyzing(false);
        }
    };

    const toggleTorch = async () => {
        if (!scannerRef.current) return;
        try {
            await (scannerRef.current as any).applyVideoConstraints({
                advanced: [{ torch: !torch } as any]
            });
            setTorch(!torch);
        } catch (e) {
            console.warn("Torch failed");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-white z-20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 rounded-2xl text-red-600">
                            <Zap size={24} className={isReady ? "animate-pulse" : ""} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 text-lg tracking-tight">Leitor Híbrido PNLD</h3>
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest leading-none mt-1">Alta Resolução + Snapshot AI</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTorch}
                            className={`p-3 rounded-full transition-all ${torch ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400'}`}
                        >
                            <Lightbulb size={24} fill={torch ? "currentColor" : "none"} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-400 rounded-full transition-all"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Viewport */}
                <div className="relative bg-black overflow-hidden" style={{ height: '50vh', maxHeight: '450px' }}>
                    {!isReady && !error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-4 z-20 bg-black/40">
                            <RotateCw className="animate-spin text-red-600" size={32} />
                            <span className="text-xs font-bold tracking-widest uppercase opacity-70">Sincronizando Sensores...</span>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white z-30 gap-6">
                            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center">
                                <AlertTriangle size={32} />
                            </div>
                            <p className="font-bold text-gray-800 text-sm leading-relaxed">{error}</p>
                            <button onClick={onClose} className="px-6 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold">Fechar</button>
                        </div>
                    )}

                    <div id="reader" className="w-full h-full [&>video]:object-cover [&>canvas]:hidden"></div>

                    {/* HUD Overlay */}
                    {isReady && !isAnalyzing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="w-[85%] h-[120px] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                {scanBuffer.count >= 1 && (
                                    <div className="absolute -top-12 left-0 right-0 flex justify-center">
                                        <div className="bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                            {scanBuffer.count < 3 ? `Capturando ${scanBuffer.count}/3` : 'Confirmado!'}
                                        </div>
                                    </div>
                                )}
                                <div className="absolute top-1/2 left-2 right-2 h-[2px] bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-scanner-beam"></div>
                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-red-600 rounded-tl-3xl"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-red-600 rounded-tr-3xl"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-red-600 rounded-bl-3xl"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-red-600 rounded-br-3xl"></div>
                            </div>
                        </div>
                    )}

                    {isAnalyzing && (
                        <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white gap-4">
                            <div className="relative">
                                <ScanLine className="text-red-500 animate-bounce" size={48} />
                                <ImageIcon className="absolute -top-2 -right-2 text-white/50" size={16} />
                            </div>
                            <p className="text-xs font-black uppercase tracking-widest animate-pulse text-center">
                                Análise de Alta Previsão Ativa...<br />
                                <span className="text-[10px] text-white/50">Simulando Método AvePDF</span>
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-8 bg-gray-50 flex flex-col items-center gap-6">
                    <button
                        onClick={handleDeepScan}
                        disabled={!isReady || isAnalyzing}
                        className={`w-full max-w-[280px] py-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 ${isAnalyzing ? 'bg-gray-300' : 'bg-red-600 hover:bg-black text-white'
                            }`}
                    >
                        <Zap size={20} className={isAnalyzing ? "" : "animate-pulse"} />
                        <span className="font-black uppercase tracking-widest text-xs">Capturar e Analisar</span>
                    </button>

                    <div className="text-center space-y-2">
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                            {isAnalyzing ? "Processando imagem em resolução máxima..." : "Dica: Mantenha o código estático e clique no botão acima para análise profunda"}
                        </p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scanner-beam {
                    0% { transform: translateY(-50px); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(50px); opacity: 0; }
                }
                .animate-scanner-beam {
                    animation: scanner-beam 1.4s ease-in-out infinite;
                }
                #reader video {
                    image-rendering: -webkit-optimize-contrast;
                    image-rendering: crisp-edges;
                }
            `}</style>
        </div>
    );
};
