// Copia i file WebAssembly di MediaPipe in public/wasm, così il sito non dipende da CDN esterni.
import { cpSync, mkdirSync } from 'node:fs';
mkdirSync('public/wasm', { recursive: true });
cpSync('node_modules/@mediapipe/tasks-vision/wasm', 'public/wasm', { recursive: true });
