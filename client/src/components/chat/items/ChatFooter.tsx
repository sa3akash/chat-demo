import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MicIcon, PlusIcon, SendIcon } from "lucide-react";
import React from "react";

const ChatFooter = () => {
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
        />
        {/* button for voice message */}
        <Button variant="outline">
          <MicIcon />
        </Button>
        <Button variant="outline">
          <SendIcon />
        </Button>
      </div>
    </div>
  );
};

export default ChatFooter;
