
export interface AesKey {
  key: Buffer;
  iv: Buffer;
}

export abstract class BaseKmsProvider {

  constructor() { }

  abstract generateVaultKey(): Promise<AesKey>;
  abstract decryptVaultKey(encryptedKey: string): Promise<Buffer>;

}
