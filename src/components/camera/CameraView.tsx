import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Zap, ZapOff, Circle, AlertCircle, X, Send, Download, Video, Loader2, User } from 'lucide-react';
import { useConversations } from '../../hooks/useConversations';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store/useAppStore';
import { useToast } from '../ui/ToastProvider';

export default function CameraView({ isActive = true }: { isActive?: boolean }) {
  const { user, directChatId, setDirectChatId, setShowProfile } = useAppStore();
  const { toast } = useToast();
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
  
  const [capturedMedia, setCapturedMedia] = useState<{ type: 'image' | 'video', url: string } | null>(null);

  // Send To state
  const [showSendTo, setShowSendTo] = useState(false);
  const { data: conversations, isLoading: convLoading } = useConversations();
  const [isSending, setIsSending] = useState(false);

  
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 35 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_VIDEO_TYPES = new Set(['video/webm', 'video/mp4']);

  const stopStream = useCallback(() => {
    if (!streamRef.current) return;
    streamRef.current.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setError(null);
    setCapturedMedia(null);
    setShowSendTo(false);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not available in this browser context.");
      }

      const isLowPowerDevice = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: isLowPowerDevice ? 480 : 640 },
          height: { ideal: isLowPowerDevice ? 854 : 1280 },
          frameRate: { ideal: isLowPowerDevice ? 24 : 30, max: 30 },
        },
        audio: true,
      });
      
      streamRef.current = newStream;
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      const parsedError = err instanceof Error ? err : new Error("Failed to access camera");
      setError(parsedError.name === 'NotAllowedError' ? 'Camera/Microphone permission denied.' : parsedError.message);
    }
  }, [facingMode, stopStream]);

  useEffect(() => {
    if (!isActive) {
      stopStream();
      return;
    }

    startCamera();
    return () => {
      stopStream();
    };
  }, [isActive, startCamera, stopStream]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const toggleFlash = () => {
    setFlashMode(!flashMode);
  };

  const takePhoto = () => {
    if (isRecording) return; 

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      // Fallback in case metadata is not fully loaded yet
      canvas.width = video.videoWidth || video.clientWidth || 640;
      canvas.height = video.videoHeight || video.clientHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedMedia({ type: 'image', url: dataUrl });
        stopStream();
      }
    }
  };

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Avoid interfering with click events or double events
    if (e.cancelable) e.preventDefault();
    if (isRecording) return;
    
    isHoldingRef.current = false;
    touchStartRef.current = Date.now();
    
    pressTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      startRecording();
    }, 400); // 400ms threshold for video recording
  };

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    // Avoid double events
    if (e.cancelable) e.preventDefault();
    
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    
    const duration = Date.now() - touchStartRef.current;
    
    if (isHoldingRef.current || isRecording) {
      stopRecording();
    } else if (duration < 400) {
      takePhoto();
    }
    
    isHoldingRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  const startRecording = () => {
    if (!stream) return;
    
    let options = { mimeType: 'video/webm;codecs=vp9,opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: '' };
        }
      }
    }

    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'video/webm' });
      const videoUrl = URL.createObjectURL(blob);
      setCapturedMedia({ type: 'video', url: videoUrl });
      setIsRecording(false);
      setRecordingDuration(0);
      stopStream();
    };

    try {
        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
      console.error("Recording start failed", err);
    }
  };

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 60) {
            stopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const discardMedia = () => {
    const urlToRevoke = capturedMedia?.url;
    const isVideo = capturedMedia?.type === 'video';

    setCapturedMedia(null);
    setShowSendTo(false);
    setDirectChatId(null); // Clear direct chat mode
    startCamera(); 

    if (isVideo && urlToRevoke && urlToRevoke.startsWith('blob:')) {
      // Delay revocation slightly to allow React to safely unmount the <video> element,
      // avoiding ERR_FILE_NOT_FOUND console errors.
      setTimeout(() => {
        try {
          URL.revokeObjectURL(urlToRevoke);
        } catch (e) {
          console.warn("Failed to revoke object URL:", e);
        }
      }, 100);
    }
  };


  const validateUploadBlob = (fileBlob: Blob) => {
    const isImage = capturedMedia?.type === 'image';
    const allowedTypes = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;

    if (!allowedTypes.has(fileBlob.type)) {
      throw new Error(`Unsupported ${isImage ? 'image' : 'video'} format: ${fileBlob.type || 'unknown'}`);
    }
    if (fileBlob.size > maxBytes) {
      throw new Error(`${isImage ? 'Image' : 'Video'} file too large. Max ${Math.floor(maxBytes / (1024 * 1024))}MB.`);
    }
  };

  const uploadMedia = async (bucketName: string): Promise<string> => {
    if (!user || !capturedMedia) throw new Error("No captured media");
    
    // Convert URL (blob or dataurl) to raw Blob
    const response = await fetch(capturedMedia.url);
    const fileBlob = await response.blob();
    validateUploadBlob(fileBlob);

    // Generate a unique file name
    const fileExt = capturedMedia.type === 'image' ? 'jpg' : 'mp4';
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBlob, {
        contentType: fileBlob.type,
        cacheControl: '3600',
        upsert: true
      });
      
    if (error) throw error;
    
    // ✅ Secure Signed URL: generated for 24 hours (86400s)
    // This perfectly matches the ephemeral lifetime of stories/snaps and prevents public leaks.
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 3600);
      
    if (signedError) throw signedError;
    return signedData.signedUrl;
  };

  const handleSendToChat = async (conversationId: string) => {
    if (!user || !capturedMedia) return;
    setIsSending(true);
    try {
      // Upload media to Supabase Storage chats bucket
      const publicUrl = await uploadMedia('chats');

      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        message_type: capturedMedia.type === 'image' ? 'IMAGE' : 'VIDEO',
        media_url: publicUrl,
        content: ''
      });

      if (error) throw error;
      
      discardMedia();
    } catch (err) {
      console.error(err);
      const parsedError = err instanceof Error ? err : new Error('Failed to send message');
      if (parsedError.message.includes('row-level security')) {
        toast('Action failed: Supabase RLS permissions missing for "messages" table. Please add an INSERT policy.', 'error');
      } else {
        toast('Failed to send: ' + parsedError.message, 'error');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handlePostStory = async () => {
    if (!user || !capturedMedia) return;
    setIsSending(true);
    try {
      // 24 hours expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Upload media to Supabase Storage stories bucket
      const publicUrl = await uploadMedia('stories');

      const { error } = await supabase.from('stories').insert({
        user_id: user.id,
        media_type: capturedMedia.type === 'image' ? 'IMAGE' : 'VIDEO',
        media_url: publicUrl,
        expires_at: expiresAt.toISOString(),
      });

      if (error) throw error;
      
      discardMedia();
    } catch (err) {
      console.error(err);
      const parsedError = err instanceof Error ? err : new Error('Failed to send message');
      if (parsedError.message.includes('row-level security')) {
        toast('Action failed: Supabase RLS permissions missing for "stories" table. Please configure an INSERT policy with "user_id" check in your database setting.', 'error');
      } else {
        toast('Failed to post story: ' + parsedError.message, 'error');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#050505] p-2 pb-[100px] overflow-hidden flex flex-col">
      <div className="flex-1 rounded-[40px] camera-gradient border border-white/10 overflow-hidden relative shadow-2xl flex items-center justify-center">
        {error ? (
          <div className="text-center p-6 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full glass-dark flex items-center justify-center text-red-400">
              <AlertCircle size={32} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-2">Access Denied</h3>
              <p className="text-white/60 text-sm">{error}</p>
            </div>
            <button 
              onClick={startCamera}
              className="px-6 py-2 mt-4 glass rounded-full text-white font-medium hover:bg-white/10 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : capturedMedia ? (
           // Media Preview State
           <div className="absolute inset-0 w-full h-full">
             {capturedMedia.type === 'image' ? (
                // Image is already physically mirrored by the canvas draw context, so we display it flat.
                <img src={capturedMedia.url} alt="Captured" className="w-full h-full object-cover" />
             ) : (
                // Video captures are flat, so we mirror them in CSS if the front camera was used.
                <video src={capturedMedia.url} autoPlay loop playsInline className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
             )}
             
             <div className="absolute inset-x-0 top-0 p-6 flex justify-between items-start z-10 bg-gradient-to-b from-black/50 to-transparent pt-8">
               <button onClick={discardMedia} className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white backdrop-blur-md">
                 <X size={24} />
               </button>
             </div>
             
             {/* Preview Tools */}
             <div className="absolute top-8 right-6 flex flex-col gap-4 z-10">
               <button className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white backdrop-blur-md">
                 <span className="font-bold text-xl">T</span>
               </button>
               <button className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white backdrop-blur-md">
                 <span className="font-bold">✨</span>
               </button>
               <a href={capturedMedia.url} download={capturedMedia.type === 'image' ? 'novasnap.jpg' : 'novasnap.webm'} className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white mt-auto backdrop-blur-md">
                 <Download size={20} />
               </a>
             </div>

             {/* Send To Modal Overlay */}
             {showSendTo ? (
               <div className="absolute inset-x-0 bottom-0 top-auto h-2/3 glass-dark rounded-t-[40px] z-20 flex flex-col backdrop-blur-xl border-t border-white/10 animate-in slide-in-from-bottom">
                 <div className="p-6 flex flex-col h-full text-white">
                   <h2 className="text-xl font-bold mb-4">Send To</h2>
                   
                   <div className="flex-1 overflow-y-auto pr-2 pb-8 flex flex-col gap-3">
                     <button 
                       onClick={handlePostStory}
                       disabled={isSending}
                       className="flex items-center gap-3 p-4 rounded-3xl glass hover:bg-white/10 transition-colors w-full text-left font-bold"
                     >
                       <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center">+</div >
                       <span>My Story</span>
                     </button>
                     
                     <h3 className="font-medium text-white/50 text-sm mt-2 mb-1 px-2 uppercase tracking-wide">Chats</h3>
                     {convLoading && <Loader2 className="animate-spin mx-auto text-white/50" />}
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
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center font-bold text-xs p-[1px]">
                               <div className="w-full h-full bg-black rounded-full flex items-center justify-center">
                                 {conv.title?.substring(0, 2).toUpperCase() || 'CH'}
                               </div>
                            </div>
                            <span className="font-medium">{conv.title}</span>
                          </button>
                        );
                     })}
                   </div>
                 </div>
               </div>
             ) : (
                <div className="absolute bottom-8 left-6 right-6 flex justify-between items-center gap-3 z-10">
                  {directChatId && conversations?.find(c => c.conversations?.id === directChatId)?.conversations ? (
                    <>
                      <button 
                        onClick={async () => {
                          await handleSendToChat(directChatId);
                          setDirectChatId(null);
                        }}
                        disabled={isSending}
                        className="flex-1 bg-gradient-to-r from-cyan-400 to-blue-500 text-white py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] cursor-pointer"
                      >
                        Send to {conversations.find(c => c.conversations?.id === directChatId)?.conversations?.title} <Send size={18} />
                      </button>
                      <button 
                        onClick={() => setShowSendTo(true)}
                        className="px-5 py-4 bg-white/10 hover:bg-white/20 text-white rounded-full font-semibold text-sm transition-all cursor-pointer"
                      >
                        Others
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => setShowSendTo(true)}
                      className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 hover:from-cyan-300 hover:to-blue-400 transition-all shadow-[0_0_20px_rgba(34,211,238,0.4)] ml-auto cursor-pointer"
                    >
                      Send To <Send size={18} />
                    </button>
                  )}
                </div>
             )}
             
             {isSending && (
               <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
                 <Loader2 className="animate-spin text-white w-12 h-12" />
               </div>
             )}
           </div>
        ) : (
          <>
            {/* Video Preview */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-transform duration-300 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none z-0"></div>

            {/* Top Controls */}
            <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
              <button 
                onClick={() => setShowProfile(true)}
                className="w-12 h-12 glass flex items-center justify-center text-white rounded-full font-bold hover:bg-white/10 transition-colors cursor-pointer"
              >
                <User size={20} />
              </button>
              
              <div className="flex flex-col gap-4">
                <button onClick={toggleCamera} className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white">
                  <RefreshCw size={20} />
                </button>
                <button onClick={toggleFlash} className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white">
                  {flashMode ? <Zap size={20} className="text-cyan-400" /> : <ZapOff size={20} />}
                </button>
                <button className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white">
                  <Circle size={20} />
                </button>
              </div>
            </div>

            {/* Recording Hint */}
            {isRecording && (
                <div className="absolute top-8 left-[70px] glass-dark px-4 py-2 rounded-full flex items-center gap-2 z-10">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-[10px] font-mono tracking-widest text-white">{formatTime(recordingDuration)}</span>
                </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-8 inset-x-0 flex flex-col items-center justify-end z-10">
              {/* Shutter Button */}
              <button 
                onMouseDown={handlePressStart}
                onMouseUp={handlePressEnd}
                onMouseLeave={handlePressEnd}
                onTouchStart={handlePressStart}
                onTouchEnd={handlePressEnd}
                className={`w-24 h-24 p-2 rounded-full border-4 flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all cursor-pointer ${isRecording ? 'border-red-500 scale-110 animate-pulse' : 'border-white hover:scale-105 active:scale-95'}`}
              >
                <div className={`w-full h-full rounded-full transition-all duration-300 ${isRecording ? 'bg-red-500 scale-75 rounded-xl' : 'bg-white/90 backdrop-blur-sm'}`} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
