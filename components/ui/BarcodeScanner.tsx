import React, { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { X, Camera, RotateCw, Lightbulb, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Props {
    onScan: (decodedText: string) => void;
    onClose: () => void;
}

export const BarcodeScanner: React.FC<Props> = ({ onScan, onClose }) => {
    const [error, setError] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [torch, setTorch] = useState(false);
    const [scanBuffer, setScanBuffer] = useState<{ code: string; count: number }>({ code: '', count: 0 });
    const videoRef = useRef<HTMLVideoElement>(null);
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    useEffect(() => {
        const hints = new Map();
        // OBLIGATORY: Exclusively Code 128 for PNLD
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
        // OBLIGATORY: Maximum precision (matches sophisticated sites)
        hints.set(DecodeHintType.TRY_HARDER, true);

        const codeReader = new BrowserMultiFormatReader(hints);
        codeReaderRef.current = codeReader;

        let lastResult = '';
        let consecutiveCount = 0;

        const startScanner = async () => {
            try {
                // Request HD resolution
                const constraints = {
                    video: {
                        facingMode: "environment",
                        width: { min: 1280, ideal: 1920 },
                        height: { min: 720, ideal: 1080 }
                    }
                };

                await codeReader.decodeFromConstraints(
                    constraints,
                    videoRef.current!,
                    (result, err) => {
                        if (result) {
                            const code = result.getText();
                            console.log(`[ZXing] Lido: ${code} (Formato: ${result.getBarcodeFormat()})`);

                            // CONSENSUS LOGIC: Ensure stability
                            if (code === lastResult) {
                                consecutiveCount++;
                                if (consecutiveCount >= 2) { // ZXing is more stable, 2-3 is enough
                                    setScanBuffer({ code, count: 3 }); // Visual 3/3
                                    codeReader.reset();
                                    setTimeout(() => {
                                        onScanRef.current(code);
                                    }, 500);
                                } else {
                                    setScanBuffer({ code, count: consecutiveCount + 1 });
                                }
                            } else {
                                lastResult = code;
                                consecutiveCount = 0;
                                setScanBuffer({ code, count: 1 });
                            }
                        }

                        if (err && !(err.name === 'NotFoundException')) {
                            // Only log critical errors
                            console.debug("[ZXing] Erro na varredura:", err);
                        }
                    }
                );
                setIsReady(true);
            } catch (err: any) {
                setError("Não foi possível acessar a câmera: " + (err.message || err));
                console.error(err);
            }
        };

        const timer = setTimeout(startScanner, 300);

        return () => {
            clearTimeout(timer);
            codeReader.reset();
        };
    }, []);

    const toggleTorch = async () => {
        try {
            const stream = videoRef.current?.srcObject as MediaStream;
            const track = stream?.getVideoTracks()[0];
            if (track && 'applyConstraints' in track) {
                const capabilities = (track as any).getCapabilities?.() || {};
                if (capabilities.torch) {
                    await track.applyConstraints({
                        advanced: [{ torch: !torch } as any]
                    });
                    setTorch(!torch);
                }
            }
        } catch (e) {
            console.warn("Torch failing:", e);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-white z-20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-2xl text-purple-600">
                            <Zap size={24} className={isReady ? "animate-pulse" : ""} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-900 text-lg tracking-tight">Leitor Inteligente PNLD</h3>
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest text-purple-500">Tecnologia ZXing High-Resolution</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleTorch}
                            className={`p-3 rounded-full transition-all ${torch ? 'bg-amber-100 text-amber-600 shadow-lg' : 'bg-gray-100 text-gray-400'}`}
                            title="Ligar Lanterna"
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
                            <RotateCw className="animate-spin text-purple-500" size={32} />
                            <span className="text-sm font-bold tracking-widest uppercase opacity-70">Sincronizando ZXing Engine...</span>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white z-10 gap-6">
                            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center">
                                <AlertTriangle size={40} strokeWidth={3} />
                            </div>
                            <div className="space-y-2">
                                <p className="font-black text-gray-900 text-xl">Falha no Motor</p>
                                <p className="text-gray-500 text-sm font-medium px-4">{error}</p>
                            </div>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl"
                            >
                                Reiniciar Site
                            </button>
                        </div>
                    )}

                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        style={{ position: 'absolute', inset: 0 }}
                    ></video>

                    {/* HUD Overlay */}
                    {isReady && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="w-[85%] h-[120px] border-2 border-white/30 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                {scanBuffer.count >= 1 && (
                                    <div className="absolute -top-12 left-0 right-0 flex justify-center">
                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${scanBuffer.count < 3 ? 'bg-purple-500 text-white' : 'bg-ifrn-green text-white'}`}>
                                            {scanBuffer.count < 3 ? (
                                                <>Identificando Código... {scanBuffer.count}/3</>
                                            ) : (
                                                <><CheckCircle2 size={14} /> Leitura Confirmada!</>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="absolute top-1/2 left-2 right-2 h-[2px] bg-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-scanner-beam"></div>

                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-500 rounded-tl-3xl"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-500 rounded-tr-3xl"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-500 rounded-bl-3xl"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-500 rounded-br-3xl"></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50">
                    <div className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-50 text-purple-500 rounded-lg flex items-center justify-center">
                                <Zap size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Valor em Varredura</p>
                                <p className="text-sm font-mono font-bold text-gray-900 pr-2 inline-block">
                                    {scanBuffer.code || "Aguardando..."}
                                </p>
                            </div>
                        </div>
                        {scanBuffer.count > 0 && (
                            <div className="flex gap-1">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`w-3 h-3 rounded-full ${scanBuffer.count >= i ? 'bg-purple-500' : 'bg-gray-200'}`}></div>
                                ))}
                            </div>
                        )}
                    </div>
                    <p className="mt-4 text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest leading-relaxed">
                        Mantenha o livro imóvel por 1 segundo.<br />
                        <span className="text-gray-600">O motor ZXing processa a imagem em alta definição.</span>
                    </p>
                </div>
            </div>

            <style>{`
                @keyframes scanner-beam {
                    0% { transform: translateY(-50px); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(50px); opacity: 0; }
                }
                .animate-scanner-beam {
                    animation: scanner-beam 1.2s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
};
