import { InfoIcon, PhoneIcon, VideoIcon } from "lucide-react";

interface ChatHeaderParams {
  conversationId: string;
}

const ChatHeader = ({ conversationId }: ChatHeaderParams) => {
  return (
    <div className="border-b p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gray-200 rounded-full mr-2"></div>
          <div>
            <p className="font-medium">User</p>
            <p className="text-sm text-gray-500">Active</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-blue-500">
            <PhoneIcon />
          </button>
          <button className="text-blue-500">
            <VideoIcon />
          </button>
          <button className="text-blue-500">
            <InfoIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
