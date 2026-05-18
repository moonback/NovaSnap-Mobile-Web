/**
 * FaceFilterOverlay — Renders real-time face filters on a transparent canvas
 * positioned over the live camera feed.
 *
 * Supported filters:
 *   - none:    No overlay
 *   - beauty:  Soft glow around detected face
 *   - bw:      Grayscale via CSS filter (applied on parent)
 *   - vintage: Sepia warm tone via CSS filter
 *   - neon:    Saturated + hue-rotated via CSS filter
 *   - dog:     Cartoon dog ears + nose drawn from landmarks
 *   - glasses: Reflective sunglasses drawn from eye landmarks
 *   - crown:   Golden crown drawn from forehead landmarks
 *   - hearts:  Floating heart-eyes effect
 */
import React, { useRef, useEffect, useCallback } from 'react';
import type { FaceLandmarks } from '../../hooks/useFaceDetection';

export type FilterType =
  | 'none'
  | 'beauty'
  | 'bw'
  | 'vintage'
  | 'neon'
  | 'dog'
  | 'glasses'
  | 'crown'
  | 'hearts';

interface FaceFilterOverlayProps {
  faces: FaceLandmarks[];
  filter: FilterType;
  /** The container width (px). */
  width: number;
  /** The container height (px). */
  height: number;
  /** Whether the camera is mirrored (front-facing). */
  mirrored?: boolean;
}

// MediaPipe face landmark indices for key points
const NOSE_TIP = 1;
const LEFT_EYE_CENTER = 468; // fallback to 159 if no iris
const RIGHT_EYE_CENTER = 473; // fallback to 386 if no iris
const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const RIGHT_EYE_OUTER = 263;
const RIGHT_EYE_INNER = 362;
const LEFT_EAR_TOP = 127;
const RIGHT_EAR_TOP = 356;
const FOREHEAD_CENTER = 10;
const FOREHEAD_LEFT = 67;
const FOREHEAD_RIGHT = 297;
const CHIN = 152;
const LEFT_CHEEK = 234;
const RIGHT_CHEEK = 454;

function getLandmark(face: FaceLandmarks, idx: number, fallback?: number) {
  return face[idx] ?? (fallback !== undefined ? face[fallback] : undefined);
}

export default function FaceFilterOverlay({
  faces,
  filter,
  width,
  height,
  mirrored = false,
}: FaceFilterOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);

    if (filter === 'none' || faces.length === 0) return;

    // Mirror transform if front camera
    if (mirrored) {
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    for (const face of faces) {
      if (face.length < 400) continue; // Need full 468 landmarks

      const toX = (idx: number) => (face[idx]?.x ?? 0) * width;
      const toY = (idx: number) => (face[idx]?.y ?? 0) * height;

      // Face dimensions for scaling overlays
      const leftCheekX = toX(LEFT_CHEEK < face.length ? LEFT_CHEEK : 0);
      const rightCheekX = toX(RIGHT_CHEEK < face.length ? RIGHT_CHEEK : 0);
      const faceWidth = Math.abs(rightCheekX - leftCheekX);
      const foreheadY = toY(FOREHEAD_CENTER < face.length ? FOREHEAD_CENTER : 0);
      const chinY = toY(CHIN < face.length ? CHIN : 0);
      const faceHeight = Math.abs(chinY - foreheadY);

      switch (filter) {
        case 'beauty': {
          // Soft radial glow around face
          const cx = (leftCheekX + rightCheekX) / 2;
          const cy = (foreheadY + chinY) / 2;
          const r = Math.max(faceWidth, faceHeight) * 0.7;
          const grad = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
          grad.addColorStop(0, 'rgba(255, 220, 240, 0.12)');
          grad.addColorStop(0.5, 'rgba(255, 200, 220, 0.06)');
          grad.addColorStop(1, 'rgba(255, 180, 200, 0)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          // Sparkle dots along face contour
          const sparklePoints = [10, 67, 297, 103, 332, 54, 284];
          for (const idx of sparklePoints) {
            if (idx >= face.length) continue;
            const sx = toX(idx);
            const sy = toY(idx);
            const sparkleSize = faceWidth * 0.015 + Math.sin(Date.now() / 300 + idx) * 2;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(1, sparkleSize), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(Date.now() / 200 + idx * 0.5) * 0.3})`;
            ctx.fill();
          }
          break;
        }

        case 'dog': {
          // --- Dog nose ---
          const noseX = toX(NOSE_TIP);
          const noseY = toY(NOSE_TIP);
          const noseR = faceWidth * 0.12;

          // Black nose
          ctx.beginPath();
          ctx.ellipse(noseX, noseY, noseR, noseR * 0.75, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#1a1a1a';
          ctx.fill();
          // Nose shine
          ctx.beginPath();
          ctx.ellipse(noseX - noseR * 0.25, noseY - noseR * 0.2, noseR * 0.3, noseR * 0.2, -0.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fill();

          // --- Dog ears ---
          const earSize = faceWidth * 0.5;
          const leftEarX = toX(LEFT_EAR_TOP < face.length ? LEFT_EAR_TOP : 0);
          const leftEarY = toY(LEFT_EAR_TOP < face.length ? LEFT_EAR_TOP : 0);
          const rightEarX = toX(RIGHT_EAR_TOP < face.length ? RIGHT_EAR_TOP : 0);
          const rightEarY = toY(RIGHT_EAR_TOP < face.length ? RIGHT_EAR_TOP : 0);

          // Left ear
          ctx.save();
          ctx.translate(leftEarX - earSize * 0.15, leftEarY - earSize * 0.6);
          ctx.rotate(-0.3);
          ctx.beginPath();
          ctx.ellipse(0, 0, earSize * 0.3, earSize * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#8B6914';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(0, earSize * 0.05, earSize * 0.18, earSize * 0.38, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#D4A44C';
          ctx.fill();
          ctx.restore();

          // Right ear
          ctx.save();
          ctx.translate(rightEarX + earSize * 0.15, rightEarY - earSize * 0.6);
          ctx.rotate(0.3);
          ctx.beginPath();
          ctx.ellipse(0, 0, earSize * 0.3, earSize * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#8B6914';
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(0, earSize * 0.05, earSize * 0.18, earSize * 0.38, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#D4A44C';
          ctx.fill();
          ctx.restore();

          // --- Tongue ---
          const mouthY = toY(14); // Lower lip center
          const mouthX = toX(14);
          ctx.save();
          ctx.translate(mouthX, mouthY + faceWidth * 0.08);
          ctx.beginPath();
          ctx.ellipse(0, faceWidth * 0.06, faceWidth * 0.08, faceWidth * 0.12, 0, 0, Math.PI);
          ctx.fillStyle = '#FF6B8A';
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, faceWidth * 0.14);
          ctx.strokeStyle = '#E85577';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();
          break;
        }

        case 'glasses': {
          // Stylish aviator sunglasses
          const leftEyeX = toX(LEFT_EYE_OUTER < face.length ? LEFT_EYE_OUTER : 0);
          const leftEyeInnerX = toX(LEFT_EYE_INNER < face.length ? LEFT_EYE_INNER : 0);
          const rightEyeX = toX(RIGHT_EYE_OUTER < face.length ? RIGHT_EYE_OUTER : 0);
          const rightEyeInnerX = toX(RIGHT_EYE_INNER < face.length ? RIGHT_EYE_INNER : 0);
          const leftEyeY = toY(159); // Upper eyelid
          const rightEyeY = toY(386);
          const lensW = faceWidth * 0.3;
          const lensH = faceHeight * 0.22;

          // Frame
          ctx.lineWidth = faceWidth * 0.02;
          ctx.strokeStyle = '#1a1a1a';
          ctx.fillStyle = 'rgba(20, 20, 40, 0.75)';

          // Left lens
          const lLensCx = (leftEyeX + leftEyeInnerX) / 2;
          const lLensCy = leftEyeY + lensH * 0.15;
          ctx.beginPath();
          ctx.ellipse(lLensCx, lLensCy, lensW, lensH, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Lens gradient reflection
          const lGrad = ctx.createLinearGradient(lLensCx - lensW, lLensCy - lensH, lLensCx + lensW, lLensCy + lensH);
          lGrad.addColorStop(0, 'rgba(100, 200, 255, 0.15)');
          lGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
          lGrad.addColorStop(1, 'rgba(180, 100, 255, 0.1)');
          ctx.fillStyle = lGrad;
          ctx.beginPath();
          ctx.ellipse(lLensCx, lLensCy, lensW, lensH, 0, 0, Math.PI * 2);
          ctx.fill();

          // Right lens
          const rLensCx = (rightEyeX + rightEyeInnerX) / 2;
          const rLensCy = rightEyeY + lensH * 0.15;
          ctx.fillStyle = 'rgba(20, 20, 40, 0.75)';
          ctx.beginPath();
          ctx.ellipse(rLensCx, rLensCy, lensW, lensH, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Right lens reflection
          const rGrad = ctx.createLinearGradient(rLensCx - lensW, rLensCy - lensH, rLensCx + lensW, rLensCy + lensH);
          rGrad.addColorStop(0, 'rgba(100, 200, 255, 0.15)');
          rGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
          rGrad.addColorStop(1, 'rgba(180, 100, 255, 0.1)');
          ctx.fillStyle = rGrad;
          ctx.beginPath();
          ctx.ellipse(rLensCx, rLensCy, lensW, lensH, 0, 0, Math.PI * 2);
          ctx.fill();

          // Bridge
          ctx.beginPath();
          ctx.moveTo(lLensCx + lensW * 0.8, lLensCy - lensH * 0.1);
          ctx.quadraticCurveTo(
            (lLensCx + rLensCx) / 2,
            lLensCy - lensH * 0.3,
            rLensCx - lensW * 0.8,
            rLensCy - lensH * 0.1
          );
          ctx.strokeStyle = '#1a1a1a';
          ctx.lineWidth = faceWidth * 0.018;
          ctx.stroke();

          // Temple arms (sides)
          ctx.beginPath();
          ctx.moveTo(leftEyeX - lensW * 0.15, lLensCy);
          ctx.lineTo(leftEyeX - faceWidth * 0.15, lLensCy + lensH * 0.3);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(rightEyeX + lensW * 0.15, rLensCy);
          ctx.lineTo(rightEyeX + faceWidth * 0.15, rLensCy + lensH * 0.3);
          ctx.stroke();
          break;
        }

        case 'crown': {
          // Golden crown on forehead
          const fhX = toX(FOREHEAD_CENTER < face.length ? FOREHEAD_CENTER : 0);
          const fhY = toY(FOREHEAD_CENTER < face.length ? FOREHEAD_CENTER : 0);
          const crownW = faceWidth * 0.65;
          const crownH = faceHeight * 0.3;
          const baseY = fhY - crownH * 0.2;

          ctx.save();
          ctx.translate(fhX, baseY);

          // Crown body
          ctx.beginPath();
          ctx.moveTo(-crownW / 2, 0);
          ctx.lineTo(-crownW / 2 - crownW * 0.05, -crownH * 0.3);
          ctx.lineTo(-crownW * 0.3, -crownH * 0.7);
          ctx.lineTo(-crownW * 0.15, -crownH * 0.35);
          ctx.lineTo(0, -crownH);
          ctx.lineTo(crownW * 0.15, -crownH * 0.35);
          ctx.lineTo(crownW * 0.3, -crownH * 0.7);
          ctx.lineTo(crownW / 2 + crownW * 0.05, -crownH * 0.3);
          ctx.lineTo(crownW / 2, 0);
          ctx.closePath();

          // Gold gradient
          const goldGrad = ctx.createLinearGradient(0, 0, 0, -crownH);
          goldGrad.addColorStop(0, '#C8960C');
          goldGrad.addColorStop(0.4, '#FFD700');
          goldGrad.addColorStop(0.8, '#FFF380');
          goldGrad.addColorStop(1, '#FFD700');
          ctx.fillStyle = goldGrad;
          ctx.fill();
          ctx.strokeStyle = '#A07800';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Jewels on tips
          const jewels = [
            { x: -crownW * 0.3, y: -crownH * 0.7, color: '#FF3366' },
            { x: 0, y: -crownH, color: '#3366FF' },
            { x: crownW * 0.3, y: -crownH * 0.7, color: '#33CC66' },
          ];
          for (const j of jewels) {
            const pulse = 1 + Math.sin(Date.now() / 400 + j.x) * 0.15;
            const jR = crownW * 0.04 * pulse;
            ctx.beginPath();
            ctx.arc(j.x, j.y + crownH * 0.05, jR, 0, Math.PI * 2);
            ctx.fillStyle = j.color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Base band
          ctx.beginPath();
          ctx.rect(-crownW / 2 - crownW * 0.02, -crownH * 0.05, crownW + crownW * 0.04, crownH * 0.12);
          ctx.fillStyle = '#B8860B';
          ctx.fill();
          ctx.strokeStyle = '#8B6914';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.restore();
          break;
        }

        case 'hearts': {
          // Heart-eyes effect: two hearts over the eyes + floating mini hearts
          const leftEyeCx = toX(159);
          const leftEyeCy = toY(159);
          const rightEyeCx = toX(386);
          const rightEyeCy = toY(386);
          const heartSize = faceWidth * 0.14;

          const drawHeart = (cx: number, cy: number, size: number, color: string, alpha: number) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.moveTo(0, size * 0.3);
            ctx.bezierCurveTo(-size * 0.5, -size * 0.3, -size, size * 0.1, 0, size);
            ctx.bezierCurveTo(size, size * 0.1, size * 0.5, -size * 0.3, 0, size * 0.3);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
          };

          // Eyes hearts
          drawHeart(leftEyeCx, leftEyeCy - heartSize * 0.3, heartSize, '#FF1744', 0.9);
          drawHeart(rightEyeCx, rightEyeCy - heartSize * 0.3, heartSize, '#FF1744', 0.9);

          // Floating hearts around face
          const t = Date.now() / 1000;
          for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + t * 0.5;
            const dist = faceWidth * 0.6 + Math.sin(t * 2 + i) * faceWidth * 0.1;
            const fx = (leftCheekX + rightCheekX) / 2 + Math.cos(angle) * dist;
            const fy = (foreheadY + chinY) / 2 + Math.sin(angle) * dist * 0.7;
            const miniSize = heartSize * (0.3 + Math.sin(t * 3 + i * 1.5) * 0.1);
            const alpha = 0.5 + Math.sin(t * 2 + i) * 0.3;
            drawHeart(fx, fy, miniSize, i % 2 === 0 ? '#FF4081' : '#FF1744', alpha);
          }
          break;
        }

        // bw, vintage, neon are CSS-only — nothing to draw on the overlay canvas.
        default:
          break;
      }
    }

    if (mirrored) {
      ctx.restore();
    }
  }, [faces, filter, width, height, mirrored]);

  // Redraw every frame for animated filters.
  useEffect(() => {
    if (filter === 'none' || filter === 'bw' || filter === 'vintage' || filter === 'neon') {
      // These filters don't need canvas animation
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw, filter]);

  // For non-animated overlays (static draw when faces change)
  useEffect(() => {
    if (filter === 'beauty' || filter === 'dog' || filter === 'glasses' || filter === 'crown' || filter === 'hearts') {
      return; // Handled by the animation loop above
    }
    draw();
  }, [draw, filter]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ width, height }}
    />
  );
}

/** Returns the CSS filter string for color-based filters. */
export function getCSSFilter(filter: FilterType): string {
  switch (filter) {
    case 'bw':
      return 'grayscale(100%) contrast(1.1)';
    case 'vintage':
      return 'sepia(60%) contrast(1.05) brightness(1.05) saturate(1.2)';
    case 'neon':
      return 'saturate(2.5) contrast(1.3) brightness(1.1) hue-rotate(10deg)';
    default:
      return 'none';
  }
}
