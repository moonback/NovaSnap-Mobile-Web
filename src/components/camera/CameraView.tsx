import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RefreshCw, Zap, ZapOff, X, Send, Download, Loader2, UserPlus, Ghost, Infinity as InfinityIcon } from 'lucide-react';
import { useConversations } from '../../hooks/useConversations';
import { useFriends } from '../../hooks/useFriends';
import { useSaveMemory } from '../../hooks/useMemories';
import { supabase, getValidMediaUrl } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../ui/ToastProvider';
import NotificationBell from '../ui/NotificationBell';
import SnapEditor, { type EditorState } from './SnapEditor';

export default function CameraView({ isActive = true }: { isActive?: boolean }) {
  const { user, directChatId, setDirectChatId, setShowProfile, setShowFriends, setIsEditingSnap } = useAppStore();
  const { toast } = useToast();
  const { pendingCount } = useFriends();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef<boolean>(false);
  const touchStartRef = useRef<number>(0);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashMode, setFlashMode] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<{ type: 'image' | 'video'; url: string; isBoomerang?: boolean } | null>(null);
  const [showSendTo, setShowSendTo] = useState(false);
  const { data: conversations, isLoading: convLoading } = useConversations();
  const [isSending, setIsSending] = useState(false);
  const saveMemory = useSaveMemory();
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState>({
    textLayers: [], strokes: [], stickerLayers: [], rotation: 0, videoSpeed: 1,
  });

  const [isBoomerang, setIsBoomerang] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const playbackDirectionRef = useRef<'forward' | 'backward'>('forward');

  // Sync local editing state with global store to hide TabBar
  useEffect(() => {
    setIsEditingSnap(!!capturedMedia);
    return () => setIsEditingSnap(false);
  }, [capturedMedia, setIsEditingSnap]);

  // Fetch avatar de l'utilisateur connecté
  useEffect(() => {
    if (!user) return;
    supabase
      .from('users')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
      .then(async ({ data }) => {
        if (data?.avatar_url) {
          const url = await getValidMediaUrl('avatars', data.avatar_url);
          setAvatarUrl(url);
        }
      });
  }, [user?.id]);

  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const MAX_VIDEO_BYTES = 35 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
  const ALLOWED_VIDEO_TYPES = new Set(['video/webm', 'video/mp4']);

  const stopStream = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setError(null);
    setCapturedMedia(null);
    setShowSendTo(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API non disponible.');
      const isLowPower = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
      // On demande du 1920x1080 (paysage) même sur mobile.
      // Les navigateurs mobiles (iOS/Android) utilisent les résolutions standards du capteur (qui sont en paysage) 
      // et les retournent automatiquement (rotate) en portrait. 
      // Si on demande du 1080x1920, beaucoup tombent en erreur et renvoient un ratio 4:3 basique, ce qui cause le zoom abusif.
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode, 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 }
        },
        audio: true,
      });
      streamRef.current = newStream;
      setStream(newStream);
      if (videoRef.current) videoRef.current.srcObject = newStream;
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('Impossible d\'accéder à la caméra');
      setError(parsedError.name === 'NotAllowedError' ? 'Permission caméra/micro refusée.' : parsedError.message);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!isActive) { stopStream(); return; }
    startCamera();
    return () => stopStream();
  }, [isActive, startCamera, stopStream]);

  const takePhoto = () => {
    if (isRecording || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCapturedMedia({ type: 'image', url: canvas.toDataURL('image/jpeg', 0.85) });
      stopStream();
    }
  };

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (isRecording) return;
    isHoldingRef.current = false;
    touchStartRef.current = Date.now();
    pressTimerRef.current = setTimeout(() => { isHoldingRef.current = true; startRecording(); }, 400);
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (pressTimerRef.current) { clearTimeout(pressTimerRef.current); pressTimerRef.current = null; }
    const duration = Date.now() - touchStartRef.current;
    if (isHoldingRef.current || isRecording) { stopRecording(); }
    else if (duration < 400) { takePhoto(); }
    isHoldingRef.current = false;
  };

  useEffect(() => () => { if (pressTimerRef.current) clearTimeout(pressTimerRef.current); }, []);

  const startRecording = () => {
    if (!stream) return;
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm;codecs=vp8,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: '' };
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });
      setCapturedMedia({ type: 'video', url: URL.createObjectURL(blob), isBoomerang });
      setIsRecording(false);
      setRecordingDuration(0);
      stopStream();
    };
    try { mediaRecorder.start(); setIsRecording(true); } catch (err) { console.error('Recording failed', err); }
  };

  const stopRecording = () => { if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop(); };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => {
          const maxSec = isBoomerang ? 2 : 60;
          if (prev >= maxSec) {
            stopRecording();
            return maxSec;
          }
          return prev + 1;
        });
      }, 1000);
    } else { setRecordingDuration(0); }
    return () => clearInterval(interval);
  }, [isRecording, isBoomerang]);

  // Boomerang effect (boucle aller-retour)
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video || !capturedMedia || capturedMedia.type !== 'video' || !capturedMedia.isBoomerang) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    playbackDirectionRef.current = 'forward';

    const tick = (now: number) => {
      if (!previewVideoRef.current) return;
      const vid = previewVideoRef.current;
      const elapsed = (now - lastTime) / 1000;
      lastTime = now;

      const speed = editorState.videoSpeed;

      if (playbackDirectionRef.current === 'forward') {
        if (vid.paused) {
          vid.play().catch(() => {});
        }
        if (vid.currentTime >= vid.duration - 0.08) {
          playbackDirectionRef.current = 'backward';
          vid.pause();
        }
      } else {
        let nextTime = vid.currentTime - elapsed * speed;
        if (nextTime <= 0.05) {
          nextTime = 0;
          playbackDirectionRef.current = 'forward';
          vid.play().catch(() => {});
        }
        vid.currentTime = nextTime;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [capturedMedia, editorState.videoSpeed]);

  const discardMedia = () => {
    const urlToRevoke = capturedMedia?.url;
    const isVideo = capturedMedia?.type === 'video';
    setCapturedMedia(null);
    setShowSendTo(false);
    setDirectChatId(null);
    startCamera();
    if (isVideo && urlToRevoke?.startsWith('blob:')) {
      setTimeout(() => { try { URL.revokeObjectURL(urlToRevoke); } catch { /* ignore */ } }, 100);
    }
  };

  const validateUploadBlob = (fileBlob: Blob) => {
    const isImage = capturedMedia?.type === 'image';
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    const mime = fileBlob.type.toLowerCase();
    
    if (isImage) {
      if (!mime.startsWith('image/')) {
        throw new Error(`Format d'image non supporté : ${fileBlob.type || 'inconnu'}`);
      }
    } else {
      if (!mime.startsWith('video/')) {
        throw new Error(`Format de vidéo non supporté : ${fileBlob.type || 'inconnu'}`);
      }
    }
    
    if (fileBlob.size > maxBytes) throw new Error(`Fichier trop lourd. Max ${Math.floor(maxBytes / (1024 * 1024))}MB.`);
  };

  // NOUVEAU : Aplatir l'image originale avec les dessins, textes, stickers et rotation du SnapEditor
  const flattenImage = async (): Promise<string> => {
    if (!capturedMedia || capturedMedia.type !== 'image') return capturedMedia?.url || '';

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(capturedMedia.url);
          return;
        }

        // Récupérer la taille réelle de l'image capturée
        const width = img.naturalWidth || 640;
        const height = img.naturalHeight || 480;

        // Récupérer les coordonnées de recadrage précises
        const crop = editorState.crop || { x: 0, y: 0, width: 100, height: 100 };
        const sx = (crop.x / 100) * width;
        const sy = (crop.y / 100) * height;
        const sWidth = (crop.width / 100) * width;
        const sHeight = (crop.height / 100) * height;

        // Déterminer si l'image est pivotée de 90 ou 270 degrés
        const isRotated90or270 = editorState.rotation === 90 || editorState.rotation === 270;
        canvas.width = isRotated90or270 ? sHeight : sWidth;
        canvas.height = isRotated90or270 ? sWidth : sHeight;

        // Centrer et appliquer la rotation
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((editorState.rotation * Math.PI) / 180);

        // Dessiner l'image d'origine. Si front-facing, on la dessine à l'envers (effet miroir)
        if (facingMode === 'user') {
          ctx.scale(-1, 1);
        }
        // Dessiner uniquement la portion rognée (recadrage précis)
        ctx.drawImage(img, sx, sy, sWidth, sHeight, -sWidth / 2, -sHeight / 2, sWidth, sHeight);

        // Revenir en échelle normale pour dessiner les calques d'édition au bon endroit
        if (facingMode === 'user') {
          ctx.scale(-1, 1);
        }

        // Repositionner le point d'origine au coin haut-gauche de l'image d'origine pour que tous les calques s'alignent parfaitement
        ctx.translate(-sWidth / 2 - sx, -sHeight / 2 - sy);

        // Les dessins de SnapEditor sont dessinés sur une grille virtuelle de 720x1280
        const scaleX = width / 720;
        const scaleY = height / 1280;

        // Dessiner les traits de crayon
        for (const stroke of editorState.strokes) {
          if (stroke.points.length < 2) continue;
          ctx.beginPath();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.width * scaleX;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
          }
          ctx.stroke();
        }

        // Dessiner les stickers (Emojis)
        for (const sticker of editorState.stickerLayers) {
          const x = (sticker.x / 100) * width;
          const y = (sticker.y / 100) * height;
          const fontSize = sticker.size * scaleX * 1.3;
          ctx.font = `${fontSize}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(sticker.emoji, x, y);
        }

        // Dessiner les textes
        for (const text of editorState.textLayers) {
          const x = (text.x / 100) * width;
          const y = (text.y / 100) * height;
          const fontSize = text.size * scaleX * 1.1;

          let fontWeight = 'normal';
          let fontFamily = 'sans-serif';

          if (text.font.includes('font-black')) {
            fontWeight = '900';
            fontFamily = 'Impact, "Arial Black", sans-serif';
          } else if (text.font.includes('font-serif')) {
            fontFamily = 'Georgia, serif';
          } else if (text.font.includes('font-mono')) {
            fontFamily = 'monospace';
          } else if (text.font.includes('font-light')) {
            fontWeight = '300';
          }

          ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Ajouter une belle ombre portée noire pour la lisibilité
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 8 * scaleX;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 3 * scaleY;

          ctx.fillStyle = text.color;
          ctx.fillText(text.text, x, y);

          // Réinitialiser les ombres
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };

      img.onerror = () => {
        resolve(capturedMedia.url);
      };

      img.src = capturedMedia.url;
    });
  };

  // NOUVEAU : Sauvegarder dans les Memories Supabase
  const handleSaveToMemories = async () => {
    if (!user || !capturedMedia) return;
    setIsSavingMemory(true);
    try {
      let finalMediaUrl = capturedMedia.url;
      if (capturedMedia.type === 'image') {
        finalMediaUrl = await flattenImage();
      }
      const response = await fetch(finalMediaUrl);
      const fileBlob = await response.blob();
      
      await saveMemory.mutateAsync({
        mediaBlob: fileBlob,
        mediaType: capturedMedia.type === 'image' ? 'IMAGE' : 'VIDEO',
        source: 'camera',
      });
      toast('Sauvegardé dans les Memories !', 'success');
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('Sauvegarde échouée');
      toast('Erreur : ' + parsedError.message, 'error');
    } finally {
      setIsSavingMemory(false);
    }
  };

  // NOUVEAU : Téléchargement du média édité
  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!capturedMedia) return;

    try {
      let url = capturedMedia.url;
      if (capturedMedia.type === 'image') {
        url = await flattenImage();
      }

      const link = document.createElement('a');
      link.href = url;
      link.download = capturedMedia.type === 'image' ? 'novasnap.jpg' : 'novasnap.webm';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast('Média enregistré avec succès !', 'success');
    } catch (err) {
      toast('Impossible de télécharger le fichier.', 'error');
    }
  };

  const uploadMedia = async (
    bucketName: string,
    opts?: { conversationId?: string },
  ): Promise<{ path: string; signedUrl: string }> => {
    if (!user || !capturedMedia) throw new Error('Aucun média capturé');
    
    // Obtain the flattened version of the image (with texts, drawings, stickers)
    let finalMediaUrl = capturedMedia.url;
    if (capturedMedia.type === 'image') {
      finalMediaUrl = await flattenImage();
    }

    const response = await fetch(finalMediaUrl);
    const fileBlob = await response.blob();
    validateUploadBlob(fileBlob);
    const fileExt = capturedMedia.type === 'image' ? 'jpg' : 'webm';

    // Path format depends on bucket:
    //   chats:   <conversation_id>/<sender_uid>/<timestamp>.<ext>  (RLS: conversation-membership gated)
    //   stories: <user_id>/<timestamp>.<ext>                       (RLS: owner-only insert)
    const filePath = bucketName === 'chats' && opts?.conversationId
      ? `${opts.conversationId}/${user.id}/${Date.now()}.${fileExt}`
      : `${user.id}/${Date.now()}.${fileExt}`;

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBlob, { contentType: fileBlob.type, cacheControl: '3600', upsert: true });
    if (error) throw error;
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(filePath, 3600);
    if (signedError) throw signedError;
    return { path: filePath, signedUrl: signedData.signedUrl };
  };

  const handleSendToChat = async (conversationId: string) => {
    if (!user || !capturedMedia) return;
    setIsSending(true);
    try {
      const { path } = await uploadMedia('chats', { conversationId });
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message_type: capturedMedia.type === 'image' ? 'IMAGE' : 'VIDEO',
        media_url: path,
        content: '',
      });
      if (error) throw error;
      discardMedia();
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('Envoi échoué');
      toast('Erreur : ' + parsedError.message, 'error');
    } finally { setIsSending(false); }
  };

  const handlePostStory = async () => {
    if (!user || !capturedMedia) return;
    setIsSending(true);
    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      const { path } = await uploadMedia('stories');
      const privacy = localStorage.getItem('novasnap_settings_story_privacy') || 'friends';
      const { error } = await supabase.from('stories').insert({
        user_id: user.id,
        media_type: capturedMedia.type === 'image' ? 'IMAGE' : 'VIDEO',
        media_url: path,
        expires_at: expiresAt.toISOString(),
        visibility: privacy,
      });
      if (error) {
        console.error('Supabase Insert Error:', error);
        throw error;
      }
      toast('Story publiée !', 'success');
      discardMedia();
    } catch (err) {
      const parsedError = err instanceof Error ? err : new Error('Publication échouée');
      toast('Erreur : ' + parsedError.message, 'error');
    } finally { setIsSending(false); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Camera viewport — full screen, rounded corners */}
      <div className="absolute inset-0 mx-2 my-2 rounded-[32px] overflow-hidden bg-zinc-950">
        {error ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-red-400 text-2xl">!</div>
            <div className="text-center">
              <p className="text-white font-bold mb-1">Accès refusé</p>
              <p className="text-white/50 text-sm">{error}</p>
            </div>
            <button onClick={startCamera} className="px-6 py-2.5 bg-white/10 rounded-full text-white text-sm font-medium hover:bg-white/15 transition-colors">
              Réessayer
            </button>
          </div>
        ) : capturedMedia ? (
          /* ── Preview + Editor ── */
          <div className="absolute inset-0">
            {/* Media preview with rotation and crop clipPath */}
            <div
              className="w-full h-full overflow-hidden transition-all duration-300"
              style={{
                transform: `rotate(${editorState.rotation}deg)`,
                transition: 'transform 0.3s ease, clip-path 0.2s ease',
                transformOrigin: 'center center',
                clipPath: editorState.crop ? `inset(${editorState.crop.y}% ${100 - editorState.crop.x - editorState.crop.width}% ${100 - editorState.crop.y - editorState.crop.height}% ${editorState.crop.x}%)` : 'none'
              }}
            >
              {capturedMedia.type === 'image' ? (
                <img src={capturedMedia.url} alt="Captured" className="w-full h-full object-cover" />
              ) : (
                <video
                  ref={(el) => {
                    if (el) {
                      el.playbackRate = editorState.videoSpeed;
                      previewVideoRef.current = el;
                    }
                  }}
                  src={capturedMedia.url}
                  autoPlay
                  loop={!capturedMedia.isBoomerang}
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
              )}
            </div>

            {/* Snap Editor overlay */}
            <SnapEditor mediaType={capturedMedia.type} onStateChange={setEditorState} hideTools={showSendTo} />

            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 p-5 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
              <button onClick={discardMedia} className="w-11 h-11 glass-dark rounded-full flex items-center justify-center text-white pointer-events-auto">
                <X size={22} />
              </button>
              <button onClick={handleDownload} className="w-11 h-11 glass-dark rounded-full flex items-center justify-center text-white pointer-events-auto">
                <Download size={18} />
              </button>
            </div>

            {/* Send To panel */}
            {showSendTo ? (
              <div className="absolute inset-x-0 bottom-0 h-[80%] glass-dark rounded-t-[32px] flex flex-col border-t border-white/10 animate-in slide-in-from-bottom duration-300">
                <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                  <h2 className="text-white font-black text-lg">Envoyer à</h2>
                  <button onClick={() => setShowSendTo(false)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <X size={16} className="text-white" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto scroll-hide px-4 pb-6 flex flex-col gap-2">
                  {/* My Story */}
                  <button
                    onClick={handlePostStory}
                    disabled={isSending}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors w-full text-left"
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-snap-yellow to-orange-500 flex items-center justify-center font-black text-black text-lg">+</div>
                    <div>
                      <p className="text-white font-bold text-sm">Ma Story</p>
                      <p className="text-white/40 text-xs">Visible 24h</p>
                    </div>
                  </button>

                  <p className="text-white/30 text-xs font-bold uppercase tracking-wider px-1 mt-2 mb-1">Chats</p>
                  {convLoading && <Loader2 className="animate-spin mx-auto text-white/30 mt-4" size={22} />}
                  {conversations?.map((convObj) => {
                    const conv = convObj.conversations;
                    if (!conv) return null;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => handleSendToChat(conv.id)}
                        disabled={isSending}
                        className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors w-full text-left"
                      >
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center font-black text-black text-xs">
                          {conv.title?.substring(0, 2).toUpperCase() || 'CH'}
                        </div>
                        <span className="text-white font-medium text-sm">{conv.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Bottom send button */
              <div className="absolute bottom-[120px] inset-x-5 flex items-center justify-between">
                <button
                  onClick={handleSaveToMemories}
                  disabled={isSavingMemory}
                  className="bg-black/50 backdrop-blur-md border border-white/10 text-white px-5 py-4 rounded-full font-bold text-sm flex items-center gap-2 active:scale-95 transition-all shadow-lg"
                >
                  {isSavingMemory ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                  Enregistrer
                </button>

                <div className="flex items-center gap-3">
                  {directChatId && conversations?.find((c) => c.conversations?.id === directChatId)?.conversations ? (
                    <>
                      <button onClick={() => setShowSendTo(true)} className="px-5 py-4 glass-dark text-white rounded-full font-bold text-sm">
                        Autres
                      </button>
                      <button
                        onClick={async () => { await handleSendToChat(directChatId); setDirectChatId(null); }}
                        disabled={isSending}
                        className="bg-snap-yellow text-black px-7 py-4 rounded-full font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-snap"
                      >
                        Envoyer <Send size={18} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowSendTo(true)}
                      className="bg-snap-yellow text-black px-7 py-4 rounded-full font-black flex items-center gap-2 active:scale-95 transition-all shadow-snap"
                    >
                      Envoyer <Send size={18} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {isSending && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 rounded-[32px]">
                <Loader2 className="animate-spin text-snap-yellow w-10 h-10" />
              </div>
            )}
          </div>
        ) : (
          /* ── Live camera ── */
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/50 pointer-events-none" />

            {/* ── Topbar (Left & Right) ── */}
            <div className="absolute top-0 inset-x-0 z-20 px-5 pt-12 pb-3 pointer-events-none flex justify-between items-start">
              
              {/* Gauche : Avatar & Search */}
              <div className="flex items-center gap-3 pointer-events-auto">
                <button
                  onClick={() => setShowProfile(true)}
                  className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/10 active:scale-90 transition-transform bg-zinc-800 shrink-0"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Ghost size={18} className="text-white/50" />
                    </div>
                  )}
                </button>
              </div>

              {/* Droite : Actions verticales */}
              <div className="flex flex-col items-center gap-3 pointer-events-auto">
                <NotificationBell />
                
                <button
                  onClick={() => setShowFriends(true)}
                  className="relative w-11 h-11 glass-dark rounded-full flex items-center justify-center active:scale-90 transition-transform"
                >
                  <UserPlus size={20} className="text-white" />
                  {pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-snap-yellow text-black text-[9px] font-black flex items-center justify-center border border-black/50">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setFacingMode((p) => p === 'user' ? 'environment' : 'user')}
                  className="w-11 h-11 glass-dark rounded-full flex items-center justify-center active:scale-90 transition-transform"
                >
                  <RefreshCw size={20} className="text-white" />
                </button>

                <button
                  onClick={() => setFlashMode(!flashMode)}
                  className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                    flashMode ? 'bg-snap-yellow shadow-snap text-black' : 'glass-dark text-white'
                  }`}
                >
                  {flashMode ? <Zap size={20} /> : <ZapOff size={20} className="text-white/70" />}
                </button>

                <button
                  onClick={() => setIsBoomerang(!isBoomerang)}
                  title="Mode Boomerang"
                  className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                    isBoomerang ? 'bg-snap-yellow shadow-snap text-black' : 'glass-dark text-white'
                  }`}
                >
                  <InfinityIcon size={22} />
                </button>
              </div>
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 glass-dark px-4 py-2 rounded-full flex items-center gap-2 z-10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-mono font-bold">{formatTime(recordingDuration)}</span>
              </div>
            )}

            {/* ── Zone shutter (au-dessus du TabBar) ── */}
            <div className="absolute bottom-[140px] inset-x-0 flex flex-col items-center gap-4 z-10">
              {/* Hint text */}
              {!isRecording && (
                <p className="text-white/40 text-xs font-semibold tracking-wider drop-shadow-md">
                  Appuie pour photo · Maintiens pour vidéo
                </p>
              )}

              <div className="flex items-center justify-center gap-8">
                {/* Spacer */}
                <div className="w-12" />

                {/* Shutter button */}
                <button
                  onMouseDown={handlePressStart}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={handlePressStart}
                  onTouchEnd={handlePressEnd}
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer relative ${
                    isRecording ? 'scale-110' : 'hover:scale-105 active:scale-95'
                  }`}
                >
                  {/* Outer glowing rings */}
                  <div className={`absolute inset-[-6px] rounded-full border-2 transition-all duration-300 ${
                    isRecording ? 'border-red-500 animate-pulse' : 'border-white/30'
                  }`} />
                  <div className={`absolute inset-[-12px] rounded-full border transition-all duration-300 ${
                    isRecording ? 'border-red-500/20' : 'border-white/10'
                  }`} />
                  
                  {/* Inner button */}
                  <div className={`w-full h-full rounded-full transition-all duration-300 flex items-center justify-center ${
                    isRecording ? 'bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'bg-white shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                  }`}>
                    {isRecording ? (
                      <div className="w-6 h-6 rounded-md bg-white animate-pulse" />
                    ) : (
                      <div className="w-[72px] h-[72px] rounded-full border-2 border-black/5 bg-white" />
                    )}
                  </div>
                </button>

                {/* Spacer */}
                <div className="w-12" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
