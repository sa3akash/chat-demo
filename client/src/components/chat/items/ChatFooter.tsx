"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MicIcon, PlusIcon, SendIcon } from "lucide-react";
import React, { useState } from "react";
import { useSocket } from "@/context/SocketContext";

const ChatFooter = () => {
  const { socket } = useSocket();
  const [message, setMessage] = useState("");

  const sendMessage = () => {
    if (!socket || !message) return;

    socket.send(
      JSON.stringify({
        type: "message",
        payload: {
          content: message,
          timestamp: new Date().toISOString(),
          conversationId: "",
          senderId: "user-1",
          receiverId: "user-2",
        },
      }),
    );
    setMessage("");
  };

  return (
    <div className="border-t p-4">
      <div className="flex items-center gap-2">
        <button className="text-blue-500">
          <PlusIcon />
        </button>
        <Input
          type="text"
          className="flex-1 border p-2 rounded-lg"
          placeholder="Type a message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        {/* button for voice message */}
        <Button variant="outline">
          <MicIcon />
        </Button>
        <Button variant="outline" onClick={sendMessage}>
          <SendIcon />
        </Button>
      </div>
    </div>
  );
};

export default ChatFooter;
