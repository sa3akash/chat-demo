import { getConversations } from "@/actions/conversation";
import React from "react";
import SingleConversation from "./items/SingleConversation";
import ConversationHeader from "./items/ConversationHeader";

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
      <ConversationHeader />

      {/* list all conversations */}

      <div className="flex flex-col gap-2">
        {data?.map((conversation) => (
          <SingleConversation
            key={conversation.id}
            conversation={conversation}
            isActive={conversation.id === conversationId}
          />
        ))}
      </div>
    </div>
  );
};

export default Conversation;
