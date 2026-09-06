



export interface IMessage {
       id:string,
       createdAt:string,
       updatedAt:string,
      conversationId:string,
      content:string,
      type:string,
      attachments:[],
      sender: {
        id: string,
        username: string,
        email: string
      }
    }


export interface IConversation {
  id: string;
  type: string;
  title: string;
  iconUrl: string | null;
  lastMessageAt: string | null;
  metadata: object;
  latestMessage: IMessage | null;
  unreadCount: number;
  isMuted: boolean;
  isPinned: boolean;
  isArchived: boolean;
  members: Array<{
    id: string;
    username: string;
    email: string;
  }>;
  otherUser: {
    id: string;
    username: string;
    email: string;
  };
}
