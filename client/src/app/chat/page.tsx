import React from "react";
import Conversation from "@/components/chat/conversation";
import ChatContainert from "@/components/chat/chatContainert";

interface ChatPageParams {
  searchParams: Promise<{ id?: string }>;
}

const ChatPage = async ({ searchParams }: ChatPageParams) => {
  const { id } = await searchParams;
  return (
    <div className="flex gap-2 h-screen w-screen">
      <Conversation conversationId={id} />
      {id ? <ChatContainert conversationId={id} /> : <NotSelectConversation />}
    </div>
  );
};

export default ChatPage;

function NotSelectConversation() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center">
      <p className="text-gray-500 text-2xl font-mono font-semibold">
        No conversation selected
      </p>
    </div>
  );
}
