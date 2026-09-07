// NOTE: For simplicity and to avoid pulling in a second JWT library, the WS
// handshake below re-implements verification with a minimal HMAC check
// matching @elysiajs/jwt's default (HS256). Swap this for your real JWT lib
// of choice if you change the signing algorithm.
import { createHmac } from "crypto";
import { prisma } from "@/db/client";

function base64url(input: Buffer) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function verifyJwt(token: string) {
  try {
    const [headerB64, payloadB64, sig] = token.split(".");
    const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";
    const expected = base64url(
      createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest()
    );
    if (expected !== sig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString());
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    return user;
  } catch {
    return null;
  }
}
