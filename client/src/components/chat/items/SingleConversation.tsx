import React from "react";
import { IConversation } from "@/types/conversation";
import { fromNow } from "@/lib/timeAgo";
import Link from "next/link";

interface SingleConversationProps {
  conversation: IConversation;
  isActive: boolean;
}

function ActiveIndicator() {
  return (
    <div className="absolute w-0.5 bg-green-400 h-full left-0 top-1/2 -translate-y-1/2" />
  );
}

const SingleConversation: React.FC<SingleConversationProps> = ({
  conversation,
  isActive,
}) => {
  return (
    <Link
      href={`/chat?id=${conversation.id}`}
      className={`flex relative items-center justify-between p-2 hover:bg-primary/10 rounded-md cursor-pointer transition-colors ${
        isActive ? "bg-primary/10" : ""
      }`}
    >
      {isActive && <ActiveIndicator />}
      <div className="flex items-center">
        <div className="w-8 h-8 bg-gray-200 rounded-full mr-2"></div>
        <div>
          <p className="font-medium">{conversation.otherUser.username}</p>
          <p className="text-sm text-gray-500">
            {conversation.latestMessage?.content}
          </p>
        </div>
      </div>
      <span className="text-sm text-gray-500">
        {fromNow(conversation.lastMessageAt || "")}
      </span>
    </Link>
  );
};

export default SingleConversation;
