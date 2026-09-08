"use client";

import React from "react";
import { Phone, PhoneOff } from "lucide-react";
import { VolumeRing } from "./VolumeRing";

interface IncomingCallScreenProps {
  partnerName: string;
  partnerInitials: string;
  isVideo: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallScreen: React.FC<IncomingCallScreenProps> = ({
  partnerName,
  partnerInitials,
  isVideo,
  onAccept,
  onDecline,
}) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-300">
    <div className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden shadow-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#6366f140,_transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center gap-6 p-8">
        <span className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-semibold tracking-widest uppercase">
          {isVideo ? "📹 Incoming Video" : "📞 Incoming Call"}
        </span>

        {/* Avatar with ring pulse */}
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          <VolumeRing volume={0.35} color="#818cf8" size={120} rings={2} />
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-xl z-10 border-4 border-white/20">
            {partnerInitials}
          </div>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-white">{partnerName}</h2>
          <p className="text-white/50 text-sm animate-pulse">Calling you…</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-10 mt-2">
          <button onClick={onDecline} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-90 transition-all flex items-center justify-center shadow-lg shadow-red-500/40">
              <PhoneOff className="w-7 h-7 text-white" />
            </div>
            <span className="text-white/60 text-xs font-medium">Decline</span>
          </button>

          <button onClick={onAccept} className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 transition-all flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-bounce">
              <Phone className="w-7 h-7 text-white" />
            </div>
            <span className="text-white/60 text-xs font-medium">Accept</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);
