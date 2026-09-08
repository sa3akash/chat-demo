import Redis from "ioredis";
import { WS } from "../demo/socketStore";
import type { MessageSchema } from "../types";

const pub = new Redis({ host: "localhost", port: 6379 });

export function messageHandler(ws: WS, msg: MessageSchema) {
  switch (msg.type) {
    case "chat": {
      const { id, conversationId, receiverId, groupId } = msg.payload;

      // 1-on-1 Messaging
      if (receiverId) {
        publishToUser(receiverId, msg);
      }
      // Group Messaging (Fan-out via Redis/DB group membership lookup)
      else if (groupId) {
        publishToGroup(groupId, msg);
      }
      break;
    }

    case "typing": {
      // Ephemeral event: Route to recipient without heavy database persistence
      const { conversationId, userId } = msg.payload;
      publishToConversation(conversationId, msg, userId /* skipSender */);
      break;
    }

    case "receipt": {
      // Send Read/Delivered confirmation back to message author
      const { senderId } = msg.payload;
      publishToUser(senderId, msg);
      break;
    }

    case "reaction": {
      const { conversationId } = msg.payload;
      publishToConversation(conversationId, msg);
      break;
    }

    case "group_action": {
      const { groupId } = msg.payload;
      publishToGroup(groupId, msg);
      break;
    }

    default:
      console.warn("Unhandled frame type:", msg);
      break;
  }
}

// Helper: Publishes to global Redis channel for cross-server node delivery
function publishToUser(userId: string, message: MessageSchema) {
  pub.publish("chat", JSON.stringify({ userId, message }));
}

function publishToGroup(groupId: string, message: MessageSchema) {
  // Pass groupId payload down the Redis pub/sub pipeline
  pub.publish("group_chat", JSON.stringify({ groupId, message }));
}

function publishToConversation(
  conversationId: string,
  message: MessageSchema,
  excludeUserId?: string,
) {
  pub.publish(
    "conversation",
    JSON.stringify({ conversationId, message, excludeUserId }),
  );
}
