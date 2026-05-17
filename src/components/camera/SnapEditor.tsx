import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type, Pencil, Smile, RotateCcw, RotateCw,
  X, Check, Minus, Plus, Trash2, Palette,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────
type Tool = 'none' | 'text' | 'draw' | 'stickers';

interface TextLayer {
  id: string;
  text: string;
  x: number; // percent
  y: number; // percent
  color: string;
  font: string;
  size: number;
}

interface DrawPoint { x: number; y: number }
interface DrawStroke { points: DrawPoint[]; color: string; width: number }

interface StickerLayer {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
}

export interface EditorState {
  textLayers: TextLayer[];
  strokes: DrawStroke[];
  stickerLayers: StickerLayer[];
  rotation: number;       // degrees: 0, 90, 180, 270
  videoSpeed: number;     // 0.5, 1, 2
}

interface SnapEditorProps {
  mediaType: 'image' | 'video';
  onStateChange: (s: EditorState) => void;
}

// ── Constants ──────────────────────────────────────────────────────────
const COLORS = ['#FFFFFF', '#000000', '#FFFC00', '#FF4B4B', '#4BFF91', '#4BBAFF', '#FF4BF1', '#FF8A00'];
const FONTS = [
  { label: 'Bold', value: 'font-black' },
  { label: 'Serif', value: 'font-serif' },
  { label: 'Mono', value: 'font-mono' },
  { label: 'Thin', value: 'font-light' },
];
const STICKERS = [
  '😂','😍','🔥','💯','✨','😎','💀','🥹','🫶','💅',
  '🤩','😱','🎉','❤️','🫠','💫','🤑','🥶','😤','🫡',
  '🌈','🚀','💎','🎯','🎭','🦋','🐍','🌙','⚡','🌊',
];
const SPEEDS = [
  { label: '×0.5', value: 0.5 },
  { label: '×1', value: 1 },
  { label: '×2', value: 2 },
];

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Component ──────────────────────────────────────────────────────────
export default function SnapEditor({ mediaType, onStateChange }: SnapEditorProps) {
  const [activeTool, setActiveTool] = useState<Tool>('none');

  // Text state
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [editingText, setEditingText] = useState<TextLayer | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textFont, setTextFont] = useState('font-black');
  const [textSize, setTextSize] = useState(24);

  // Draw state
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<DrawStroke[]>([]);
  const [drawColor, setDrawColor] = useState('#FFFC00');
  const [drawWidth, setDrawWidth] = useState(5);
  const currentStrokeRef = useRef<DrawPoint[]>([]);
  const isDrawingRef = useRef(false);

  // Sticker state
  const [stickerLayers, setStickerLayers] = useState<StickerLayer[]>([]);

  // Transform
  const [rotation, setRotation] = useState(0);
  const [videoSpeed, setVideoSpeed] = useState(1);

  // Emit changes to parent
  useEffect(() => {
    onStateChange({ textLayers, strokes, stickerLayers, rotation, videoSpeed });
  }, [textLayers, strokes, stickerLayers, rotation, videoSpeed]);

  // ── Drawing canvas ───────────────────────────────────────────────────
  const redrawCanvas = () => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  };

  useEffect(() => { redrawCanvas(); }, [strokes]);

  const getCanvasPoint = (e: React.TouchEvent | React.MouseEvent): DrawPoint | null => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: ((e as React.MouseEvent).clientX - rect.left) * scaleX, y: ((e as React.MouseEvent).clientY - rect.top) * scaleY };
  };

  const onDrawStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (activeTool !== 'draw') return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    if (!pt) return;
    isDrawingRef.current = true;
    currentStrokeRef.current = [pt];
  };

  const onDrawMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current || activeTool !== 'draw') return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    if (!pt) return;
    currentStrokeRef.current.push(pt);
    // Live draw on canvas
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || currentStrokeRef.current.length < 2) return;
    const pts = currentStrokeRef.current;
    ctx.beginPath();
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  };

  const onDrawEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;
    if (currentStrokeRef.current.length < 2) return;
    setStrokes((prev) => [...prev, { points: [...currentStrokeRef.current], color: drawColor, width: drawWidth }]);
    currentStrokeRef.current = [];
  };

  const undoLastStroke = () => setStrokes((prev) => prev.slice(0, -1));

  // ── Text helpers ──────────────────────────────────────────────────────
  const openNewText = () => {
    setTextDraft('');
    const layer: TextLayer = { id: uid(), text: '', x: 50, y: 50, color: textColor, font: textFont, size: textSize };
    setEditingText(layer);
  };

  const confirmText = () => {
    if (!editingText) return;
    const layer: TextLayer = { ...editingText, text: textDraft, color: textColor, font: textFont, size: textSize };
    if (layer.text.trim()) {
      setTextLayers((prev) => {
        const exists = prev.find((l) => l.id === layer.id);
        return exists ? prev.map((l) => l.id === layer.id ? layer : l) : [...prev, layer];
      });
    }
    setEditingText(null);
    setTextDraft('');
  };

  const removeTextLayer = (id: string) => setTextLayers((prev) => prev.filter((l) => l.id !== id));

  // ── Sticker helpers ───────────────────────────────────────────────────
  const addSticker = (emoji: string) => {
    setStickerLayers((prev) => [
      ...prev,
      { id: uid(), emoji, x: 40 + Math.random() * 20, y: 30 + Math.random() * 40, size: 48 },
    ]);
    setActiveTool('none');
  };

  const removeSticker = (id: string) => setStickerLayers((prev) => prev.filter((s) => s.id !== id));

  const rotateCW = () => setRotation((r) => (r + 90) % 360);
  const rotateCCW = () => setRotation((r) => (r - 90 + 360) % 360);

  const toolBtn = (tool: Tool, icon: React.ReactNode, label: string) => (
    <button
      key={tool}
      onClick={() => setActiveTool(activeTool === tool ? 'none' : tool)}
      className={`flex flex-col items-center gap-1 transition-all ${activeTool === tool ? 'opacity-100' : 'opacity-70'}`}
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
        activeTool === tool ? 'bg-snap-yellow text-black' : 'bg-white/15 text-white'
      }`}>
        {icon}
      </div>
      <span className="text-white text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* ── Draw canvas (always present, events only when draw active) ── */}
      <canvas
        ref={drawCanvasRef}
        width={720}
        height={1280}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: activeTool === 'draw' ? 'auto' : 'none' }}
        onMouseDown={onDrawStart}
        onMouseMove={onDrawMove}
        onMouseUp={onDrawEnd}
        onTouchStart={onDrawStart}
        onTouchMove={onDrawMove}
        onTouchEnd={onDrawEnd}
      />

      {/* ── Sticker overlays ─────────────────────────────────────────── */}
      {stickerLayers.map((s) => (
        <div
          key={s.id}
          className="absolute pointer-events-auto"
          style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%)', fontSize: s.size }}
        >
          <span>{s.emoji}</span>
          <button
            onClick={() => removeSticker(s.id)}
            className="absolute -top-2 -right-3 w-5 h-5 rounded-full bg-black/80 flex items-center justify-center text-white"
          >
            <X size={10} />
          </button>
        </div>
      ))}

      {/* ── Text overlays ────────────────────────────────────────────── */}
      {textLayers.map((l) => (
        <div
          key={l.id}
          className="absolute pointer-events-auto"
          style={{ left: `${l.x}%`, top: `${l.y}%`, transform: 'translate(-50%,-50%)' }}
          onDoubleClick={() => { setEditingText(l); setTextDraft(l.text); setTextColor(l.color); setTextFont(l.font); setTextSize(l.size); }}
        >
          <span
            className={`text-center block drop-shadow-lg leading-tight ${l.font}`}
            style={{ color: l.color, fontSize: l.size, textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {l.text}
          </span>
          <button
            onClick={() => removeTextLayer(l.id)}
            className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/80 flex items-center justify-center text-white"
          >
            <X size={10} />
          </button>
        </div>
      ))}

      {/* ── Text input modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {editingText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50 pointer-events-auto p-6 gap-4"
          >
            {/* Font preview */}
            <div
              className={`text-center text-3xl ${textFont} drop-shadow-xl leading-tight`}
              style={{ color: textColor, minHeight: 48, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}
            >
              {textDraft || 'Tape ton texte...'}
            </div>

            {/* Font selector */}
            <div className="flex gap-2">
              {FONTS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTextFont(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${f.value} ${
                    textFont === f.value ? 'bg-snap-yellow text-black' : 'bg-white/10 text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Size */}
            <div className="flex items-center gap-3">
              <button onClick={() => setTextSize((s) => Math.max(14, s - 4))} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center"><Minus size={14} /></button>
              <span className="text-white/60 text-xs font-bold w-10 text-center">{textSize}px</span>
              <button onClick={() => setTextSize((s) => Math.min(72, s + 4))} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center"><Plus size={14} /></button>
            </div>

            {/* Color row */}
            <div className="flex gap-2 flex-wrap justify-center">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setTextColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${textColor === c ? 'scale-125 border-white' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>

            {/* Text input */}
            <input
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmText(); if (e.key === 'Escape') { setEditingText(null); setTextDraft(''); } }}
              placeholder="Ton texte ici..."
              maxLength={120}
              className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white text-center placeholder-white/30 focus:outline-none focus:border-snap-yellow/60 text-base"
            />

            <div className="flex gap-3 w-full">
              <button onClick={() => { setEditingText(null); setTextDraft(''); }} className="flex-1 py-3 bg-white/10 text-white rounded-xl font-bold text-sm">Annuler</button>
              <button onClick={confirmText} className="flex-1 py-3 bg-snap-yellow text-black rounded-xl font-bold text-sm flex items-center justify-center gap-2"><Check size={16} /> OK</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tool bar (right side) ─────────────────────────────────────── */}
      <div className="absolute top-16 right-3 flex flex-col gap-3 pointer-events-auto">
        {toolBtn('text', <Type size={18} />, 'Texte')}
        {toolBtn('draw', <Pencil size={18} />, 'Dessin')}
        {toolBtn('stickers', <Smile size={18} />, 'Stickers')}

        {/* Rotate */}
        <div className="flex flex-col items-center gap-1">
          <div className="flex gap-1">
            <button onClick={rotateCCW} className="w-5 h-11 rounded-l-full bg-white/15 text-white flex items-center justify-center"><RotateCcw size={12} /></button>
            <button onClick={rotateCW} className="w-5 h-11 rounded-r-full bg-white/15 text-white flex items-center justify-center"><RotateCw size={12} /></button>
          </div>
          <span className="text-white text-[9px] font-bold uppercase tracking-wider">Rotation</span>
        </div>
      </div>

      {/* ── Draw sub-toolbar ─────────────────────────────────────────── */}
      <AnimatePresence>
        {activeTool === 'draw' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-[200px] inset-x-4 pointer-events-auto"
          >
            <div className="bg-black/70 backdrop-blur-lg rounded-2xl p-4 flex flex-col gap-3 border border-white/10">
              {/* Colors */}
              <div className="flex gap-2 flex-wrap justify-center">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDrawColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${drawColor === c ? 'scale-125 border-white' : 'border-transparent'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              {/* Brush size */}
              <div className="flex items-center gap-3">
                <Palette size={14} className="text-white/50" />
                <input
                  type="range" min={2} max={30} value={drawWidth}
                  onChange={(e) => setDrawWidth(Number(e.target.value))}
                  className="flex-1 accent-snap-yellow"
                />
                <span className="text-white/60 text-xs w-6">{drawWidth}</span>
                <button onClick={undoLastStroke} className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center ml-1">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sticker picker ────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeTool === 'stickers' && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="absolute bottom-[200px] inset-x-4 pointer-events-auto"
          >
            <div className="bg-black/70 backdrop-blur-lg rounded-2xl p-4 border border-white/10">
              <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-3">Choisir un sticker</p>
              <div className="grid grid-cols-6 gap-3">
                {STICKERS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => addSticker(emoji)}
                    className="text-3xl text-center hover:scale-125 transition-transform active:scale-110"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Video speed bar (only for videos) ────────────────────────── */}
      {mediaType === 'video' && (
        <div className="absolute top-16 left-3 pointer-events-auto flex flex-col items-center gap-1">
          <div className="flex flex-col gap-1 bg-black/50 rounded-2xl p-1.5 border border-white/10">
            {SPEEDS.map((s) => (
              <button
                key={s.value}
                onClick={() => setVideoSpeed(s.value)}
                className={`w-10 h-8 rounded-xl text-[11px] font-black transition-all ${
                  videoSpeed === s.value ? 'bg-snap-yellow text-black' : 'text-white/60 hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-white/50 text-[9px] font-bold uppercase tracking-wider">Vitesse</span>
        </div>
      )}

      {/* ── Text add button (shown when text tool is active) ─────────── */}
      <AnimatePresence>
        {activeTool === 'text' && !editingText && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={openNewText}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto bg-black/60 border-2 border-dashed border-white/40 rounded-2xl px-8 py-4 flex flex-col items-center gap-2"
          >
            <Type size={24} className="text-white" />
            <span className="text-white/80 text-sm font-bold">Appuie pour ajouter du texte</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
