import { getConversations } from "@/actions/conversation";
import React from "react";
import ConversationSidebar from "./ConversationSidebar";

interface ConversationParams {
  conversationId: string | undefined;
}

const Conversation = async ({ conversationId }: ConversationParams) => {
  const { data, error, success } = await getConversations();

  if (!success) {
    return (
      <div className="w-full md:w-80 border-r bg-card/30 backdrop-blur p-4 h-full flex flex-col justify-center text-center">
        <div className="text-sm text-destructive p-4 bg-destructive/10 rounded-2xl border border-destructive/20">
          <p className="font-semibold mb-1">Failed to load chats</p>
          <p className="text-xs opacity-80">{error || "Please try refreshing the page"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-80 lg:w-96 border-r bg-card/40 backdrop-blur flex flex-col h-full p-3.5 shrink-0">
      <ConversationSidebar
        initialConversations={data || []}
        activeConversationId={conversationId}
      />
    </div>
  );
};

export default Conversation;
