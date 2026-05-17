import React, { useState, useRef, useEffect } from 'react';
import { pcmToBase64, playAudioChunk, resetAudioSync } from '../utils/audio';

export default function GeminiOrb() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startVoice = async () => {
    try {
      setIsConnecting(true);
      resetAudioSync();
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        setIsConnecting(false);
        setIsActive(true);

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const source = audioCtx.createMediaStreamSource(stream);
        // Using ScriptProcessorNode for simplicity despite it being deprecated
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        
        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.audio && audioCtxRef.current) {
          playAudioChunk(audioCtxRef.current, msg.audio);
        }
        if (msg.interrupted) {
          resetAudioSync();
        }
      };

      ws.onerror = (e) => {
        console.error("WS Error", e);
        stopVoice();
      };

      ws.onclose = () => {
        stopVoice();
      };

    } catch (err) {
      console.error(err);
      setIsConnecting(false);
      setIsActive(false);
    }
  };

  const stopVoice = () => {
    setIsActive(false);
    setIsConnecting(false);
    if (processorRef.current && audioCtxRef.current) {
      processorRef.current.disconnect();
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(console.error);
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const toggleVoice = () => {
    if (isActive || isConnecting) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  useEffect(() => {
    return () => {
      stopVoice();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-4">
      <div 
        onClick={toggleVoice}
        className={`w-32 h-32 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500
          ${isActive ? 'voice-orb neon-glow scale-110 shadow-[0_0_50px_rgba(34,211,238,0.5)]' : 'bg-white/5 border border-white/10 hover:bg-white/10'}
          ${isConnecting ? 'animate-pulse' : ''}
        `}
      >
         <div className={`w-28 h-28 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all ${isActive ? 'scale-90' : ''}`}>
           {!isActive && !isConnecting && (
              <span className="text-white/40 font-bold tracking-widest uppercase text-xs">Tap to Speak</span>
           )}
           {isConnecting && (
             <span className="text-cyan-400 font-bold text-xs uppercase animate-pulse">Connecting...</span>
           )}
         </div>
      </div>
      <div className="text-center space-y-2 h-16">
        {isActive ? (
          <>
            <p className="text-lg font-medium leading-tight text-cyan-400">Listening...</p>
            <p className="text-[10px] font-mono text-cyan-400/50 uppercase tracking-widest animate-pulse">Real-time Audio Streaming</p>
          </>
        ) : (
          <>
            <p className="text-lg font-medium leading-tight">Nova AI</p>
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Connect to Gemini Live</p>
          </>
        )}
      </div>
    </div>
  );
}
