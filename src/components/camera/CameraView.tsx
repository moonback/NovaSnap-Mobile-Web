import React, { useRef, useState, useCallback, useEffect } from 'react';
import { RefreshCw, Zap, ZapOff, X, Send, Download, Loader2, Timer, Smile, UserPlus, Ghost } from 'lucide-react';
import { useConversations } from '../../hooks/useConversations';
import { useFriends } from '../../hooks/useFriends';
import { supabase, getValidMediaUrl } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../ui/ToastProvider';

export default function CameraView({ isActive = true }: { isActive?: boolean }) {
  const { user, directChatId, setDirectChatId, setShowProfile, setShowFriends } = useAppStore();
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
  const [capturedMedia, setCapturedMedia] = useState<{ type: 'image' | 'video'; url: string } | null>(null);
  const [showSendTo, setShowSendTo] = useState(false);
  const { data: conversations, isLoading: convLoading } = useConversations();
  const [isSending, setIsSending] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: isLowPower ? 480 : 640 }, height: { ideal: isLowPower ? 854 : 1280 }, frameRate: { ideal: isLowPower ? 24 : 30, max: 30 } },
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
      setCapturedMedia({ type: 'video', url: URL.createObjectURL(blob) });
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
        setRecordingDuration((prev) => { if (prev >= 60) { stopRecording(); return 60; } return prev + 1; });
      }, 1000);
    } else { setRecordingDuration(0); }
    return () => clearInterval(interval);
  }, [isRecording]);

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
    const allowedTypes = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (!allowedTypes.has(fileBlob.type)) throw new Error(`Format non supporté : ${fileBlob.type || 'inconnu'}`);
    if (fileBlob.size > maxBytes) throw new Error(`Fichier trop lourd. Max ${Math.floor(maxBytes / (1024 * 1024))}MB.`);
  };

  const uploadMedia = async (bucketName: string): Promise<string> => {
    if (!user || !capturedMedia) throw new Error('Aucun média capturé');
    const response = await fetch(capturedMedia.url);
    const fileBlob = await response.blob();
    validateUploadBlob(fileBlob);
    const fileExt = capturedMedia.type === 'image' ? 'jpg' : 'mp4';
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { error } = await supabase.storage.from(bucketName).upload(fileName, fileBlob, { contentType: fileBlob.type, cacheControl: '3600', upsert: true });
    if (error) throw error;
    const { data: signedData, error: signedError } = await supabase.storage.from(bucketName).createSignedUrl(fileName, 3600);
    if (signedError) throw signedError;
    return signedData.signedUrl;
  };

  const handleSendToChat = async (conversationId: string) => {
    if (!user || !capturedMedia) return;
    setIsSending(true);
    try {
      const publicUrl = await uploadMedia('chats');
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId, sender_id: user.id,
        message_type: capturedMedia.type === 'image' ? 'IMAGE' : 'VIDEO',
        media_url: publicUrl, content: '',
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
      const publicUrl = await uploadMedia('stories');
      const { error } = await supabase.from('stories').insert({
        user_id: user.id, media_type: capturedMedia.type === 'image' ? 'IMAGE' : 'VIDEO',
        media_url: publicUrl, expires_at: expiresAt.toISOString(),
      });
      if (error) throw error;
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
          /* ── Preview ── */
          <div className="absolute inset-0">
            {capturedMedia.type === 'image' ? (
              <img src={capturedMedia.url} alt="Captured" className="w-full h-full object-cover" />
            ) : (
              <video src={capturedMedia.url} autoPlay loop playsInline className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
            )}

            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 p-5 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
              <button onClick={discardMedia} className="w-11 h-11 glass-dark rounded-full flex items-center justify-center text-white">
                <X size={22} />
              </button>
              {/* Right tools */}
              <div className="flex flex-col gap-3">
                <button className="w-11 h-11 glass-dark rounded-full flex items-center justify-center text-white font-black text-lg">T</button>
                <button className="w-11 h-11 glass-dark rounded-full flex items-center justify-center text-white">
                  <Smile size={20} />
                </button>
                <button className="w-11 h-11 glass-dark rounded-full flex items-center justify-center text-white">
                  <Timer size={20} />
                </button>
                <a href={capturedMedia.url} download={capturedMedia.type === 'image' ? 'novasnap.jpg' : 'novasnap.webm'} className="w-11 h-11 glass-dark rounded-full flex items-center justify-center text-white">
                  <Download size={18} />
                </a>
              </div>
            </div>

            {/* Send To panel */}
            {showSendTo ? (
              <div className="absolute inset-x-0 bottom-0 h-[60%] glass-dark rounded-t-[32px] flex flex-col border-t border-white/10 animate-in slide-in-from-bottom duration-300">
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
              <div className="absolute bottom-6 inset-x-5 flex items-center gap-3">
                {directChatId && conversations?.find((c) => c.conversations?.id === directChatId)?.conversations ? (
                  <>
                    <button
                      onClick={async () => { await handleSendToChat(directChatId); setDirectChatId(null); }}
                      disabled={isSending}
                      className="flex-1 bg-snap-yellow text-black py-4 rounded-full font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-snap"
                    >
                      Envoyer <Send size={18} />
                    </button>
                    <button onClick={() => setShowSendTo(true)} className="px-5 py-4 glass-dark text-white rounded-full font-bold text-sm">
                      Autres
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowSendTo(true)}
                    className="ml-auto bg-snap-yellow text-black px-7 py-4 rounded-full font-black flex items-center gap-2 active:scale-95 transition-all shadow-snap"
                  >
                    Envoyer <Send size={18} />
                  </button>
                )}
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

            {/* ── Topbar ── */}
            <div className="absolute top-0 inset-x-0 z-10 px-4 pt-5 pb-3">
              <div className="flex items-center justify-between">

                {/* Gauche : avatar utilisateur */}
                <button
                  onClick={() => setShowProfile(true)}
                  className="relative w-11 h-11 rounded-full overflow-hidden ring-2 ring-white/20 active:scale-90 transition-transform shrink-0"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Mon profil" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                      <Ghost size={18} className="text-white/50" />
                    </div>
                  )}
                </button>

                {/* Centre : logo NovaSnap */}
                <div className="flex flex-col items-center gap-0.5 select-none">
                  <div className="w-8 h-8 rounded-[10px] bg-snap-yellow flex items-center justify-center shadow-snap">
                    <svg viewBox="0 0 100 100" className="w-5 h-5" fill="none">
                      <path
                        d="M50 10C28 10 10 28 10 50c0 8 2.5 15.5 6.8 21.6L10 90l18.4-6.8C34.5 87.5 42 90 50 90c22 0 40-18 40-40S72 10 50 10z"
                        fill="black"
                      />
                      <circle cx="35" cy="50" r="5" fill="white" />
                      <circle cx="50" cy="50" r="5" fill="white" />
                      <circle cx="65" cy="50" r="5" fill="white" />
                    </svg>
                  </div>
                </div>

                {/* Droite : actions groupées */}
                <div className="flex items-center gap-2">
                  {/* Recherche d'amis */}
                  <button
                    onClick={() => setShowFriends(true)}
                    className="relative w-11 h-11 glass-dark rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <UserPlus size={18} className="text-white" />
                    {pendingCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center border border-black">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                  </button>

                  {/* Retournement caméra */}
                  <button
                    onClick={() => setFacingMode((p) => p === 'user' ? 'environment' : 'user')}
                    className="w-11 h-11 glass-dark rounded-full flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <RefreshCw size={18} className="text-white" />
                  </button>

                  {/* Flash */}
                  <button
                    onClick={() => setFlashMode(!flashMode)}
                    className={`w-11 h-11 rounded-full flex items-center justify-center active:scale-90 transition-all ${
                      flashMode ? 'bg-snap-yellow shadow-snap' : 'glass-dark'
                    }`}
                  >
                    {flashMode
                      ? <Zap size={18} className="text-black" />
                      : <ZapOff size={18} className="text-white/70" />
                    }
                  </button>
                </div>
              </div>
            </div>

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 glass-dark px-4 py-2 rounded-full flex items-center gap-2 z-10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-mono font-bold">{formatTime(recordingDuration)}</span>
              </div>
            )}

            {/* Bottom shutter */}
            <div className="absolute bottom-8 inset-x-0 flex flex-col items-center gap-4 z-10">
              {/* Hint text */}
              {!isRecording && (
                <p className="text-white/40 text-xs font-medium">Appuie pour photo · Maintiens pour vidéo</p>
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
                  className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    isRecording
                      ? 'bg-red-500 scale-110'
                      : 'bg-white active:scale-90'
                  }`}
                  style={isRecording ? {} : { boxShadow: '0 0 0 4px rgba(255,255,255,0.3), 0 0 0 8px rgba(255,255,255,0.1)' }}
                >
                  {isRecording && (
                    <div className="w-8 h-8 rounded-lg bg-white" />
                  )}
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
