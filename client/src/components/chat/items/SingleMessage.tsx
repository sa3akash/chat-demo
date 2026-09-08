"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Check,
  CheckCheck,
  Clock,
  Reply,
  Copy,
  Trash2,
  Smile,
  Play,
  Pause,
  FileText,
  Download,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import { ChatMessageState } from "@/hooks/useChat";
import { WaveformPlayer } from "../WaveformPlayer";

const POPULAR_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

interface SingleMessageProps {
  message: ChatMessageState;
  user: "mine" | "other";
  currentUserId?: string;
  onReply?: (message: ChatMessageState) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onDelete?: (messageId: string) => void;
}

export const SingleMessage: React.FC<SingleMessageProps> = ({
  message,
  user,
  currentUserId,
  onReply,
  onReaction,
  onDelete,
}) => {
  const isMine = user === "mine";
  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [copied, setCopied] = useState(false);

  // Format time (e.g. "10:45 AM")
  const timeStr = message.createdAt
    ? (() => {
        try {
          return format(new Date(message.createdAt), "h:mm a");
        } catch {
          return "";
        }
      })()
    : "";

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Reactions grouped
  const reactionsMap = message.reactions || {};
  const hasReactions = Object.keys(reactionsMap).length > 0;

  return (
    <div
      className={`group relative flex my-1.5 px-3 transition-colors ${
        isMine ? "justify-end" : "justify-start"
      }`}
    >
      {/* Floating Action Bar on Hover */}
      {!message.deletedForEveryone && (
        <div
          className={`absolute -top-3 z-10 hidden group-hover:flex items-center gap-0.5 bg-card/95 backdrop-blur border border-border/80 shadow-md rounded-full px-1.5 py-0.5 transition-all animate-in fade-in zoom-in-95 duration-150 ${
            isMine ? "right-6" : "left-6"
          }`}
        >
          {/* Reaction Picker Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowReactionsMenu(!showReactionsMenu)}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="React"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>

            {showReactionsMenu && (
              <div
                className={`absolute bottom-full mb-1 flex items-center gap-1 bg-popover/95 backdrop-blur border border-border shadow-lg rounded-full p-1 z-20 animate-in fade-in zoom-in-95 ${
                  isMine ? "right-0" : "left-0"
                }`}
              >
                {POPULAR_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReaction?.(message.id, emoji);
                      setShowReactionsMenu(false);
                    }}
                    className="hover:scale-125 transition-transform px-1.5 py-0.5 text-base"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reply Button */}
          <button
            type="button"
            onClick={() => onReply?.(message)}
            className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Reply"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>

          {/* Copy Button */}
          {message.type === "text" && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title={copied ? "Copied!" : "Copy"}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Button (Only author can delete) */}
          {isMine && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Delete for everyone"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Message Bubble Container */}
      <div className="flex flex-col max-w-[78%] md:max-w-[62%]">
        <div
          className={`relative rounded-2xl px-4 py-2.5 shadow-xs transition-all ${
            message.deletedForEveryone
              ? "bg-muted/40 border border-dashed border-border text-muted-foreground italic"
              : isMine
              ? "bg-primary text-primary-foreground rounded-br-xs"
              : "bg-muted/80 text-foreground border border-border/50 rounded-bl-xs"
          }`}
        >
          {/* Sender Header for Group Chats */}
          {!isMine && message.sender?.username && !message.deletedForEveryone && (
            <p className="text-xs font-semibold text-primary mb-1">
              {message.sender.username}
            </p>
          )}

          {/* Quoted / Reply Preview */}
          {message.replyToMessage && !message.deletedForEveryone && (
            <div
              className={`mb-2 pl-2.5 py-1 text-xs border-l-2 rounded-r-md transition-colors ${
                isMine
                  ? "border-primary-foreground/60 bg-black/10 text-primary-foreground/90"
                  : "border-primary bg-primary/5 text-muted-foreground"
              }`}
            >
              <p className="font-semibold text-[11px] text-primary">
                {message.replyToMessage.sender?.username || "Replying to"}
              </p>
              <p className="truncate line-clamp-1 opacity-80">
                {message.replyToMessage.content}
              </p>
            </div>
          )}

          {/* Deleted Message Notice */}
          {message.deletedForEveryone ? (
            <div className="flex items-center gap-1.5 text-xs py-0.5 opacity-80">
              <Ban className="w-3.5 h-3.5 shrink-0" />
              <span>This message was deleted</span>
            </div>
          ) : (
            <>
              {/* Text Message */}
              {message.type === "text" && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}

              {/* Image Message */}
              {message.type === "image" && (
                <div className="rounded-xl overflow-hidden mb-1 my-1 border border-border/20">
                  <Image
                    src={message.content}
                    alt="image message"
                    className="max-w-full max-h-72 object-cover rounded-lg"
                    width={400}
                    height={300}
                  />
                </div>
              )}

              {/* Voice / Audio Note with WaveSurfer */}
              {(message.type === "audio" || message.type === "voice") && (
                <WaveformPlayer audioUrl={message.content} isMine={isMine} />
              )}

              {/* Video Message */}
              {message.type === "video" && (
                <video
                  src={message.content}
                  controls
                  className="max-w-full max-h-72 rounded-lg my-1 shadow-xs"
                />
              )}

              {/* Document / File Message */}
              {message.type === "file" && (
                <a
                  href={message.content}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors my-1 border ${
                    isMine
                      ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20"
                      : "bg-background border-border/70 hover:bg-muted"
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">
                      {message.content.split("/").pop() || "Document"}
                    </p>
                    <p className="text-[10px] opacity-75">Click to download</p>
                  </div>
                  <Download className="w-4 h-4 shrink-0 opacity-70" />
                </a>
              )}
            </>
          )}

          {/* Footer Time + Delivery Status */}
          <div
            className={`flex items-center gap-1.5 mt-1 text-[10px] ${
              isMine ? "text-primary-foreground/75 justify-end" : "text-muted-foreground justify-start"
            }`}
          >
            {timeStr && <span>{timeStr}</span>}

            {isMine && !message.deletedForEveryone && (
              <span>
                {message.status === "pending" && (
                  <Clock className="w-3 h-3 inline animate-pulse" />
                )}
                {message.status === "sent" && (
                  <Check className="w-3 h-3 inline" />
                )}
                {message.status === "delivered" && (
                  <CheckCheck className="w-3.5 h-3.5 inline text-primary-foreground/70" />
                )}
                {message.status === "read" && (
                  <CheckCheck className="w-3.5 h-3.5 inline text-sky-300 font-bold" />
                )}
              </span>
            )}
          </div>
        </div>

        {/* Reaction Badges Row */}
        {hasReactions && !message.deletedForEveryone && (
          <div
            className={`flex flex-wrap items-center gap-1 mt-1 ${
              isMine ? "justify-end" : "justify-start"
            }`}
          >
            {Object.entries(reactionsMap).map(([emoji, userIds]) => {
              const hasReacted = currentUserId ? userIds.includes(currentUserId) : false;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReaction?.(message.id, emoji)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                    hasReacted
                      ? "bg-primary/20 border-primary/40 text-foreground font-semibold shadow-xs"
                      : "bg-muted/70 hover:bg-muted border-border/50 text-muted-foreground"
                  }`}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px]">{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
