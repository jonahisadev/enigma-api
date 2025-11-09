import { BaseKmsProvider, AesKey } from "./base";

export class AwsKmsProvider extends BaseKmsProvider {

  constructor() {
    super();
  }

  async generateVaultKey(): Promise<AesKey> {
    throw new Error("Method not implemented.");
  }

  async decryptVaultKey(_encryptedKey: string): Promise<Buffer> {
    throw new Error("Method not implemented.");
  }

}
