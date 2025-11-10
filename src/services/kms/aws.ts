import { BaseKmsProvider } from "./base";
import { AesKey } from "../crypto.service";

export class AwsKmsProvider extends BaseKmsProvider {

  private kmsKeyId: string;

  constructor(kmsKeyId: string) {
    super();
  }

  async generateVaultKey(): Promise<AesKey> {
    throw new Error("Method not implemented.");
  }

  async decryptVaultKey(_encryptedKey: string, _iv: string): Promise<AesKey> {
    throw new Error("Method not implemented.");
  }

}
