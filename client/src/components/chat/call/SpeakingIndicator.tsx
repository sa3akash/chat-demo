"use client";

import React from "react";

interface SpeakingIndicatorProps {
  speaking: boolean;
  variant?: "dots" | "bars" | "wave";
  color?: string;
}

/**
 * Animated speaking indicator — dots, bars, or wave style.
 * Only renders when `speaking` is true.
 */
export const SpeakingIndicator: React.FC<SpeakingIndicatorProps> = ({
  speaking,
  variant = "bars",
  color = "#34d399",
}) => {
  if (!speaking) return null;

  if (variant === "dots") {
    return (
      <span className="inline-flex items-center gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full"
            style={{
              backgroundColor: color,
              animation: `speakDot 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
            }}
          />
        ))}
      </span>
    );
  }

  if (variant === "wave") {
    return (
      <span className="inline-flex items-end gap-px h-4">
        {[3, 5, 7, 5, 3].map((h, i) => (
          <span
            key={i}
            className="w-0.5 rounded-full"
            style={{
              height: `${h}px`,
              backgroundColor: color,
              animation: `speakWave 0.7s ease-in-out ${i * 0.08}s infinite alternate`,
            }}
          />
        ))}
      </span>
    );
  }

  // bars (default)
  return (
    <span className="inline-flex items-end gap-px h-4">
      {[4, 7, 10, 7, 4].map((h, i) => (
        <span
          key={i}
          className="w-0.75 rounded-full"
          style={{
            height: `${h}px`,
            backgroundColor: color,
            animation: `speakBar 0.55s ease-in-out ${i * 0.09}s infinite alternate`,
            transformOrigin: "bottom",
          }}
        />
      ))}
    </span>
  );
};

/** Inject required keyframes once — include in your root layout or top-level component. */
export const SpeakingKeyframes = () => (
  <style>{`
    @keyframes speakBar {
      from { transform: scaleY(0.25); opacity: 0.6; }
      to   { transform: scaleY(1);    opacity: 1; }
    }
    @keyframes speakDot {
      from { transform: scale(0.5); opacity: 0.5; }
      to   { transform: scale(1.2); opacity: 1; }
    }
    @keyframes speakWave {
      from { transform: scaleY(0.4); opacity: 0.5; }
      to   { transform: scaleY(1.6); opacity: 1; }
    }
  `}</style>
);
