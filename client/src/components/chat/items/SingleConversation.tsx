"use client";

import React from "react";
import { IConversation } from "@/types/conversation";
import { fromNow } from "@/lib/timeAgo";
import Link from "next/link";

interface SingleConversationProps {
  conversation: IConversation;
  isActive: boolean;
  online?: boolean;
}

function ActiveIndicator() {
  return <div className="absolute inset-0 ring-1 ring-green-500 rounded-md" />;
}

function OnlineIndicator() {
  return (
    <div className="absolute right-1 bottom-1 w-2 h-2 rounded-full bg-green-500" />
  );
}

const SingleConversation: React.FC<SingleConversationProps> = ({
  conversation,
  isActive,
  online,
}) => {

  return (
    <Link
      href={`/chat?id=${conversation.id}`}
      className={`flex relative items-center ring-1 ring-secondary justify-between p-2 hover:bg-primary/10 rounded-md cursor-pointer transition-colors ${
        isActive ? "bg-primary/10" : ""
      }`}
    >
      {isActive && <ActiveIndicator />}
      {online && <OnlineIndicator />}
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
