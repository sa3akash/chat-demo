import { getConversations } from "@/actions/conversation";
import React from "react";
import SingleConversation from "./items/SingleConversation";

interface ConversationParams {
  conversationId: string | undefined;
}

const Conversation = async ({ conversationId }: ConversationParams) => {
  const { data, error, success } = await getConversations();
  if (!success) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-72 w-full border-r p-4">
      <div className="flex items-center justify-between mb-4 border-b pb-2">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <button className="text-blue-500">New Chat</button>
      </div>

      {/* list all conversations */}

      <div>
        {data?.map((conversation) => (
          <SingleConversation
            key={conversation.id}
            conversation={conversation}
            isActive={true}
          />
        ))}
      </div>
    </div>
  );
};

export default Conversation;
