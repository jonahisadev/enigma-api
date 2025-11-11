import { AesKey } from '../crypto.service';

export abstract class BaseKmsProvider {

  constructor() { }

  abstract generateVaultKey(): Promise<AesKey>;
  abstract decryptVaultKey(encryptedKey: string, iv: string): Promise<AesKey>;

}
