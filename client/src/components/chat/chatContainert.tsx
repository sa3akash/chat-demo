import React from "react";
import ChatHeader from "./items/chatHeader";
import ChatMessage from "./items/ChatMessage";
import ChatFooter from "./items/ChatFooter";

interface ChatContainertParams {
  conversationId: string;
}

const ChatContainert = ({ conversationId }: ChatContainertParams) => {
  return (
    <div className="flex-1 flex flex-col">
      <ChatHeader conversationId={conversationId} />

      <div className="flex-1">
        <ChatMessage />
      </div>
      <ChatFooter />
    </div>
  );
};

export default ChatContainert;
