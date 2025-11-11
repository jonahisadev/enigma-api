import { createCipheriv, createDecipheriv } from 'crypto';

export interface AesKey {
  key: Buffer;
  iv: Buffer;
}

export const aesEncrypt = (data: Buffer, key: AesKey): Buffer => {
  const cipher = createCipheriv('aes-256-cbc', key.key, key.iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return encrypted;
};

export const aesDecrypt = (data: Buffer, key: AesKey): Buffer => {
  const decipher = createDecipheriv('aes-256-cbc', key.key, key.iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted;
};
