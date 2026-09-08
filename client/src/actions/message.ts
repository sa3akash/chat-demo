"use server";

import { cookies } from "next/headers";

const BASE_URL = process.env.SERVER_URL || "http://localhost:4400";

export interface MessageItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  attachments?: any[];
  sender?: {
    id: string;
    username: string;
    email?: string;
  } | null;
}

export interface GetMessagesResponse {
  messages: MessageItem[];
  nextCursor: string | null;
}

export const getMessages = async (conversationId: string, cursor?: string, limit = 50) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return {
        error: "No access token found",
        success: false,
        data: null,
      };
    }

    const url = new URL(`${BASE_URL}/messages`);
    url.searchParams.set("conversationId", conversationId);
    url.searchParams.set("limit", limit.toString());
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: errorText || "Failed to fetch messages",
        success: false,
        data: null,
      };
    }

    const data: GetMessagesResponse = await response.json();
    return {
      data,
      success: true,
      error: null,
    };
  } catch (error: any) {
    console.error("Error fetching messages:", error);
    return {
      error: error?.message || "Internal server error",
      success: false,
      data: null,
    };
  }
};
