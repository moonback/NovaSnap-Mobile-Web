/**
 * useFaceDetection — MediaPipe FaceLandmarker hook for real-time face detection.
 *
 * Uses @mediapipe/tasks-vision with WASM loaded from CDN to detect 468 face
 * landmarks per frame. Includes exponential moving average (EMA) smoothing
 * to eliminate jitter on overlays. The hook runs detection in a
 * requestAnimationFrame loop and exposes the smoothed landmarks plus a ready flag.
 */
import { useRef, useCallback, useEffect, useState } from 'react';
import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

export type FaceLandmarks = NormalizedLandmark[];

interface UseFaceDetectionOptions {
  /** Whether detection is enabled. Set false to save resources. */
  enabled: boolean;
  /** The live <video> element to read frames from. */
  videoElement: HTMLVideoElement | null;
  /** Max number of faces to detect (default 1). */
  maxFaces?: number;
  /** Smoothing factor 0-1. Higher = more smoothing, more latency. Default 0.6. */
  smoothing?: number;
}

interface UseFaceDetectionReturn {
  /** True once the WASM model has finished loading. */
  ready: boolean;
  /** Array of detected face landmark arrays (one per face), smoothed. */
  faces: FaceLandmarks[];
  /** Raw result from the last detection pass. */
  result: FaceLandmarkerResult | null;
}

const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

// Singleton: only load the model once across hot-reloads.
let sharedLandmarker: FaceLandmarker | null = null;
let loadingPromise: Promise<FaceLandmarker> | null = null;

async function getOrCreateLandmarker(maxFaces: number): Promise<FaceLandmarker> {
  if (sharedLandmarker) return sharedLandmarker;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    const landmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: maxFaces,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    });
    sharedLandmarker = landmarker;
    return landmarker;
  })();

  return loadingPromise;
}

/**
 * Exponential Moving Average smoothing per-landmark.
 * smoothedLandmarks[i] = alpha * rawLandmarks[i] + (1-alpha) * prevSmoothed[i]
 */
function smoothLandmarks(
  raw: FaceLandmarks[],
  prev: FaceLandmarks[],
  alpha: number,
): FaceLandmarks[] {
  return raw.map((face, fi) => {
    const prevFace = prev[fi];
    if (!prevFace || prevFace.length !== face.length) return face;

    return face.map((lm, li) => {
      const p = prevFace[li];
      if (!p) return lm;
      return {
        x: alpha * lm.x + (1 - alpha) * p.x,
        y: alpha * lm.y + (1 - alpha) * p.y,
        z: alpha * (lm.z ?? 0) + (1 - alpha) * (p.z ?? 0),
        visibility: lm.visibility,
      };
    });
  });
}

export function useFaceDetection({
  enabled,
  videoElement,
  maxFaces = 1,
  smoothing = 0.55,
}: UseFaceDetectionOptions): UseFaceDetectionReturn {
  const [ready, setReady] = useState(false);
  const [faces, setFaces] = useState<FaceLandmarks[]>([]);
  const [result, setResult] = useState<FaceLandmarkerResult | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(-1);
  const prevFacesRef = useRef<FaceLandmarks[]>([]);
  const alphaRef = useRef(1 - smoothing);

  useEffect(() => {
    alphaRef.current = 1 - smoothing;
  }, [smoothing]);

  // Load model on mount (if enabled).
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    getOrCreateLandmarker(maxFaces)
      .then((lm) => {
        if (cancelled) return;
        landmarkerRef.current = lm;
        setReady(true);
      })
      .catch((err) => {
        console.error('[FaceDetection] Model load failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, maxFaces]);

  // Detection loop.
  const detect = useCallback(() => {
    const video = videoElement;
    const lm = landmarkerRef.current;
    if (!video || !lm || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }

    const nowMs = performance.now();
    // MediaPipe requires strictly increasing timestamps.
    if (nowMs <= lastTimeRef.current) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }
    lastTimeRef.current = nowMs;

    try {
      const res = lm.detectForVideo(video, nowMs);
      const rawFaces = res.faceLandmarks ?? [];

      // Apply EMA smoothing to reduce jitter
      const smoothed = smoothLandmarks(rawFaces, prevFacesRef.current, alphaRef.current);
      prevFacesRef.current = smoothed;

      setFaces(smoothed);
      setResult(res);
    } catch {
      // Occasionally fails on first frames – ignore.
    }

    rafRef.current = requestAnimationFrame(detect);
  }, [videoElement]);

  useEffect(() => {
    if (!enabled || !ready || !videoElement) {
      setFaces([]);
      prevFacesRef.current = [];
      return;
    }
    lastTimeRef.current = -1;
    rafRef.current = requestAnimationFrame(detect);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, ready, videoElement, detect]);

  return { ready, faces, result };
}
