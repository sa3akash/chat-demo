'use client'

import React, { useEffect, useRef } from "react";
import { SingleMessage } from "./SingleMessage";

const ChatMessage = ({ messages = [] }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Automatically scroll to the latest message whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    // h-full and overflow-y-auto enable scrolling
    // justify-end pushes all messages to the bottom when there are few items
    <div className="flex h-full flex-col justify-end overflow-y-auto p-4 gap-2">
      {/* Container wrapper ensuring vertical layout flows naturally */}
      <div className="flex flex-col gap-2 mt-auto">
        <SingleMessage
          message={{
            id: "1",
            content: "Hello",
            type: "text",
            senderId: "1",
            receiverId: "2",
          }}
          user="mine"
        />

        <SingleMessage
          message={{
            id: "2",
            content: "Hi",
            type: "text",
            senderId: "2",
            receiverId: "1",
          }}
          user="other"
        />

        {/* Dummy div pinned to the very bottom for auto-scrolling */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ChatMessage;