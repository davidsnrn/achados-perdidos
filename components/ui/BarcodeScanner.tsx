import React, { useEffect, useRef, useState, useCallback } from 'react';
import Quagga from '@ericblade/quagga2';
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
    const scannerRef = useRef<HTMLDivElement>(null);
    const onScanRef = useRef(onScan);
    onScanRef.current = onScan;

    const stopScanner = useCallback(async () => {
        try {
            Quagga.offDetected();
            Quagga.offProcessed();
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
                            // OBLIGATORY: Force HD resolution or superior
                            width: { min: 1280, ideal: 1920 },
                            height: { min: 720, ideal: 1080 },
                            facingMode: "environment",
                            focusMode: "continuous"
                        },
                    },
                    locator: {
                        // OBLIGATORY: Maximum precision
                        patchSize: "large",
                        halfSample: false // No downscaling
                    },
                    numOfWorkers: Math.min(navigator.hardwareConcurrency || 4, 4),
                    decoder: {
                        // OBLIGATORY: Exclusively Code 128
                        readers: ["code_128_reader"],
                        multiple: false
                    },
                    locate: true,
                    frequency: 10 // Moderate frequency to allow processor to handle HQ frames
                }, (err) => {
                    if (err) {
                        setError("Erro ao iniciar o leitor: " + err.message);
                        return;
                    }
                    Quagga.start();
                    setIsReady(true);
                    console.log("[Scanner] Iniciado com decodificador EXCLUSIVO Code 128");
                });

                Quagga.onProcessed((result) => {
                    const drawingCtx = Quagga.canvas.ctx.overlay;
                    const drawingCanvas = Quagga.canvas.dom.overlay;

                    if (result) {
                        if (result.boxes) {
                            drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width") || "0"), parseInt(drawingCanvas.getAttribute("height") || "0"));
                            result.boxes.filter((box: any) => box !== result.box).forEach((box: any) => {
                                Quagga.ImageDebug.drawPath(box, { x: 0, y: 1 }, drawingCtx, { color: "green", lineWidth: 2 });
                            });
                        }

                        if (result.box) {
                            Quagga.ImageDebug.drawPath(result.box, { x: 0, y: 1 }, drawingCtx, { color: "#CB161D", lineWidth: 2 });
                        }

                        if (result.codeResult && result.codeResult.code) {
                            Quagga.ImageDebug.drawPath(result.line, { x: 'x', y: 'y' }, drawingCtx, { color: 'red', lineWidth: 3 });
                        }
                    }
                });

                Quagga.onDetected((data) => {
                    if (!data.codeResult || !data.codeResult.code) return;

                    const code = data.codeResult.code;
                    const format = data.codeResult.format;

                    // OBLIGATORY: Console Log debugging
                    console.log(`[Scanner] Formato detectado: ${format}`);
                    console.log(`[Scanner] Valor bruto lido: ${code}`);

                    // CONSENSUS LOGIC: 3 consecutive identical reads
                    if (code === lastResult) {
                        consecutiveCount++;
                        console.log(`[Scanner] Consenso: ${consecutiveCount}/3`);

                        if (consecutiveCount >= 3) {
                            console.log(`[Scanner] CÓDIGO VALIDADO: ${code}`);
                            setScanBuffer({ code, count: consecutiveCount });

                            // Prevent further detection while success UI shows
                            Quagga.offDetected();

                            setTimeout(() => {
                                onScanRef.current(code);
                            }, 600);
                        } else {
                            setScanBuffer({ code, count: consecutiveCount });
                        }
                    } else {
                        // Reset if it changes
                        lastResult = code;
                        consecutiveCount = 1;
                        setScanBuffer({ code, count: 1 });
                    }
                });

            } catch (err) {
                setError("Não foi possível acessar a câmera. Tente em outro navegador.");
                console.error(err);
            }
        };

        const timer = setTimeout(initScanner, 300);

        return () => {
            clearTimeout(timer);
            Quagga.offDetected();
            Quagga.offProcessed();
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
                            <h3 className="font-black text-gray-900 text-lg tracking-tight">Scanner PNLD Pro</h3>
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Code 128 Alfanumérico Estrito</p>
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
                            <RotateCw className="animate-spin text-ifrn-green" size={32} />
                            <span className="text-sm font-bold tracking-widest uppercase opacity-70">Ajustando Lentes HD...</span>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white z-10 gap-6">
                            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center">
                                <AlertTriangle size={40} strokeWidth={3} />
                            </div>
                            <div className="space-y-2">
                                <p className="font-black text-gray-900 text-xl">Falha de Calibração</p>
                                <p className="text-gray-500 text-sm font-medium px-4">{error}</p>
                            </div>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-8 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-black"
                            >
                                Reiniciar Scanner
                            </button>
                        </div>
                    )}

                    <div
                        ref={scannerRef}
                        id="reader"
                        className="w-full h-full [&>video]:object-cover [&>canvas]:absolute [&>canvas]:inset-0 [&>canvas]:w-full [&>canvas]:h-full [&>video]:absolute [&>video]:inset-0 [&>video]:w-full [&>video]:h-full"
                    ></div>

                    {/* HUD Overlay */}
                    {isReady && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                            <div className="w-[85%] h-[120px] border-2 border-white/20 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
                                {scanBuffer.count >= 1 && (
                                    <div className="absolute -top-12 left-0 right-0 flex justify-center">
                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-colors ${scanBuffer.count < 3 ? 'bg-amber-500 text-white' : 'bg-ifrn-green text-white'}`}>
                                            {scanBuffer.count < 3 ? (
                                                <>Validando Consenso: {scanBuffer.count}/3</>
                                            ) : (
                                                <><CheckCircle2 size={14} /> Código Identificado!</>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="absolute top-1/2 left-2 right-2 h-[2px] bg-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-scanner-beam"></div>

                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-ifrn-green rounded-tl-3xl"></div>
                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-ifrn-green rounded-tr-3xl"></div>
                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-ifrn-green rounded-bl-3xl"></div>
                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-ifrn-green rounded-br-3xl"></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-50">
                    <div className="p-4 bg-white border border-gray-100 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-lg flex items-center justify-center">
                                <Zap size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Leitura Atual</p>
                                <p className="text-sm font-mono font-bold text-gray-900 border-r-2 border-ifrn-green pr-2 inline-block">
                                    {scanBuffer.code || "Aguardando..."}
                                </p>
                            </div>
                        </div>
                        {scanBuffer.count > 0 && (
                            <div className="flex gap-1">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`w-3 h-3 rounded-full ${scanBuffer.count >= i ? 'bg-ifrn-green' : 'bg-gray-200'}`}></div>
                                ))}
                            </div>
                        )}
                    </div>
                    <p className="mt-4 text-[10px] text-gray-500 text-center font-bold uppercase tracking-wider">
                        Aponte diretamente para o código PNLD. O leitor exige nitidez total.
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
                    animation: scanner-beam 1.5s ease-in-out infinite;
                }
                #reader canvas.drawingBuffer {
                    display: block !important;
                }
            `}</style>
        </div>
    );
};
