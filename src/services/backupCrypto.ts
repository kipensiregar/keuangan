/** Password-encrypted backup envelope for Warung Medan Finance. */
const BACKUP_MAGIC = 'WMF-ENCRYPTED-BACKUP';
const BACKUP_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;

type EncryptedBackupEnvelope = {
  magic: typeof BACKUP_MAGIC;
  version: typeof BACKUP_VERSION;
  kdf: 'PBKDF2-SHA-256';
  cipher: 'AES-GCM-256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!password || password.length < 12) {
    throw new Error('Kata sandi backup minimal 12 karakter.');
  }
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
    name: 'PBKDF2',
    salt: Uint8Array.from(salt).buffer,
    iterations: PBKDF2_ITERATIONS,
    hash: 'SHA-256'
    },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackup(plaintext: string, password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Enkripsi membutuhkan browser modern dan konteks aman HTTPS atau localhost.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)
  );
  const envelope: EncryptedBackupEnvelope = {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    kdf: 'PBKDF2-SHA-256',
    cipher: 'AES-GCM-256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted))
  };
  return JSON.stringify(envelope, null, 2);
}

export function isEncryptedBackup(content: string): boolean {
  try {
    return JSON.parse(content)?.magic === BACKUP_MAGIC;
  } catch {
    return false;
  }
}

export async function decryptBackup(content: string, password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Dekripsi membutuhkan browser modern dan konteks aman HTTPS atau localhost.');
  }
  let envelope: EncryptedBackupEnvelope;
  try {
    envelope = JSON.parse(content) as EncryptedBackupEnvelope;
  } catch {
    throw new Error('Format backup terenkripsi tidak valid.');
  }
  if (envelope.magic !== BACKUP_MAGIC || envelope.version !== BACKUP_VERSION ||
      envelope.kdf !== 'PBKDF2-SHA-256' || envelope.cipher !== 'AES-GCM-256') {
    throw new Error('Format atau versi backup terenkripsi tidak didukung.');
  }
  if (envelope.iterations !== PBKDF2_ITERATIONS) {
    throw new Error('Parameter keamanan backup tidak valid.');
  }
  try {
    const key = await deriveKey(password, fromBase64(envelope.salt));
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ciphertext)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Kata sandi salah atau file backup rusak. Database tidak diubah.');
  }
}
