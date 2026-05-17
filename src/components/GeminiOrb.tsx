import React, { useState, useRef, useEffect } from 'react';
import { pcmToBase64, playAudioChunk, resetAudioSync } from '../utils/audio';
import { useToast } from './ui/ToastProvider';
import { Mic, MicOff } from 'lucide-react';

export default function GeminiOrb() {
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const startVoice = async () => {
    try {
      setIsConnecting(true);
      resetAudioSync();
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Non authentifié — connecte-toi d\'abord.');
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const defaultWsUrl = `${wsProtocol}//${window.location.host}/live`;
      const wsUrl = import.meta.env.VITE_WS_URL || defaultWsUrl;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = async () => {
        ws.send(JSON.stringify({ auth: session.access_token }));
        setIsConnecting(false);
        setIsActive(true);
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } });
        streamRef.current = stream;
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = stream;
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const imageCapture = new (window as any).ImageCapture(videoTrack);
          let isSendingFrame = false;
          const sendVideoFrame = async () => {
            if (ws.readyState !== WebSocket.OPEN) return;
            if (isSendingFrame) { setTimeout(sendVideoFrame, 4000); return; }
            isSendingFrame = true;
            try {
              const bitmap = await imageCapture.grabFrame();
              const canvas = document.createElement('canvas');
              canvas.width = 320; canvas.height = 240;
              canvas.getContext('2d')?.drawImage(bitmap, 0, 0, 320, 240);
              ws.send(JSON.stringify({ video: canvas.toDataURL('image/jpeg', 0.6).split(',')[1] }));
            } catch { /* ignore */ } finally { isSendingFrame = false; }
            setTimeout(sendVideoFrame, 4000);
          };
          sendVideoFrame();
        }
        try {
          await audioCtx.audioWorklet.addModule('/pcm-capture-processor.js');
          const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor', { processorOptions: { bufferSize: 4096 } });
          workletNodeRef.current = workletNode;
          workletNode.port.onmessage = (e) => {
            if (ws.readyState === WebSocket.OPEN && e.data?.pcm) ws.send(JSON.stringify({ audio: pcmToBase64(e.data.pcm) }));
          };
          audioCtx.createMediaStreamSource(stream).connect(workletNode);
        } catch {
          const source = audioCtx.createMediaStreamSource(stream);
          const processor = audioCtx.createScriptProcessor(4096, 1, 1);
          source.connect(processor);
          processor.connect(audioCtx.destination);
          processor.onaudioprocess = (e) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ audio: pcmToBase64(e.inputBuffer.getChannelData(0)) }));
          };
        }
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.audio && audioCtxRef.current) playAudioChunk(audioCtxRef.current, msg.audio);
        if (msg.text) setTranscription((prev) => prev + msg.text);
        if (msg.interrupted) { resetAudioSync(); setTranscription(''); }
      };
      ws.onerror = () => stopVoice();
      ws.onclose = () => stopVoice();
    } catch (err: any) {
      setIsConnecting(false);
      setIsActive(false);
      toast(err.message || 'Impossible de démarrer Nova AI.', 'error');
    }
  };

  const stopVoice = () => {
    setIsActive(false);
    setIsConnecting(false);
    workletNodeRef.current?.port.postMessage({ type: 'stop' });
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    audioCtxRef.current?.close().catch(console.error);
    audioCtxRef.current = null;
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
  };

  useEffect(() => () => stopVoice(), []);

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {/* Orb */}
      <button
        onClick={isActive || isConnecting ? stopVoice : startVoice}
        className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 overflow-hidden ${
          isActive ? 'shadow-snap scale-105' : isConnecting ? 'animate-pulse bg-snap-yellow/20' : 'bg-white/5 border border-white/10 hover:bg-white/10'
        }`}
        style={isActive ? { background: 'radial-gradient(circle at 30% 30%, #FFFC00 0%, #ff9500 50%, #ff3b30 100%)' } : {}}
      >
        <video
          ref={videoPreviewRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] rounded-full transition-opacity duration-500 pointer-events-none ${isActive ? 'opacity-50' : 'opacity-0 hidden'}`}
        />
        <div className={`relative z-10 flex flex-col items-center gap-1 transition-all ${isActive ? 'scale-90' : ''}`}>
          {isConnecting ? (
            <span className="text-snap-yellow text-xs font-bold uppercase animate-pulse">Connexion...</span>
          ) : isActive ? (
            <MicOff size={28} className="text-black" />
          ) : (
            <>
              <Mic size={24} className="text-white/50" />
              <span className="text-white/30 text-[9px] font-bold uppercase tracking-wider">Parler</span>
            </>
          )}
        </div>
      </button>

      {/* Transcription */}
      <div className="text-center min-h-[48px] flex flex-col items-center justify-center max-w-xs px-4">
        {isActive ? (
          <p className="text-sm font-medium text-white leading-snug">
            {transcription || <span className="text-white/40 animate-pulse">En écoute...</span>}
          </p>
        ) : (
          <div>
            <p className="text-sm font-bold text-white">Nova AI</p>
            <p className="text-xs text-white/30 mt-0.5">Connecté à Gemini Live</p>
          </div>
        )}
      </div>
    </div>
  );
}
