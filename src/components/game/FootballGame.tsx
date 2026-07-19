"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  createInitialMatchState,
  stepMatch,
  difficultyFromLevel,
  FIELD_W,
  FIELD_H,
  GOAL_WIDTH,
  type MatchState,
  type Direction,
  type MatchInput,
} from "@/lib/game-engine";
import {
  startStadiumMusic,
  stopStadiumMusic,
  setStadiumMusicMuted,
  isStadiumMusicMuted,
} from "@/lib/stadium-music";

type Props = {
  levelNumber: number;
  matchDurationSec: number;
  onFinish: (result: {
    goalsScored: number;
    goalsConceded: number;
    durationMs: number;
    shotsAttempted: number;
  }) => void;
};

export default function FootballGame({ levelNumber, matchDurationSec, onFinish }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<MatchState>(createInitialMatchState(matchDurationSec));
  const inputRef = useRef<MatchInput>({
    direction: null,
    dribble: false,
    tackle: false,
    shoot: false,
    pass: false,
    switchLeader: false,
  });
  const [display, setDisplay] = useState({
    goalsHome: 0,
    goalsAway: 0,
    secondsLeft: matchDurationSec,
  });
  const finishedRef = useRef(false);
  const difficulty = difficultyFromLevel(levelNumber);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  function togglePause() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) {
      stopStadiumMusic();
    } else {
      startStadiumMusic();
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setStadiumMusicMuted(next);
  }

  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const s = stateRef.current;
    onFinish({
      goalsScored: s.goalsHome,
      goalsConceded: s.goalsAway,
      durationMs: matchDurationSec * 1000,
      shotsAttempted: s.shotsAttempted,
    });
  }, [matchDurationSec, onFinish]);

  useEffect(() => {
    setStadiumMusicMuted(isStadiumMusicMuted());
    startStadiumMusic();
    return () => stopStadiumMusic();
  }, []);

  useEffect(() => {
    let raf: number;
    let last = performance.now();

    function loop(now: number) {
      const dt = Math.min(now - last, 50); // évite les gros sauts si l'onglet était en pause
      last = now;

      if (pausedRef.current) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (!stateRef.current.finished) {
        stateRef.current = stepMatch(stateRef.current, inputRef.current, dt, difficulty);
        // Les boutons "tacle"/"tir"/"changer" sont des impulsions, pas des maintiens
        inputRef.current = {
          ...inputRef.current,
          tackle: false,
          shoot: false,
          pass: false,
          switchLeader: false,
        };
        setDisplay({
          goalsHome: stateRef.current.goalsHome,
          goalsAway: stateRef.current.goalsAway,
          secondsLeft: Math.ceil(stateRef.current.clockMs / 1000),
        });
        draw();
      } else if (!finishedRef.current) {
        handleFinish();
      }

      raf = requestAnimationFrame(loop);
    }

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const scaleX = W / FIELD_W;
      const scaleY = H / FIELD_H;
      const s = stateRef.current;

      // Terrain
      ctx.fillStyle = "#1a7a3a";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, W - 8, H - 8);
      ctx.beginPath();
      ctx.moveTo(W / 2, 4);
      ctx.lineTo(W / 2, H - 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 30, 0, Math.PI * 2);
      ctx.stroke();

      // Cages
      const goalTop = (FIELD_H / 2 - GOAL_WIDTH / 2) * scaleY;
      const goalH = GOAL_WIDTH * scaleY;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4;
      ctx.strokeRect(0, goalTop, 6, goalH);
      ctx.strokeRect(W - 6, goalTop, 6, goalH);

      // Joueurs équipe adverse
      for (const p of s.away) {
        drawPlayer(ctx, p.x * scaleX, p.y * scaleY, "#dc2626", false);
      }
      // Joueurs équipe du joueur
      for (const p of s.home) {
        drawPlayer(ctx, p.x * scaleX, p.y * scaleY, "#2563eb", p.isLeader);
      }

      // Ballon
      ctx.beginPath();
      ctx.fillStyle = "#ffffff";
      ctx.arc(s.ball.x * scaleX, s.ball.y * scaleY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    function drawPlayer(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      isLeader: boolean
    ) {
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      if (isLeader) {
        // Flèche indiquant le meneur
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.moveTo(x, y - 22);
        ctx.lineTo(x - 6, y - 12);
        ctx.lineTo(x + 6, y - 12);
        ctx.closePath();
        ctx.fill();
      }
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [difficulty, handleFinish]);

  function setDirection(dir: Direction) {
    inputRef.current = { ...inputRef.current, direction: dir };
  }
  function clearDirection() {
    inputRef.current = { ...inputRef.current, direction: null };
  }
  function setDribble(v: boolean) {
    inputRef.current = { ...inputRef.current, dribble: v };
  }
  function fireTackle() {
    inputRef.current = { ...inputRef.current, tackle: true };
  }
  function fireShoot() {
    inputRef.current = { ...inputRef.current, shoot: true };
  }
  function firePass() {
    inputRef.current = { ...inputRef.current, pass: true };
  }
  function fireSwitch() {
    inputRef.current = { ...inputRef.current, switchLeader: true };
  }

  const dirBtn = (dir: Direction, label: string, extraClass = "") => (
    <button
      className={`select-none bg-white/20 active:bg-white/40 text-white text-lg rounded-lg w-12 h-12 flex items-center justify-center ${extraClass}`}
      onPointerDown={(e) => {
        e.preventDefault();
        setDirection(dir);
      }}
      onPointerUp={clearDirection}
      onPointerLeave={clearDirection}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="flex items-center justify-between w-full max-w-md text-white px-2">
        <span className="font-bold">Niveau {levelNumber} / 32</span>
        <span className="text-lg font-mono">
          {display.goalsHome} - {display.goalsAway}
        </span>
        <span className="font-mono">{String(display.secondsLeft).padStart(2, "0")}s</span>
        <button
          onClick={toggleMute}
          className="text-lg ml-2"
          aria-label={muted ? "Activer le son" : "Couper le son"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button
          onClick={togglePause}
          className="text-lg ml-2"
          aria-label={paused ? "Reprendre" : "Mettre en pause"}
        >
          {paused ? "▶️" : "⏸️"}
        </button>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={340}
          height={210}
          className="rounded-xl border-2 border-white/30 max-w-full"
        />
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-xl">
            <button
              onClick={togglePause}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-3 rounded-full"
            >
              ▶️ Reprendre
            </button>
          </div>
        )}
      </div>

      <button
        onClick={fireSwitch}
        className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold text-sm px-4 py-1.5 rounded-full"
      >
        🔄 Changer de meneur
      </button>

      <div className="flex items-center justify-between w-full max-w-md px-2 mt-2">
        {/* D-pad */}
        <div className="grid grid-cols-3 gap-1">
          <div />
          {dirBtn("up", "↑")}
          <div />
          {dirBtn("left", "←")}
          <div />
          {dirBtn("right", "→")}
          <div />
          {dirBtn("down", "↓")}
          <div />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onPointerDown={() => setDribble(true)}
            onPointerUp={() => setDribble(false)}
            onPointerLeave={() => setDribble(false)}
            className="bg-blue-600 active:bg-blue-500 text-white text-xs font-semibold rounded-lg w-16 h-12"
          >
            Dribble
          </button>
          <button
            onClick={fireTackle}
            className="bg-orange-600 active:bg-orange-500 text-white text-xs font-semibold rounded-lg w-16 h-12"
          >
            Tacle
          </button>
          <button
            onClick={firePass}
            className="bg-green-600 active:bg-green-500 text-white text-xs font-semibold rounded-lg w-16 h-12"
          >
            Passe
          </button>
          <button
            onClick={fireShoot}
            className="bg-red-600 active:bg-red-500 text-white text-sm font-bold rounded-lg w-16 h-12"
          >
            ⚽ Tir
          </button>
        </div>
      </div>
    </div>
  );
}
