import { useEffect, useCallback } from 'react';

interface MilestoneCelebrationProps {
  milestone: number;
  message: string;
  onDismiss: () => void;
}

const EMOJIS = ['🎉', '🏆', '🔥', '⭐', '🎊', '💪', '🚀', '✨'];

function playCelebrationSound(milestone: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;

    // Celebration chord progression — higher milestone = bigger fanfare
    const notes = milestone >= 500
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5] // C5-E5-G5-C6-E6 (big fanfare)
      : [523.25, 659.25, 783.99, 1046.5];          // C5-E5-G5-C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      const startTime = now + i * 0.12;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);

      osc.start(startTime);
      osc.stop(startTime + 0.8);
    });

    // Add a shimmer sweep for the 500 milestone
    if (milestone >= 500) {
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.connect(shimmerGain);
      shimmerGain.connect(ctx.destination);
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(800, now + 0.5);
      shimmer.frequency.linearRampToValueAtTime(2000, now + 1.2);
      shimmerGain.gain.setValueAtTime(0, now + 0.5);
      shimmerGain.gain.linearRampToValueAtTime(0.08, now + 0.6);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      shimmer.start(now + 0.5);
      shimmer.stop(now + 1.3);
    }

    // Clean up context after sounds finish
    setTimeout(() => ctx.close(), 2000);
  } catch (e) {
    console.warn('Could not play celebration sound:', e);
  }
}

export function MilestoneCelebration({ milestone, message, onDismiss }: MilestoneCelebrationProps) {
  const playSound = useCallback(() => {
    playCelebrationSound(milestone);
  }, [milestone]);

  useEffect(() => {
    playSound();
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss, playSound]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-pointer"
      onClick={onDismiss}
    >
      {/* Floating emoji particles */}
      {EMOJIS.map((emoji, i) => (
        <span
          key={i}
          className="absolute text-4xl animate-[float-particle_3s_ease-out_forwards] pointer-events-none"
          style={{
            left: `${10 + (i * 11)}%`,
            top: `${60 + (i % 3) * 10}%`,
            animationDelay: `${i * 0.15}s`,
          }}
        >
          {emoji}
        </span>
      ))}

      {/* Main celebration card */}
      <div className="animate-[celebration-pop_0.5s_ease-out_forwards] text-center p-8 rounded-2xl bg-card border-2 border-primary shadow-2xl max-w-sm mx-4">
        <div className="text-6xl mb-4">
          {milestone >= 500 ? '🏆' : '🔥'}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Milestone!
        </h2>
        <p className="text-xl text-muted-foreground whitespace-pre-line">
          {message}
        </p>
        <p className="text-sm text-muted-foreground mt-4">
          Tap to dismiss
        </p>
      </div>
    </div>
  );
}
