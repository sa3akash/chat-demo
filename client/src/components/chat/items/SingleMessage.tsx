import Image from "next/image";

export interface IMessage {
  id: string;
  content: string;
  type: string;
  senderId: string;
  receiverId: string;
}

interface SingleMessageProps {
  message: IMessage;
  user: "mine" | "other";
}
export const SingleMessage = ({ message, user }: SingleMessageProps) => {
  return (
    <div
      className={`flex my-1 ${user === "mine" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`p-2 rounded-lg ${user === "mine" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
      >
        {/* handle image, file, video, voice message
        
        <div className="rounded-md overflow-hidden mb-1">
          <img
            src="https://images.unsplash.com/photo-1466616076168-61e5604158cb?w=400"
            alt="Post image"
            className="w-48 h-48 object-cover"
          />
        </div>
        <p className="text-sm text-muted-foreground mb-1">
          I can send you the files here instead... Maybe we can meet up 
        </p>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <Pause className="w-3 h-3" />
            0:42
          </button>
          <p className="text-xs text-muted-foreground">3.2 MB</p>
        </div>
        
        */}
        {message.type === "text" && <p>{message.content}</p>}
        {message.type === "image" && (
          <div className="rounded-md overflow-hidden mb-1">
            <Image
              src={message.content}
              alt="image message"
              className="w-48 h-48 object-cover"
              width={480}
              height={480}
            />
          </div>
        )}
        {message.type === "video" && (
          <video src={message.content} controls></video>
        )}
        {message.type === "file" && <a href={message.content}>Download</a>}
        {message.type === "voice" && <audio src={message.content}></audio>}
      </div>
    </div>
  );
};
