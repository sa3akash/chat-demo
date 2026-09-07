import { pub, sub } from "./client";

type Handler = (payload: any) => void;

/**
 * Thin dynamic pub/sub router built on top of a single shared Redis
 * subscriber connection. Lets different parts of the app subscribe to
 * per-conversation channels (conv:<id>) or the global presence channel
 * without each opening its own Redis connection — Redis subscriber
 * connections are relatively expensive at scale, so we multiplex.
 */
class PubSubRouter {
  private handlers = new Map<string, Set<Handler>>();

  constructor() {
    sub.on("message", (channel: string, message: string) => {
      const set = this.handlers.get(channel);
      if (!set) return;
      let payload: any;
      try {
        payload = JSON.parse(message);
      } catch {
        return;
      }
      for (const handler of set) handler(payload);
    });
  }

  async subscribe(channel: string, handler: Handler) {
    let set = this.handlers.get(channel);
    if (!set) {
      set = new Set();
      this.handlers.set(channel, set);
      await sub.subscribe(channel);
    }
    set.add(handler);
  }

  async unsubscribe(channel: string, handler: Handler) {
    const set = this.handlers.get(channel);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(channel);
      await sub.unsubscribe(channel);
    }
  }

  publish(channel: string, payload: unknown) {
    return pub.publish(channel, JSON.stringify(payload));
  }
}

export const pubsub = new PubSubRouter();

export const conversationChannel = (conversationId: string) => `conv:${conversationId}`;
export const PRESENCE_CHANNEL = "presence:events";
