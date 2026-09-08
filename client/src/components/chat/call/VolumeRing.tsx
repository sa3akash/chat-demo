"use client";

import React from "react";

interface VolumeRingProps {
  volume: number; // 0..1
  color?: string;
  size?: number;
  rings?: number;
  active?: boolean;
}

/**
 * Animated concentric rings that breathe with the volume level.
 * Renders as an absolute-positioned overlay — wrap in a relative container.
 */
export const VolumeRing: React.FC<VolumeRingProps> = ({
  volume,
  color = "#6366f1",
  size = 128,
  rings = 3,
  active = true,
}) => {
  if (!active) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {Array.from({ length: rings }).map((_, i) => {
        const delay = i * 0.1;
        const clampedVol = Math.min(Math.max(volume, 0), 1);
        const scale = 1 + clampedVol * (0.2 + i * 0.25);
        const opacity = Math.max(0, clampedVol * 0.8 - i * 0.18) + 0.03;
        const hexOpacity = Math.round(opacity * 255)
          .toString(16)
          .padStart(2, "0");
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: `radial-gradient(circle, ${color}28 0%, ${color}06 100%)`,
              border: `1.5px solid ${color}${hexOpacity}`,
              transform: `scale(${scale})`,
              transition: `transform 80ms ease-out ${delay}s, opacity 80ms ease-out ${delay}s`,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};
