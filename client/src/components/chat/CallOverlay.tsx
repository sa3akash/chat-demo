"use client";

import React, { useEffect, useRef } from "react";
import { useCall } from "@/context/CallContext";
import {
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  VideoOff,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const CallOverlay: React.FC = () => {
  const {
    callState,
    callType,
    partner,
    callDuration,
    isMicMuted,
    isCameraOff,
    localStream,
    remoteStream,
    acceptCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Bind local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  // Bind remote stream
  useEffect(() => {
    if (remoteStream) {
      if (callType === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, callType, callState]);

  if (callState === "idle") return null;

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const partnerInitials = (partner?.name || "U").slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Hidden remote audio element for audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="relative w-full max-w-lg bg-card/95 border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col items-center justify-between p-8 min-h-[460px]">
        {/* Call Header */}
        <div className="text-center z-10 space-y-1.5">
          <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-semibold tracking-wide uppercase">
            {callType === "video" ? "Video Call" : "Voice Call"}
          </span>
          <h2 className="text-2xl font-bold text-foreground mt-2">
            {partner?.name || "User"}
          </h2>
          <p className="text-xs font-medium text-muted-foreground">
            {callState === "incoming" && "Incoming call..."}
            {callState === "outgoing" && "Ringing..."}
            {callState === "connected" && formatDuration(callDuration)}
          </p>
        </div>

        {/* Center Visual / Video Area */}
        <div className="relative my-auto flex items-center justify-center w-full">
          {callType === "video" && callState === "connected" ? (
            /* Video Streaming View */
            <div className="relative w-full h-72 rounded-2xl overflow-hidden bg-black/80 flex items-center justify-center shadow-inner">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Local PiP Video */}
              <div className="absolute bottom-3 right-3 w-24 h-32 rounded-xl overflow-hidden border-2 border-background shadow-lg bg-muted">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ) : (
            /* Audio Avatar Pulse View */
            <div className="relative flex items-center justify-center my-6">
              <div className="absolute w-36 h-36 rounded-full bg-primary/10 animate-ping" />
              <div className="absolute w-48 h-48 rounded-full bg-primary/5 animate-pulse" />
              <div className="w-28 h-28 rounded-full bg-primary/15 border-4 border-primary/30 flex items-center justify-center text-primary font-bold text-3xl shadow-xl z-10">
                {partnerInitials}
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="w-full pt-6 flex items-center justify-center gap-4 z-10">
          {callState === "incoming" ? (
            /* Incoming Call Controls */
            <div className="flex items-center gap-8 animate-in zoom-in-95">
              <Button
                type="button"
                variant="destructive"
                onClick={rejectCall}
                size="icon"
                className="w-14 h-14 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-transform"
                title="Decline"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>

              <Button
                type="button"
                onClick={acceptCall}
                size="icon"
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-transform"
                title="Accept"
              >
                <Phone className="w-6 h-6" />
              </Button>
            </div>
          ) : (
            /* Outgoing or Connected Call Controls */
            <div className="flex items-center gap-3">
              {callState === "connected" && (
                <>
                  {/* Mic Toggle */}
                  <Button
                    type="button"
                    variant={isMicMuted ? "destructive" : "secondary"}
                    size="icon"
                    onClick={toggleMic}
                    className="w-12 h-12 rounded-full shadow-md"
                    title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                  >
                    {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </Button>

                  {/* Camera Toggle */}
                  {callType === "video" && (
                    <Button
                      type="button"
                      variant={isCameraOff ? "destructive" : "secondary"}
                      size="icon"
                      onClick={toggleCamera}
                      className="w-12 h-12 rounded-full shadow-md"
                      title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
                    >
                      {isCameraOff ? (
                        <VideoOff className="w-5 h-5" />
                      ) : (
                        <Video className="w-5 h-5" />
                      )}
                    </Button>
                  )}
                </>
              )}

              {/* End / Cancel Call Button */}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={endCall}
                className="w-14 h-14 rounded-full shadow-xl hover:scale-105 active:scale-95 transition-transform"
                title="End Call"
              >
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
