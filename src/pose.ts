// Riconoscimento della postura con MediaPipe, interamente nel browser.

import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { P2, P3 } from './metrics';

const BASE = import.meta.env.BASE_URL;
let landmarker: PoseLandmarker | null = null;

export async function loadPose(): Promise<PoseLandmarker> {
  if (landmarker) return landmarker;
  const fileset = await FilesetResolver.forVisionTasks(`${BASE}wasm`);
  const make = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${BASE}models/pose_landmarker_full.task`, delegate },
      runningMode: 'IMAGE',
      numPoses: 1,
      minPoseDetectionConfidence: 0.3,
      minPosePresenceConfidence: 0.3,
    });
  try {
    landmarker = await make('GPU');
  } catch {
    landmarker = await make('CPU');
  }
  return landmarker;
}

export type Box = { x0: number; y0: number; x1: number; y1: number };
export type Pose = { pts: P2[]; world: P3[] };

const crop = document.createElement('canvas');

/** Cerca la postura dentro un riquadro del fotogramma, ingrandito a `size` pixel. */
export function detectIn(src: CanvasImageSource, w: number, h: number, box: Box, size = 384): Pose | null {
  const x0 = Math.max(0, Math.floor(box.x0)), y0 = Math.max(0, Math.floor(box.y0));
  const x1 = Math.min(w, Math.ceil(box.x1)), y1 = Math.min(h, Math.ceil(box.y1));
  const bw = x1 - x0, bh = y1 - y0;
  if (bw < 8 || bh < 8) return null;
  const s = size / Math.max(bw, bh);
  crop.width = Math.round(bw * s); crop.height = Math.round(bh * s);
  const ctx = crop.getContext('2d')!;
  ctx.drawImage(src, x0, y0, bw, bh, 0, 0, crop.width, crop.height);
  const r = landmarker!.detect(crop);
  if (!r.landmarks.length) return null;
  const pts = r.landmarks[0].map((p) => ({ x: x0 + p.x * bw, y: y0 + p.y * bh, v: p.visibility ?? 0 }));
  const world = r.worldLandmarks[0].map((p) => ({ x: p.x, y: p.y, z: p.z }));
  return { pts, world };
}

export function bodyBox(pts: P2[]): { cx: number; cy: number; size: number } {
  const body = pts.slice(11, 29);
  const xs = body.map((p) => p.x), ys = body.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, size: Math.max(x1 - x0, y1 - y0) };
}

export const EDGES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
];
