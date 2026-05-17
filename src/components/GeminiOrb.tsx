import React, { useState, useRef, useEffect } from 'react';
import {
  pcmToBase64,
  playAudioChunk,
  resetAudioSync,
  disposePlaybackChain,
  parseSampleRateFromMime,
  GEMINI_OUTPUT_SAMPLE_RATE,
  GEMINI_INPUT_SAMPLE_RATE,
} from '../utils/audio';
import { useToast } from './ui/ToastProvider';
import { Mic, MicOff } from 'lucide-react';

export default function GeminiOrb() {
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaSessionRef = useRef(0);
  const isActiveRef = useRef(false);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isSessionAlive = (sessionId: number) =>
    mediaSessionRef.current === sessionId && wsRef.current?.readyState === WebSocket.OPEN;

  const startVoice = async () => {
    try {
      const sessionId = ++mediaSessionRef.current;
      setIsConnecting(true);
      resetAudioSync();

      // Récupérer le token d'authentification Supabase
      const { supabase } = await import('../lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Non authentifié — connecte-toi d\'abord.');
      }

      // Construire l'URL WebSocket
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/gemini-live`;
      
      console.log('[Nova AI] Connexion au serveur WebSocket:', wsUrl);

      // Créer la connexion WebSocket
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('[Nova AI] ✅ WebSocket connecté, envoi du token d\'authentification...');
        ws.send(JSON.stringify({ auth: session.access_token }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('[Nova AI] Message reçu:', msg.type);

          switch (msg.type) {
            case 'connected':
              console.log('[Nova AI] ✅ Session Gemini établie');
              if (!isSessionAlive(sessionId)) return;
              setIsConnecting(false);
              setIsActive(true);
              isActiveRef.current = true;
              initializeMediaStreams(ws, sessionId);
              break;

            case 'audio':
              if (msg.data) {
                if (!playbackCtxRef.current) {
                  playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                    sampleRate: GEMINI_OUTPUT_SAMPLE_RATE,
                  });
                }
                const playbackCtx = playbackCtxRef.current;
                if (playbackCtx.state === 'suspended') {
                  playbackCtx.resume();
                }
                playAudioChunk(
                  playbackCtx,
                  msg.data,
                  parseSampleRateFromMime(msg.mimeType),
                );
              }
              break;

            case 'text':
              if (msg.data) {
                setTranscription((prev: string) => prev + msg.data);
              }
              break;

            case 'interrupted':
              resetAudioSync();
              setTranscription('');
              break;

            case 'error':
              console.error('[Nova AI] Erreur serveur:', msg.message);
              toast(msg.message || 'Erreur de connexion à Nova AI', 'error');
              stopVoice();
              break;

            case 'disconnected':
              console.warn('[Nova AI] Session Gemini fermée par le serveur');
              toast('Session Nova AI terminée', 'error');
              stopVoice();
              break;
          }
        } catch (e) {
          console.error('[Nova AI] Erreur parsing message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[Nova AI] ❌ Erreur WebSocket:', error);
        toast('Erreur de connexion au serveur', 'error');
        stopVoice();
      };

      ws.onclose = () => {
        console.log('[Nova AI] 📴 WebSocket fermé');
        if (isActiveRef.current) {
          toast('Connexion perdue', 'error');
        }
        stopVoice();
      };

    } catch (err: any) {
      setIsConnecting(false);
      setIsActive(false);
      console.error('[Nova AI] Erreur démarrage:', err);
      toast(err.message || 'Impossible de démarrer Nova AI.', 'error');
    }
  };

  const startAudioCapture = async (
    ws: WebSocket,
    sessionId: number,
    stream: MediaStream,
    audioCtx: AudioContext,
  ) => {
    const workletUrl = `${import.meta.env.BASE_URL}pcm-capture-processor.js`;
    const sendPcm = (pcm: Float32Array) => {
      if (!isSessionAlive(sessionId)) return;
      ws.send(JSON.stringify({ type: 'audio', data: pcmToBase64(pcm) }));
    };

    try {
      await audioCtx.audioWorklet.addModule(workletUrl);
      if (!isSessionAlive(sessionId) || audioCtx.state === 'closed') return;

      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor', {
        processorOptions: { bufferSize: 2048 },
      });
      workletNodeRef.current = workletNode;
      workletNode.port.onmessage = (e: MessageEvent) => {
        if (e.data?.pcm) sendPcm(e.data.pcm);
      };
      audioCtx.createMediaStreamSource(stream).connect(workletNode);
      console.log('[Nova AI] ✅ AudioWorklet initialisé');
    } catch (error) {
      if (!isSessionAlive(sessionId) || audioCtx.state === 'closed') return;
      console.warn('[Nova AI] AudioWorklet indisponible, fallback ScriptProcessor', error);

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = processor;
      source.connect(processor);
      processor.connect(audioCtx.destination);
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        sendPcm(e.inputBuffer.getChannelData(0));
      };
    }
  };

  const startVideoCapture = (ws: WebSocket, sessionId: number) => {
    const sendVideoFrame = () => {
      if (!isSessionAlive(sessionId)) return;

      const video = videoPreviewRef.current;
      if (!video || video.videoWidth === 0) return;

      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 320, 240);
      const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      ws.send(JSON.stringify({ type: 'video', data: base64Data }));
    };

    videoIntervalRef.current = setInterval(sendVideoFrame, 4000);
    sendVideoFrame();
  };

  const initializeMediaStreams = async (ws: WebSocket, sessionId: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (!isSessionAlive(sessionId)) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const videoEl = videoPreviewRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play().catch(() => undefined);
      }

      console.log('[Nova AI] ✅ Accès média accordé');

      const captureCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: GEMINI_INPUT_SAMPLE_RATE,
      });
      captureCtxRef.current = captureCtx;
      if (captureCtx.state === 'suspended') {
        await captureCtx.resume();
      }

      playbackCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: GEMINI_OUTPUT_SAMPLE_RATE,
      });
      await playbackCtxRef.current.resume().catch(() => undefined);

      await startAudioCapture(ws, sessionId, stream, captureCtx);

      if (!isSessionAlive(sessionId)) return;

      if (stream.getVideoTracks().length > 0) {
        setTimeout(() => {
          if (isSessionAlive(sessionId)) startVideoCapture(ws, sessionId);
        }, 500);
      }
    } catch (err) {
      if (!isSessionAlive(sessionId)) return;
      console.error('[Nova AI] Erreur initialisation média:', err);
      toast('Erreur d\'accès à la caméra/micro', 'error');
      stopVoice();
    }
  };

  const stopVoice = () => {
    mediaSessionRef.current += 1;
    isActiveRef.current = false;
    setIsActive(false);
    setIsConnecting(false);

    // Arrêter l'envoi de frames vidéo
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }

    // Fermer le WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Nettoyer l'audio worklet / script processor
    workletNodeRef.current?.port.postMessage({ type: 'stop' });
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;

    disposePlaybackChain();
    captureCtxRef.current?.close().catch(console.error);
    captureCtxRef.current = null;
    playbackCtxRef.current?.close().catch(console.error);
    playbackCtxRef.current = null;

    // Arrêter la vidéo preview
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }

    // Arrêter tous les tracks média
    streamRef.current?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    streamRef.current = null;

    // Réinitialiser la transcription
    setTranscription('');
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
