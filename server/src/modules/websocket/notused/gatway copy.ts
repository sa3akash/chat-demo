// import { logger } from "@/lib/logger";
// import Elysia, { t } from "elysia";

// // Extract Elysia's internal WS type directly from a handler function
// type WS = Parameters<NonNullable<Parameters<Elysia["ws"]>[1]["open"]>>[0];

// // Map storing active sockets grouped by user ID
// const userSockets = new Map<string, Set<WS>>();

// export const socket = new Elysia({
//   websocket: {
//     idleTimeout: 30,
//     maxPayloadLength: 1024 * 1024,
//     perMessageDeflate: true,
//     backpressureLimit: 16 * 1024 * 1024,
//     closeOnBackpressureLimit: true,
//   },
// })
// .ws("/ws", {
//   query: t.Object({
//     token: t.Optional(t.String()),
//   }),

//   // Attach data safely to ws.data

// //   upgrade({headers, query, set}) {
// //       const token = headers.authorization?.replace("Bearer ", "") ?? query.token;

// //       if (token !== "secret") {
// //         set.status = 401;
// //         throw new Error("Unauthorized");
// //       }

// //       return {
// //         user: {
// //           id: "user_123",
// //           name: "John Doe",
// //           email: "john@example.com",
// //         },
// //         socketId: crypto.randomUUID(),
// //       } satisfies WebContextData;
// //   },

//     beforeHandle({ query, error }) {
//       const userId = "11"
//       if (!userId) return error(401, 'Unauthorized')
//       return { userId }
//     },

//   open(ws) {
//     ws.send("Welcome!");
//     logger.info(`User connected ${ws.id}`);

//     // Autocomplete works on ws.data.user

//           const { userId } = ws.data


//     const userSet = userSockets.get(userId) ?? new Set();
//     userSet.add(ws);
//     userSockets.set(userId, userSet);
//   },

//   message(ws, message) {
//     logger.info(`User message on ${ws.id}`);

//     const userId = "";
//     const peers = userSockets.get(userId) ?? new Set();

//     for (const client of peers) {
//       if (client.raw.readyState === 1) {
//         client.send(message);
//       }
//     }
//   },

//   close(ws, code, reason) {
//     logger.info(`User disconnected ${ws.id}`);
//     const userId = "";
//     const userSet = userSockets.get(userId);

//     if (userSet) {
//       userSet.delete(ws);
//       if (userSet.size === 0) {
//         userSockets.delete(userId);
//       }
//     }
//   },
// });
