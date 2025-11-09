import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { BaseKmsProvider, AesKey } from "./base";

export class LocalKmsProvider extends BaseKmsProvider {

  private masterKey: AesKey;

  constructor() {
    super();

    const masterKey = Buffer
      .from('734D2C602B4141344B6F4C32475D212842607A70264268442F6C6C735929287C', 'hex')
    const masterIv = Buffer
      .from('8647ebebf1a43832709699b45ee7278d', 'hex')

    this.masterKey = {
      key: masterKey,
      iv: masterIv,
    };
  }

  async generateVaultKey(): Promise<AesKey> {
    // Generate vault key and iv
    const vaultKey = randomBytes(32);
    const vaultIv = randomBytes(16);

    // Encrypt vault key with master key
    const cipher = createCipheriv('aes-256-cbc', this.masterKey.key, this.masterKey.iv);
    cipher.update(vaultKey);
    const result = cipher.final();

    // Return encrypted vault key and iv
    return {
      key: result,
      iv: vaultIv,
    };
  }

  async decryptVaultKey(encryptedKey: string): Promise<Buffer> {
    // Decrypt vault key with master key
    const cipher = createDecipheriv('aes-256-cbc', this.masterKey.key, this.masterKey.iv);
    const encryptedKeyBuffer = Buffer.from(encryptedKey, 'base64');
    cipher.update(encryptedKeyBuffer);
    const decryptedKey = cipher.final();

    // Return decrypted vault key
    return decryptedKey;
  }
}
