import React, { useState, useRef, useEffect } from 'react';
import { pcmToBase64, playAudioChunk, resetAudioSync } from '../utils/audio';
import { useToast } from './ui/ToastProvider';
import { Mic, MicOff } from 'lucide-react';

export default function GeminiOrb() {
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [isGeminiReady, setIsGeminiReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startVoice = async () => {
    try {
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
              setIsConnecting(false);
              setIsActive(true);
              initializeMediaStreams(ws);
              break;

            case 'audio':
              if (msg.data && audioCtxRef.current) {
                playAudioChunk(audioCtxRef.current, msg.data);
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
              console.log('[Nova AI] Session Gemini fermée');
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
        if (isActive) {
          toast('Connexion perdue', 'error');
          stopVoice();
        }
      };

    } catch (err: any) {
      setIsConnecting(false);
      setIsActive(false);
      console.error('[Nova AI] Erreur démarrage:', err);
      toast(err.message || 'Impossible de démarrer Nova AI.', 'error');
    }
  };

  const initializeMediaStreams = async (ws: WebSocket) => {
    try {
      // Initialiser le contexte audio
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;

      // Demander l'accès à la caméra et au micro
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      console.log('[Nova AI] ✅ Accès média accordé');

      // Capturer et envoyer des frames vidéo périodiquement
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const imageCapture = new (window as any).ImageCapture(videoTrack);
        
        const sendVideoFrame = async () => {
          if (ws.readyState !== WebSocket.OPEN) return;
          
          try {
            const bitmap = await imageCapture.grabFrame();
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(bitmap, 0, 0, 320, 240);
            
            const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
            
            ws.send(JSON.stringify({ type: 'video', data: base64Data }));
          } catch (error) {
            console.warn('[Nova AI] Erreur capture vidéo:', error);
          }
        };

        videoIntervalRef.current = setInterval(sendVideoFrame, 4000);
        sendVideoFrame();
      }

      // Capturer et envoyer l'audio en temps réel
      try {
        await audioCtx.audioWorklet.addModule('/pcm-capture-processor.js');
        const workletNode = new AudioWorkletNode(audioCtx, 'pcm-capture-processor', {
          processorOptions: { bufferSize: 4096 },
        });
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (e: any) => {
          if (ws.readyState === WebSocket.OPEN && e.data?.pcm) {
            ws.send(JSON.stringify({ type: 'audio', data: pcmToBase64(e.data.pcm) }));
          }
        };

        audioCtx.createMediaStreamSource(stream).connect(workletNode);
        console.log('[Nova AI] ✅ AudioWorklet initialisé');
      } catch (error) {
        console.warn('[Nova AI] AudioWorklet non disponible, utilisation de ScriptProcessor');
        const source = audioCtx.createMediaStreamSource(stream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioCtx.destination);

        processor.onaudioprocess = (e: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'audio', data: pcmToBase64(e.inputBuffer.getChannelData(0)) }));
          }
        };
      }
    } catch (err) {
      console.error('[Nova AI] Erreur initialisation média:', err);
      toast('Erreur d\'accès à la caméra/micro', 'error');
      stopVoice();
    }
  };

  const stopVoice = () => {
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

    // Nettoyer l'audio worklet
    workletNodeRef.current?.port.postMessage({ type: 'stop' });
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    // Fermer le contexte audio
    audioCtxRef.current?.close().catch(console.error);
    audioCtxRef.current = null;

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
