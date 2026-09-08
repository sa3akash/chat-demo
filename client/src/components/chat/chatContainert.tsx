"use client";

import React from "react";
import ChatHeader from "./items/chatHeader";
import ChatMessage from "./items/ChatMessage";
import ChatFooter from "./items/ChatFooter";
import { useChat } from "@/hooks/useChat";

interface ChatContainertParams {
  conversationId: string;
  onBack?: () => void;
}

const ChatContainert: React.FC<ChatContainertParams> = ({ conversationId, onBack }) => {
  const {
    messages,
    isLoading,
    typingUsers,
    replyToMessage,
    setReplyToMessage,
    clearReplyTo,
    sendMessage,
    onTyping,
    handleReaction,
    handleDelete,
  } = useChat(conversationId);

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden relative">
      <ChatHeader conversationId={conversationId} onBack={onBack} />

      <div className="flex-1 min-h-0 overflow-hidden relative">
        <ChatMessage
          messages={messages}
          isLoading={isLoading}
          typingUsers={typingUsers}
          onReply={setReplyToMessage}
          onReaction={handleReaction}
          onDelete={handleDelete}
        />
      </div>

      <ChatFooter
        replyToMessage={replyToMessage}
        onClearReply={clearReplyTo}
        onSendMessage={sendMessage}
        onTyping={onTyping}
      />
    </div>
  );
};

export default ChatContainert;
