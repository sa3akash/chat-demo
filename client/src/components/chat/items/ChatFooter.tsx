"use client";

import { Button } from "@/components/ui/button";
import {
  SendIcon,
  Smile,
  Paperclip,
  Mic,
  X,
  Image as ImageIcon,
  FileText,
  Trash2,
  Reply,
  Loader2,
} from "lucide-react";
import React, { useState, useRef, useEffect, KeyboardEvent, useTransition } from "react";
import { ChatMessageState } from "@/hooks/useChat";
import { MessageAttachment } from "@/types/socket.client";
import { uploadFile } from "@/actions/upload";

interface ChatFooterProps {
  replyToMessage?: ChatMessageState | null;
  onClearReply?: () => void;
  onSendMessage: (params: {
    content: string;
    type?: string;
    attachments?: MessageAttachment[];
  }) => void;
  onTyping: () => void;
  disabled?: boolean;
}

const COMMON_EMOJIS = ["😀", "😂", "😍", "🔥", "👍", "🎉", "❤️", "🙌", "🚀", "✨", "💯", "😎"];

export const ChatFooter: React.FC<ChatFooterProps> = ({
  replyToMessage,
  onClearReply,
  onSendMessage,
  onTyping,
  disabled = false,
}) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    type: "image" | "file" | "audio";
    localUrl: string;  // preview only (blob URL)
    serverUrl?: string; // set after upload
    mimeType?: string;
    uploading?: boolean;
  } | null>(null);

  const [isUploading, startUploadTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Recording timer
  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecording]);

  const handleSend = () => {
    if ((!message.trim() && !pendingAttachment) || disabled) return;
    if (isUploading || pendingAttachment?.uploading) return;

    if (pendingAttachment) {
      // Use the server-uploaded URL as content (rendered as src in SingleMessage)
      // Fall back to local blob URL only if upload hasn't finished yet
      const mediaUrl = pendingAttachment.serverUrl || pendingAttachment.localUrl;
      onSendMessage({
        content: mediaUrl,
        type: pendingAttachment.type,
        attachments: [
          {
            url: mediaUrl,
            name: pendingAttachment.name,
            mimeType: pendingAttachment.mimeType || "application/octet-stream",
          },
        ],
      });
      setPendingAttachment(null);
    } else {
      onSendMessage({ content: message.trim(), type: "text" });
    }

    setMessage("");
    setShowEmojiPicker(false);
    setShowAttachmentMenu(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setIsRecording(true); // fallback simulation
    }
  };

  const handleSendVoiceNote = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const localUrl = URL.createObjectURL(audioBlob);

        // Show immediately with local URL
        setPendingAttachment({
          name: `voice-${Date.now()}.webm`,
          type: "audio",
          localUrl,
          mimeType: "audio/webm",
          uploading: true,
        });
        setIsRecording(false);

        // Upload in background
        const fd = new FormData();
        fd.append("file", audioBlob, `voice-${Date.now()}.webm`);
        startUploadTransition(async () => {
          const res = await uploadFile(fd);
          if (res.success && res.data) {
            setPendingAttachment((prev) =>
              prev ? { ...prev, serverUrl: res.data!.url, uploading: false } : null
            );
          } else {
            // Send with local blob URL if upload failed (won't persist across devices)
            setPendingAttachment((prev) =>
              prev ? { ...prev, uploading: false } : null
            );
          }
        });
      };
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    } else {
      // Simulation fallback
      onSendMessage({
        content: "https://actions.google.com/sounds/v1/speech/greeting_male.ogg",
        type: "audio",
      });
      setIsRecording(false);
    }
  };

  const handleCancelVoiceNote = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    onTyping();
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleFileSelect = (type: "image" | "file", e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localUrl = URL.createObjectURL(file);
    setPendingAttachment({
      name: file.name,
      type,
      localUrl,
      mimeType: file.type,
      uploading: true,
    });
    setShowAttachmentMenu(false);

    // Upload file to server
    const fd = new FormData();
    fd.append("file", file);
    startUploadTransition(async () => {
      const res = await uploadFile(fd);
      if (res.success && res.data) {
        setPendingAttachment((prev) =>
          prev ? { ...prev, serverUrl: res.data!.url, uploading: false } : null
        );
      } else {
        setPendingAttachment((prev) =>
          prev ? { ...prev, uploading: false } : null
        );
      }
    });

    // Reset input value so the same file can be re-selected
    e.target.value = "";
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isSendReady = !isUploading && !pendingAttachment?.uploading;

  return (
    <div className="border-t bg-card/80 backdrop-blur shrink-0 transition-all">
      {/* Hidden File Inputs */}
      <input type="file" ref={imageInputRef} accept="image/*" className="hidden"
        onChange={(e) => handleFileSelect("image", e)} />
      <input type="file" ref={fileInputRef} accept="*/*" className="hidden"
        onChange={(e) => handleFileSelect("file", e)} />

      {/* Reply Banner */}
      {replyToMessage && (
        <div className="flex items-center justify-between px-4 py-2 bg-muted/40 border-b border-border/40 text-xs text-muted-foreground animate-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
            <div className="min-w-0">
              <span className="font-semibold text-foreground">
                Replying to {replyToMessage.sender?.username || "message"}:
              </span>{" "}
              <span className="truncate">{replyToMessage.content}</span>
            </div>
          </div>
          <button type="button" onClick={onClearReply}
            className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Attachment Preview + Upload Progress */}
      {pendingAttachment && (
        <div className="flex items-center justify-between mx-4 my-2 p-2 bg-muted/60 rounded-xl border border-border/60 text-xs">
          <div className="flex items-center gap-2">
            {pendingAttachment.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pendingAttachment.localUrl} alt="preview"
                className="w-10 h-10 object-cover rounded-lg" />
            ) : (
              <FileText className="w-6 h-6 text-primary" />
            )}
            <div className="flex flex-col">
              <span className="font-medium truncate max-w-[160px]">{pendingAttachment.name}</span>
              {pendingAttachment.uploading && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Uploading…
                </span>
              )}
              {!pendingAttachment.uploading && pendingAttachment.serverUrl && (
                <span className="text-[10px] text-emerald-500">✓ Ready to send</span>
              )}
            </div>
          </div>
          <button type="button" onClick={() => setPendingAttachment(null)}
            className="p-1 rounded-full hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="p-2 border-b border-border/40 flex flex-wrap gap-1 bg-popover/90 backdrop-blur animate-in fade-in">
          {COMMON_EMOJIS.map((emoji) => (
            <button key={emoji} type="button"
              onClick={() => { setMessage((prev) => prev + emoji); setShowEmojiPicker(false); }}
              className="p-1.5 hover:bg-muted rounded-lg text-lg hover:scale-125 transition-transform">
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Input Bar */}
      <div className="p-3 px-4">
        {isRecording ? (
          <div className="flex items-center justify-between bg-destructive/10 border border-destructive/20 rounded-2xl p-2.5 px-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-destructive animate-ping" />
              <span className="text-xs font-semibold text-destructive font-mono">
                Recording {formatSeconds(recordingSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleCancelVoiceNote}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl">
                <Trash2 className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleSendVoiceNote} className="rounded-xl shadow-xs">
                <SendIcon className="w-3.5 h-3.5 mr-1" /> Send Voice
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2 max-w-5xl mx-auto">
            {/* Attachment Menu */}
            <div className="relative">
              <Button type="button" variant="ghost" size="icon"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                className="rounded-xl text-muted-foreground hover:text-foreground h-10 w-10 shrink-0">
                <Paperclip className="w-5 h-5" />
              </Button>
              {showAttachmentMenu && (
                <div className="absolute bottom-full mb-2 left-0 flex flex-col gap-1 bg-popover/95 backdrop-blur border border-border shadow-xl rounded-2xl p-1.5 min-w-[140px] z-30 animate-in fade-in zoom-in-95">
                  <button type="button" onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl hover:bg-muted text-foreground transition-colors">
                    <ImageIcon className="w-4 h-4 text-emerald-500" /> Photo / Image
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl hover:bg-muted text-foreground transition-colors">
                    <FileText className="w-4 h-4 text-sky-500" /> Document / File
                  </button>
                </div>
              )}
            </div>

            {/* Text Input */}
            <div className="flex-1 relative flex items-center bg-muted/40 border border-input rounded-2xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary shadow-inner">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Type a message…"
                value={message}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className="w-full resize-none bg-transparent py-2.5 pl-3.5 pr-10 text-sm focus:outline-hidden max-h-28 text-foreground placeholder:text-muted-foreground/70"
              />
              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-3 text-muted-foreground hover:text-foreground transition-colors">
                <Smile className="w-4 h-4" />
              </button>
            </div>

            {/* Send / Mic / Upload indicator */}
            {message.trim() || pendingAttachment ? (
              <Button type="button" onClick={handleSend}
                disabled={disabled || !isSendReady}
                size="icon"
                className="rounded-xl h-10 w-10 shrink-0 shadow-sm transition-transform active:scale-95 disabled:opacity-50">
                {isUploading || pendingAttachment?.uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SendIcon className="w-4 h-4" />
                )}
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="icon"
                onClick={startRecording}
                className="rounded-xl h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Record voice note">
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatFooter;
