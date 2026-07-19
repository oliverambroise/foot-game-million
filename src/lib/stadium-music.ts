"use client";

/**
 * Petite musique de stade générée procéduralement (basse + mélodie légère
 * en boucle) via Web Audio. Aucun fichier audio n'est chargé: tout est
 * synthétisé dans le navigateur, ce qui évite tout problème de droits
 * d'auteur et garde le jeu léger.
 */

let audioCtx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let timerId: ReturnType<typeof setTimeout> | null = null;
let stepIndex = 0;
let muted = false;

const BPM = 128;
const STEP_SEC = 60 / BPM / 2; // croches

// Motif de basse (notes en Hz), boucle de 8 pas — ambiance énergique simple
const BASS_PATTERN = [98, 98, 110, 98, 123.47, 98, 110, 92.5];
// Petite mélodie clochette par-dessus, une fois toutes les 2 basses
const LEAD_PATTERN = [523.25, 0, 659.25, 0, 587.33, 0, 493.88, 0];

function playNote(freq: number, time: number, duration: number, type: OscillatorType, volume: number) {
  if (!audioCtx || !musicGain || freq <= 0) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
  osc.connect(gain);
  gain.connect(musicGain);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function scheduleLoop() {
  if (!audioCtx || muted) return;
  const now = audioCtx.currentTime;
  playNote(BASS_PATTERN[stepIndex % BASS_PATTERN.length], now, STEP_SEC * 0.9, "triangle", 0.16);
  const lead = LEAD_PATTERN[stepIndex % LEAD_PATTERN.length];
  if (lead > 0) playNote(lead, now, STEP_SEC * 0.5, "square", 0.05);
  stepIndex++;
  timerId = setTimeout(scheduleLoop, STEP_SEC * 1000);
}

export function startStadiumMusic() {
  if (typeof window === "undefined") return;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioCtx();
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.5;
    musicGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  if (timerId === null) scheduleLoop();
}

export function stopStadiumMusic() {
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

export function setStadiumMusicMuted(value: boolean) {
  muted = value;
  if (musicGain) musicGain.gain.value = value ? 0 : 0.5;
}

export function isStadiumMusicMuted() {
  return muted;
}
