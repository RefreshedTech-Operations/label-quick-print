import { useEffect } from 'react';

interface MilestoneCelebrationProps {
  milestone: number;
  message: string;
  onDismiss: () => void;
}

const EMOJIS = ['🎉', '🏆', '🔥', '⭐', '🎊', '💪', '🚀', '✨'];

export function MilestoneCelebration({ milestone, message, onDismiss }: MilestoneCelebrationProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

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
