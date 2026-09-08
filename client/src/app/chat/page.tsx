import React from "react";
import Conversation from "@/components/chat/conversation";
import ChatContainert from "@/components/chat/chatContainert";
import { MessageSquare, ShieldCheck, Sparkles } from "lucide-react";

interface ChatPageParams {
  searchParams: Promise<{ id?: string }>;
}

const ChatPage = async ({ searchParams }: ChatPageParams) => {
  const { id } = await searchParams;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      {/* Sidebar: Visible on desktop or when no conversation is selected on mobile */}
      <div
        className={`h-full ${
          id ? "hidden md:flex" : "flex w-full md:w-auto"
        }`}
      >
        <Conversation conversationId={id} />
      </div>

      {/* Main Chat Area: Visible on desktop or when conversation is selected on mobile */}
      <div
        className={`flex-1 h-full min-w-0 ${
          id ? "flex" : "hidden md:flex"
        }`}
      >
        {id ? <ChatContainert conversationId={id} /> : <NotSelectConversation />}
      </div>
    </div>
  );
};

export default ChatPage;

function NotSelectConversation() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-card/15">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/5">
          <MessageSquare className="w-10 h-10 stroke-[1.75]" />
        </div>
        <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-500">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
        Welcome to your Real-Time Workspace
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
        Select a conversation from the sidebar or start a new chat to exchange instant messages, voice notes, and media.
      </p>

      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-muted/60 border border-border/50 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-500" />
        <span>End-to-end encrypted session & Redis cluster delivery</span>
      </div>
    </div>
  );
}
