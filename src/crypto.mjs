import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

export function encryptAES (text, key) {
  const keyBuffer = Buffer.alloc(32);
  keyBuffer.write(key);

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

export function decryptAES(encryptedText, key) {
  const keyBuffer = Buffer.alloc(32);
  keyBuffer.write(key);

  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

