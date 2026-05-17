import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, RefreshCw, Zap, ZapOff, Circle } from 'lucide-react';

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [flashMode, setFlashMode] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState(false);

  const startCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: true
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const toggleFlash = () => {
    setFlashMode(!flashMode);
  };

  const takePhoto = () => {
    console.log("Snap!");
  };

  return (
    <div className="relative w-full h-full bg-[#050505] p-2 pb-[100px] overflow-hidden flex flex-col">
      <div className="flex-1 rounded-[40px] camera-gradient border border-white/10 overflow-hidden relative shadow-2xl">
        {/* Video Preview */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-transform duration-300 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"></div>

        {/* Top Controls */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
          <button className="w-12 h-12 glass flex items-center justify-center text-white rounded-full font-bold">
            N
          </button>
          
          <div className="flex flex-col gap-4">
            <button onClick={toggleCamera} className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white">
              <RefreshCw size={20} />
            </button>
            <button onClick={toggleFlash} className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white">
              {flashMode ? <Zap size={20} className="text-yellow-400" /> : <ZapOff size={20} />}
            </button>
            <button className="w-12 h-12 glass-dark rounded-full flex items-center justify-center text-white">
              <Circle size={20} />
            </button>
          </div>
        </div>

        {/* Recording Hint */}
        <div className="absolute top-8 left-24 glass-dark px-4 py-2 rounded-full flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-white">00:00</span>
        </div>

        {/* Bottom Controls inside the camera rounded container */}
        <div className="absolute bottom-8 inset-x-0 flex flex-col items-center justify-end z-10">
          {/* Shutter Button */}
          <button 
            onClick={takePhoto}
            className="w-24 h-24 p-2 rounded-full border-4 border-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 transition-all"
          >
            <div className="w-full h-full rounded-full bg-white/90 backdrop-blur-sm" />
          </button>
        </div>
      </div>
    </div>
  );
}
