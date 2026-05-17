import React, { useState, useRef, useEffect } from 'react';
import { pcmToBase64, playAudioChunk, resetAudioSync } from '../utils/audio';

export default function GeminiOrb() {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const startVoice = async () => {
    try {
      setIsConnecting(true);
      resetAudioSync();

      // ── Grab the Supabase session JWT before opening the socket ──
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated — please sign in first.');
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        // ── First message: authenticate with the Supabase JWT ────
        ws.send(JSON.stringify({ auth: session.access_token }));
        setIsConnecting(false);
        setIsActive(true);

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioCtxRef.current = audioCtx;

        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true, 
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } 
        });
        streamRef.current = stream;

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
        
        // ── Video capture — throttled to 1 frame / 4s ─────────────
        // 1 fps causes ~75% wasted CPU on encode+base64+JSON. 4s is enough for
        // contextual AI awareness without killing battery.
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
              // ✅ Downscale to 320×240 before encoding — AI doesn't need full res
              const canvas = document.createElement('canvas');
              canvas.width = 320; canvas.height = 240;
              canvas.getContext('2d')?.drawImage(bitmap, 0, 0, 320, 240);
              const base64Jpeg = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
              ws.send(JSON.stringify({ video: base64Jpeg }));
            } catch { /* ignore frame grab errors when stopping */ }
            finally { isSendingFrame = false; }
            setTimeout(sendVideoFrame, 4000); // ✅ every 4s, not 1s
          };
          sendVideoFrame();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        // ScriptProcessorNode — deprecated but functional (AudioWorklet upgrade planned)
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
        if (msg.text) {
          setTranscription(prev => prev + msg.text);
        }
        if (msg.interrupted) {
          resetAudioSync();
          setTranscription('');
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
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
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
        className={`w-32 h-32 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 relative overflow-hidden
          ${isActive ? 'voice-orb neon-glow scale-110 shadow-[0_0_50px_rgba(34,211,238,0.5)]' : 'bg-white/5 border border-white/10 hover:bg-white/10'}
          ${isConnecting ? 'animate-pulse' : ''}
        `}
      >
        <video 
          ref={videoPreviewRef}
          autoPlay 
          playsInline 
          muted 
          className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] rounded-full opacity-60 pointer-events-none transition-opacity duration-500 ${isActive ? 'opacity-60' : 'opacity-0 hidden'}`}
        />
         <div className={`w-28 h-28 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all z-10 ${isActive ? 'scale-90 bg-transparent' : ''}`}>
           {!isActive && !isConnecting && (
              <span className="text-white/40 font-bold tracking-widest uppercase text-xs">Tap to Speak</span>
           )}
           {isConnecting && (
             <span className="text-cyan-400 font-bold text-xs uppercase animate-pulse">Connecting...</span>
           )}
         </div>
      </div>
      <div className="text-center space-y-2 h-24 max-w-xs overflow-hidden flex flex-col justify-center">
        {isActive ? (
          <>
            <p className="text-lg font-medium leading-tight text-cyan-400">
               {transcription ? transcription : "Listening..."}
            </p>
            {!transcription && (
               <p className="text-[10px] font-mono text-cyan-400/50 uppercase tracking-widest animate-pulse">Real-time Audio Streaming</p>
            )}
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
