import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize, Move, RotateCcw } from 'lucide-react';

interface Props {
    src: string;
    alt: string;
}

export const ImageViewer: React.FC<Props> = ({ src, alt }) => {
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const reset = useCallback(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 5));
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));

    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setScale(prev => Math.min(Math.max(prev + delta, 0.5), 5));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale <= 1) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (scale <= 1) return;
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            setIsDragging(true);
            setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDragging || e.touches.length !== 1) return;
        const touch = e.touches[0];
        setPosition({
            x: touch.clientX - dragStart.x,
            y: touch.clientY - dragStart.y
        });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    // Prevent scroll when dragging on mobile
    useEffect(() => {
        const handleTouchMoveGlobal = (e: TouchEvent) => {
            if (isDragging) {
                e.preventDefault();
            }
        };

        document.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
        return () => {
            document.removeEventListener('touchmove', handleTouchMoveGlobal);
        };
    }, [isDragging]);

    return (
        <div className="flex flex-col gap-4 w-full">
            <div
                ref={containerRef}
                className="relative bg-black rounded-xl overflow-hidden flex items-center justify-center min-h-[400px] h-[60vh] cursor-grab active:cursor-grabbing select-none"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <div
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.165, 0.84, 0.44, 1)'
                    }}
                    className="w-full h-full flex items-center justify-center pointer-events-none"
                >
                    <img
                        ref={imgRef}
                        src={src}
                        alt={alt}
                        className="max-w-full max-h-full object-contain shadow-2xl"
                        onDragStart={(e) => e.preventDefault()}
                    />
                </div>

                {/* Floating Controls */}
                <div className="absolute bottom-4 right-4 flex flex-col gap-2 scale-90 sm:scale-100">
                    <div className="flex flex-col bg-white/10 backdrop-blur-md rounded-lg overflow-hidden border border-white/20 shadow-2xl">
                        <button
                            onClick={handleZoomIn}
                            className="p-3 text-white hover:bg-white/10 transition-colors"
                            title="Aumentar Zoom"
                        >
                            <ZoomIn size={20} />
                        </button>
                        <div className="h-px bg-white/10" />
                        <button
                            onClick={handleZoomOut}
                            className="p-3 text-white hover:bg-white/10 transition-colors"
                            title="Diminuir Zoom"
                        >
                            <ZoomOut size={20} />
                        </button>
                    </div>

                    <button
                        onClick={reset}
                        className="p-3 bg-white/10 backdrop-blur-md rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors shadow-2xl flex items-center justify-center"
                        title="Resetar Visualização"
                    >
                        <RotateCcw size={20} />
                    </button>
                </div>

                {/* Scale Indicator */}
                <div className="absolute top-4 left-4 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-white text-xs font-bold uppercase tracking-widest opacity-80">
                        Zoom: {Math.round(scale * 100)}%
                    </span>
                </div>

                {/* Tooltip for Panning */}
                {scale > 1 && !isDragging && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-ifrn-green/90 backdrop-blur-md px-4 py-2 rounded-full border border-ifrn-green/20 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg flex items-center gap-2 animate-bounce">
                        <Move size={12} /> Arraste para explorar detalhes
                    </div>
                )}
            </div>

            <div className="text-center">
                <p className="text-gray-400 text-[10px] uppercase font-bold tracking-[0.2em]">
                    Dica: {window.innerWidth > 768 ? 'Use a roda do mouse segurando Ctrl para Zoom' : 'Toque e arraste para navegar'}
                </p>
            </div>
        </div>
    );
};
