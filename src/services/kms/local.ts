import { randomBytes } from "crypto";
import { BaseKmsProvider } from "./base";
import { aesDecrypt, aesEncrypt, AesKey } from "../crypto.service";

export class LocalKmsProvider extends BaseKmsProvider {

  private masterKey: AesKey;

  constructor() {
    super();

    // Hardcoded master key and iv for testing
    const masterKey = Buffer
      .from('2e1f761f30487e5d032c49f1002887a3a54485ce93b3ba32bddb94515ce3895f', 'hex')
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
    const result = aesEncrypt(vaultKey, this.masterKey);

    // Return encrypted vault key and iv
    return {
      key: result,
      iv: vaultIv,
    };
  }

  async decryptVaultKey(encryptedKey: string, iv: string): Promise<AesKey> {
    // Decrypt vault key with master key
    const decryptedKey = aesDecrypt(Buffer.from(encryptedKey, 'base64'), this.masterKey);

    // Return decrypted vault key
    return {
      key: decryptedKey,
      iv: Buffer.from(iv, 'base64'),
    };
  }
}
