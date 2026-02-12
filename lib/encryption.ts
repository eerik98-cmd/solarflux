import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Get encryption key from environment variable
 * Generates a random key if not set (for development only)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.SMTP_ENCRYPTION_KEY;
  
  if (!key) {
    // In development, generate a random key (WARNING: data will not persist across restarts)
    console.warn('SMTP_ENCRYPTION_KEY not set. Using temporary key for development.');
    return crypto.randomBytes(32);
  }
  
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt SMTP password using AES-256-GCM
 * @param password - Plain text password to encrypt
 * @returns Encrypted string in format: iv:authTag:encrypted
 */
export function encryptSmtpPassword(password: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Return iv:authTag:encrypted for storage
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt SMTP password using AES-256-GCM
 * @param encryptedPassword - Encrypted string in format: iv:authTag:encrypted
 * @returns Decrypted plain text password
 */
export function decryptSmtpPassword(encryptedPassword: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, encrypted] = encryptedPassword.split(':');
  
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted password format');
  }
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate a random encryption key for environment variable
 * Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
