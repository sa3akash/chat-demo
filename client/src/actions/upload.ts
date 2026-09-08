"use server";

import { cookies } from "next/headers";

const UPLOAD_URL = "http://localhost:4400/upload";

export interface UploadResult {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  type: "image" | "audio" | "video" | "file";
}

/**
 * Upload a file to the server and get back a public URL.
 * Should be called from client components via a server action wrapper.
 */
export async function uploadFile(formData: FormData): Promise<{
  success: boolean;
  data?: UploadResult;
  error?: string;
}> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("accessToken")?.value;

    if (!accessToken) {
      return { success: false, error: "Not authenticated" };
    }

    const response = await fetch(UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // NOTE: Do NOT set Content-Type here — let fetch set multipart boundary automatically
      },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: text || "Upload failed" };
    }

    const json = await response.json();

    if (!json.success) {
      return { success: false, error: json.error || "Upload failed" };
    }

    return {
      success: true,
      data: {
        url: json.url,
        name: json.name,
        mimeType: json.mimeType,
        size: json.size,
        type: json.type,
      },
    };
  } catch (err: any) {
    console.error("Upload error:", err);
    return { success: false, error: err?.message || "Network error" };
  }
}
