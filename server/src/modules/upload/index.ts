import { Elysia, t } from "elysia";
import { auth } from "@/middlewares/auth";
import { join } from "path";
import { mkdir } from "fs/promises";
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@/lib/logger";

// Resolve uploads root relative to the project root (server/)
const UPLOADS_ROOT = join(process.cwd(), "uploads");

// Allowed MIME type → subfolder mapping
const MIME_FOLDER_MAP: Record<string, string> = {
  // Images
  "image/jpeg": "images",
  "image/jpg": "images",
  "image/png": "images",
  "image/gif": "images",
  "image/webp": "images",
  "image/svg+xml": "images",
  // Audio
  "audio/webm": "audio",
  "audio/mpeg": "audio",
  "audio/mp3": "audio",
  "audio/ogg": "audio",
  "audio/wav": "audio",
  "audio/flac": "audio",
  "audio/aac": "audio",
  // Video
  "video/mp4": "videos",
  "video/webm": "videos",
  "video/ogg": "videos",
  // Documents / Files
  "application/pdf": "files",
  "application/msword": "files",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "files",
  "application/vnd.ms-excel": "files",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "files",
  "application/zip": "files",
  "application/x-zip-compressed": "files",
  "text/plain": "files",
};

// Max file size: 25 MB
const MAX_FILE_SIZE = 25 * 1024 * 1024;

/** Ensure a directory exists */
async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

/** Derive file extension from MIME type or filename */
function getExtension(filename: string, mimeType: string): string {
  // Use original extension if available
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex !== -1) {
    return filename.slice(dotIndex); // e.g. ".jpg"
  }
  // Fallback: derive from mime
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "audio/webm": ".webm",
    "audio/mpeg": ".mp3",
    "audio/ogg": ".ogg",
    "audio/wav": ".wav",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
  };
  return mimeToExt[mimeType] ?? ".bin";
}

const BASE_URL = process.env.BASE_URL || "http://localhost:4400";

export const uploadRoutes = new Elysia({ prefix: "/upload" })
  .use(auth)
  .post(
    "/",
    async ({ body, set }) => {
      const { file } = body as { file: File };

      if (!file || !(file instanceof File)) {
        set.status = 400;
        return { success: false, error: "No file provided" };
      }

      if (file.size > MAX_FILE_SIZE) {
        set.status = 413;
        return { success: false, error: `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB` };
      }

      const mimeType = file.type || "application/octet-stream";
      const folder = MIME_FOLDER_MAP[mimeType] ?? "files";
      const ext = getExtension(file.name ?? "file", mimeType);
      const filename = `${createId()}${ext}`;
      const subDir = join(UPLOADS_ROOT, folder);
      const fullPath = join(subDir, filename);

      try {
        await ensureDir(subDir);

        // Write file using Bun.write (fastest)
        const arrayBuffer = await file.arrayBuffer();
        await Bun.write(fullPath, arrayBuffer);

        const publicUrl = `${BASE_URL}/uploads/${folder}/${filename}`;

        logger.info({ mimeType, folder, filename, size: file.size }, "File uploaded");

        return {
          success: true,
          url: publicUrl,
          name: file.name ?? filename,
          mimeType,
          size: file.size,
          type: folder === "images" ? "image" : folder === "audio" ? "audio" : folder === "videos" ? "video" : "file",
        };
      } catch (err: any) {
        logger.error({ err: err.message }, "File upload failed");
        set.status = 500;
        return { success: false, error: "Upload failed" };
      }
    },
    {
      isAuth: true,
      body: t.Object({
        file: t.File(),
      }),
      detail: {
        summary: "Upload a file (image, audio, video, document)",
        tags: ["Upload"],
      },
    }
  );
