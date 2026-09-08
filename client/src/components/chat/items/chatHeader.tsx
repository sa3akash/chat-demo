"use client";

import React, { useEffect, useState } from "react";
import { getOthersUser } from "@/actions/conversation";
import {
  InfoIcon,
  PhoneIcon,
  VideoIcon,
  ArrowLeft,
  Search,
  X,
  Bell,
  BellOff,
} from "lucide-react";
import { useSocket } from "@/context/SocketContext";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ChatHeaderParams {
  conversationId: string;
  onBack?: () => void;
}

interface OtherUserData {
  id?: string;
  username: string;
  email: string;
}

const ChatHeader: React.FC<ChatHeaderParams> = ({ conversationId, onBack }) => {
  const [otherUser, setOtherUser] = useState<OtherUserData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [showCallModal, setShowCallModal] = useState<"voice" | "video" | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const { isUserOnline, checkPresence } = useSocket();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getOthersUser(conversationId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setOtherUser(res.data);
          if (res.data.id) {
            checkPresence([res.data.id]);
          }
        } else {
          setError(res.error || "Failed to load chat details");
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || "Failed to load chat details");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [conversationId, checkPresence]);

  const isOnline = otherUser?.id ? isUserOnline(otherUser.id) : false;

  if (loading) {
    return (
      <div className="border-b p-3 px-4 bg-card/60 backdrop-blur flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-muted"></div>
          <div className="space-y-1.5">
            <div className="w-28 h-4 rounded bg-muted"></div>
            <div className="w-16 h-3 rounded bg-muted"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !otherUser) {
    return (
      <div className="border-b p-3.5 px-4 bg-card/60 backdrop-blur flex items-center justify-between text-sm text-destructive">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button onClick={onBack} className="p-1 hover:bg-muted rounded-lg">
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <Link href="/chat" className="p-1 hover:bg-muted rounded-lg md:hidden">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <span>{error || "Conversation info unavailable"}</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b p-3 px-4 bg-card/85 backdrop-blur shadow-xs flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="p-1.5 -ml-1 hover:bg-muted rounded-lg md:hidden text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <Link
              href="/chat"
              className="p-1.5 -ml-1 hover:bg-muted rounded-lg md:hidden text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}

          {/* User Avatar + Status */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setShowInfoDialog(true)}
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shadow-xs group-hover:scale-105 transition-transform">
                {otherUser.username.slice(0, 2).toUpperCase()}
              </div>
              <span
                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background transition-colors ${
                  isOnline ? "bg-emerald-500 ring-2 ring-emerald-500/20" : "bg-muted-foreground/40"
                }`}
              />
            </div>

            <div>
              <p className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors">
                {otherUser.username}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                  }`}
                />
                <p className="text-xs text-muted-foreground font-medium">
                  {isOnline ? "Active now" : "Offline"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <button
            type="button"
            onClick={() => setShowCallModal("voice")}
            className="p-2 rounded-xl hover:bg-muted/80 hover:text-foreground transition-colors"
            title="Start Audio Call"
          >
            <PhoneIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowCallModal("video")}
            className="p-2 rounded-xl hover:bg-muted/80 hover:text-foreground transition-colors"
            title="Start Video Call"
          >
            <VideoIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowInfoDialog(true)}
            className="p-2 rounded-xl hover:bg-muted/80 hover:text-foreground transition-colors"
            title="Conversation Details"
          >
            <InfoIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conversation Info Sheet / Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chat Details</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col items-center p-4 gap-3 text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-2xl shadow-sm">
                {otherUser.username.slice(0, 2).toUpperCase()}
              </div>
              <span
                className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-background ${
                  isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                }`}
              />
            </div>

            <div>
              <h3 className="text-lg font-bold text-foreground">{otherUser.username}</h3>
              <p className="text-xs text-muted-foreground">{otherUser.email}</p>
            </div>

            <div className="flex gap-2 mt-2 w-full">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowInfoDialog(false);
                  setShowCallModal("voice");
                }}
              >
                <PhoneIcon className="w-4 h-4 mr-2 text-emerald-500" />
                Call
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setShowInfoDialog(false);
                  setShowCallModal("video");
                }}
              >
                <VideoIcon className="w-4 h-4 mr-2 text-sky-500" />
                Video
              </Button>
            </div>

            <div className="w-full border-t border-border/60 pt-3 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-semibold ${isOnline ? "text-emerald-500" : "text-muted-foreground"}`}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Notifications</span>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="flex items-center gap-1 text-primary hover:underline font-medium"
                >
                  {isMuted ? (
                    <>
                      <BellOff className="w-3.5 h-3.5" /> Muted
                    </>
                  ) : (
                    <>
                      <Bell className="w-3.5 h-3.5" /> Unmuted
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calling Simulation Modal */}
      {showCallModal && (
        <Dialog open={Boolean(showCallModal)} onOpenChange={() => setShowCallModal(null)}>
          <DialogContent className="sm:max-w-sm text-center p-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold animate-pulse">
                {showCallModal === "video" ? (
                  <VideoIcon className="w-8 h-8" />
                ) : (
                  <PhoneIcon className="w-8 h-8" />
                )}
              </div>
              <div>
                <h4 className="font-bold text-base">Calling {otherUser.username}...</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Connecting {showCallModal} session
                </p>
              </div>
              <Button
                variant="destructive"
                className="rounded-full px-6 mt-2"
                onClick={() => setShowCallModal(null)}
              >
                End Call
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default ChatHeader;
