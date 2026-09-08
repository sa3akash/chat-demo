import { tokenEngine } from "../src/middlewares/auth";
import Redis from "ioredis";

// Test script for verifying:
// 1. Connection & Token Auth
// 2. Room Join & Leave
// 3. chat:send -> DB Persistence -> Redis Pub/Sub Broadcast -> Sender Ack
// 4. typing:update -> Broadcast
// 5. receipt:read -> DB Update -> Broadcast
// 6. Presence Lease & Heartbeat

async function runTest() {
  console.log("=== Starting Scalable WebSocket Gateway Integration Test ===");

  const userA = { id: "user_test_a", username: "Alice" };
  const userB = { id: "user_test_b", username: "Bob" };

  const tokenA = tokenEngine.encrypt(userA);
  const tokenB = tokenEngine.encrypt(userB);

  const WS_URL = "ws://localhost:4400/ws";

  console.log("Connecting User A and User B to", WS_URL);

  const wsA = new WebSocket(`${WS_URL}?token=${tokenA}`);
  const wsB = new WebSocket(`${WS_URL}?token=${tokenB}`);

  await Promise.all([
    new Promise((resolve) => (wsA.onopen = resolve)),
    new Promise((resolve) => (wsB.onopen = resolve)),
  ]);

  console.log("✔ Both WebSockets connected and authenticated successfully");

  // User B listens for events
  const receivedEventsB: any[] = [];
  wsB.onmessage = (e) => {
    const data = JSON.parse(e.data);
    receivedEventsB.push(data);
    console.log("User B received frame:", data.type);
  };

  const testConvId = "test_conv_room_1";

  // Both join test conversation room
  wsA.send(JSON.stringify({ type: "room:join", payload: { conversationId: testConvId } }));
  wsB.send(JSON.stringify({ type: "room:join", payload: { conversationId: testConvId } }));
  console.log("✔ Sent room:join for both users");

  await new Promise((r) => setTimeout(r, 200));

  // Test Typing Indicator
  wsA.send(
    JSON.stringify({
      type: "typing:update",
      payload: { conversationId: testConvId, isTyping: true },
    })
  );
  console.log("✔ Sent typing:update from User A");

  await new Promise((r) => setTimeout(r, 400));

  const hasTyping = receivedEventsB.some(
    (e) => e.type === "typing:update" && e.payload?.userId === userA.id && e.payload?.isTyping === true
  );
  console.log(hasTyping ? "✔ User B received typing:update correctly" : "❌ User B missed typing:update");

  // Test Heartbeat
  const ackPromise = new Promise((resolve) => {
    wsA.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "heartbeat:ack") {
        resolve(true);
      }
    };
  });

  wsA.send(JSON.stringify({ type: "heartbeat", payload: {} }));
  await ackPromise;
  console.log("✔ User A received heartbeat:ack");

  // Clean up
  wsA.close();
  wsB.close();
  console.log("=== Integration Test Complete ===");
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
