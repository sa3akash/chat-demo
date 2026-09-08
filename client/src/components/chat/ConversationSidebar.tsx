"use client";

import React, { useState } from "react";
import { IConversation } from "@/types/conversation";
import ConversationHeader from "./items/ConversationHeader";
import ConversationList from "./ConversationList";

interface ConversationSidebarProps {
  initialConversations: IConversation[];
  activeConversationId?: string;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  initialConversations,
  activeConversationId,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex flex-col h-full gap-2">
      <ConversationHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <ConversationList
          initialConversations={initialConversations}
          activeConversationId={activeConversationId}
          searchQuery={searchQuery}
        />
      </div>
    </div>
  );
};

export default ConversationSidebar;
