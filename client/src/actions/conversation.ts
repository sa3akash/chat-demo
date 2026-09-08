"use server";

import { IConversation } from "@/types/conversation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const BASE_URL = "http://localhost:4400/conversations";

export const getConversations = async () => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return {
        error: "No access token found",
        success: false,
      };
    }
    const response = await fetch(BASE_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      return {
        error: "Failed to get conversations",
        success: false,
      };
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      const message = await response.text();
      return {
        error: message,
        success: false,
      };
    }
    const conversations = await response.json();
    return {
      data: conversations as IConversation[],
      success: true,
      error: null,
    };
  } catch (error) {
    console.log(error);
    return {
      error: "Internal server error",
      success: false,
    };
  }
};

interface AddConversation {
  participants: string[];
}

export const addConversation = async (participants: AddConversation) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return {
        error: "No access token found",
        success: false,
      };
    }
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(participants),
    });
    if (!response.ok) {
      return {
        error: "Failed to add conversation",
        success: false,
      };
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      const message = await response.text();
      return {
        error: message,
        success: false,
      };
    }
    const { conversation } = await response.json();

    // revalidate conversation
    revalidatePath("/chat");

    return {
      data: conversation as IConversation,
      success: true,
      error: null,
    };
  } catch (error) {
    console.log(error);
    return {
      error: "Internal server error",
      success: false,
    };
  }
};


export const getOthersUser = async (conversationId: string) => {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;
    if (!accessToken) {
      return {
        error: "No access token found",
        success: false,
      };
    }
    const response = await fetch(`${BASE_URL}/${conversationId}/others`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      return {
        error: "Failed to get others user",
        success: false,
      };
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      const message = await response.text();
      return {
        error: message,
        success: false,
      };
    }
    const { id, username, email } = await response.json();
    return {
      data: {
        id,
        username,
        email,
      },
      success: true,
      error: null,
    };
  } catch (error) {
    console.log(error);
    return {
      error: "Internal server error",
      success: false,
    };
  }
};