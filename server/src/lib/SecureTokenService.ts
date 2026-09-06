import crypto from 'node:crypto';

export interface TokenOptions {
  /** Lifetime of the token in seconds. Defaults to 300 (5 minutes). */
  ttlSeconds?: number;
  /** Optional context binding (e.g., user ID, IP address, user-agent) via AAD. */
  clientContext?: string;
}

export type DecryptResult<T> =
  | { success: true; data: T; issuedAt: Date; expiresAt: Date }
  | { success: false; error: 'EXPIRED' | 'MALFORMED' | 'INTEGRITY_FAILED'; message: string };

interface TokenEnvelope<T> {
  iat: number;
  exp: number;
  payload: T;
}

export class SecureTokenService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;
  private static readonly MIN_BYTE_LENGTH =
    SecureTokenService.SALT_LENGTH +
    SecureTokenService.IV_LENGTH +
    SecureTokenService.TAG_LENGTH +
    1; // minimum 1 byte payload

  private readonly masterKey: Buffer;
  private readonly hkdfInfo: Buffer;

  /**
   * @param secretKey 32-byte secret (as a Buffer, 64-char hex string, or 44-char base64 string).
   * @param hkdfLabel Optional domain separation string for key derivation.
   */
  constructor(secretKey: Buffer | string, hkdfLabel: string = 'SecureTokenService-v1') {
    if (typeof secretKey === 'string') {
      if (secretKey.length === 64) {
        this.masterKey = Buffer.from(secretKey, 'hex');
      } else {
        this.masterKey = Buffer.from(secretKey, 'base64');
      }
    } else {
      this.masterKey = secretKey;
    }

    if (this.masterKey.length !== 32) {
      throw new Error(
        `Invalid secret key length: expected 32 bytes (256 bits), received ${this.masterKey.length} bytes.`
      );
    }

    this.hkdfInfo = Buffer.from(hkdfLabel, 'utf8');
  }

  /**
   * Helper to generate a cryptographically strong 256-bit random key in Hex.
   */
  public static generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Derives a dedicated ephemeral key using HKDF (RFC 5869).
   */
  private deriveKey(salt: Buffer): Buffer {
    return crypto.hkdfSync('sha256', this.masterKey, salt, this.hkdfInfo, 32) as unknown as Buffer;
  }

  /**
   * Encrypts and packs a payload into a URL-safe, authenticated token.
   */
  public encrypt<T>(payload: T, options: TokenOptions = {}): string {
    const { ttlSeconds = 300, clientContext = '' } = options;

    const now = Date.now();
    const envelope: TokenEnvelope<T> = {
      iat: now,
      exp: now + ttlSeconds * 1000,
      payload,
    };

    const salt = crypto.randomBytes(SecureTokenService.SALT_LENGTH);
    const iv = crypto.randomBytes(SecureTokenService.IV_LENGTH);
    const derivedKey = this.deriveKey(salt);

    const cipher = crypto.createCipheriv(SecureTokenService.ALGORITHM, derivedKey, iv);

    if (clientContext) {
      cipher.setAAD(Buffer.from(clientContext, 'utf8'));
    }

    const jsonString = JSON.stringify(envelope);
    const encrypted = Buffer.concat([
      cipher.update(jsonString, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    // Packing layout: [Salt (16B)] + [IV (12B)] + [Tag (16B)] + [Ciphertext]
    const tokenBuffer = Buffer.concat([salt, iv, authTag, encrypted]);
    return tokenBuffer.toString('base64url');
  }

  /**
   * Decrypts, verifies authenticity tag, and enforces expiration and context binding.
   */
  public decrypt<T>(token: string, clientContext: string = ''): DecryptResult<T> {
    try {
      const raw = Buffer.from(token, 'base64url');

      if (raw.length < SecureTokenService.MIN_BYTE_LENGTH) {
        return {
          success: false,
          error: 'MALFORMED',
          message: 'Token does not meet minimum byte requirements.',
        };
      }

      // Extract components using byte offsets
      let offset = 0;

      const salt = raw.subarray(offset, offset + SecureTokenService.SALT_LENGTH);
      offset += SecureTokenService.SALT_LENGTH;

      const iv = raw.subarray(offset, offset + SecureTokenService.IV_LENGTH);
      offset += SecureTokenService.IV_LENGTH;

      const authTag = raw.subarray(offset, offset + SecureTokenService.TAG_LENGTH);
      offset += SecureTokenService.TAG_LENGTH;

      const ciphertext = raw.subarray(offset);

      // Re-derive ephemeral key
      const derivedKey = this.deriveKey(salt);

      const decipher = crypto.createDecipheriv(SecureTokenService.ALGORITHM, derivedKey, iv);
      decipher.setAuthTag(authTag);

      if (clientContext) {
        decipher.setAAD(Buffer.from(clientContext, 'utf8'));
      }

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      const envelope: TokenEnvelope<T> = JSON.parse(decrypted.toString('utf8'));

      // Expiration check
      if (Date.now() > envelope.exp) {
        return {
          success: false,
          error: 'EXPIRED',
          message: `Token expired at ${new Date(envelope.exp).toISOString()}`,
        };
      }

      return {
        success: true,
        data: envelope.payload,
        issuedAt: new Date(envelope.iat),
        expiresAt: new Date(envelope.exp),
      };
    } catch {
      return {
        success: false,
        error: 'INTEGRITY_FAILED',
        message: 'Decryption failed: signature mismatch, tampering, or invalid context.',
      };
    }
  }
}

/*

Usage & Type-Safety Example

// 1. Define your strict payload interface
interface ResetPasswordPayload {
  userId: string;
  email: string;
  attemptsLeft: number;
}

// 2. Instantiate with a 32-byte secret (e.g., from process.env.TOKEN_SECRET)
const secret = SecureTokenService.generateSecret();
const tokenEngine = new SecureTokenService(secret);

// 3. Encrypt payload with custom TTL and context binding
const userContext = 'UserAgent:MobileSafari|Subnet:192.168.1.0';

const token = tokenEngine.encrypt<ResetPasswordPayload>(
  {
    userId: 'usr_4401',
    email: 'dev@example.com',
    attemptsLeft: 3,
  },
  {
    ttlSeconds: 60,
    clientContext: userContext,
  }
);

console.log('Encrypted Base64URL Token:\n', token);

// 4. Decrypt with strict Discriminated Union handling
const result = tokenEngine.decrypt<ResetPasswordPayload>(token, userContext);

if (result.success) {
  // TypeScript narrows result.data directly to ResetPasswordPayload
  console.log('User ID:', result.data.userId);
  console.log('Expires at:', result.expiresAt.toISOString());
} else {
  // TypeScript narrows result to the error variant
  console.error(`Decryption failed [${result.error}]:`, result.message);
}


*/