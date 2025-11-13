import { AwsKmsProvider, createAwsAccountKey } from "./aws";
import { BaseKmsProvider } from "./base";
import { LocalKmsProvider } from "./local";


export class KmsFactory {
  static createProvider(type: string, kmsKeyId: string): BaseKmsProvider {
    switch (type) {
      case 'aws':
        return new AwsKmsProvider(kmsKeyId);
      case 'local':
        return new LocalKmsProvider();
      default:
        throw new Error(`Unsupported KMS provider type: ${type}`);
    }
  }

  static async createAccountKey(type: string): Promise<string> {
    switch (type) {
      case 'local':
        return Promise.resolve('not-needed');
      case 'aws':
        return await createAwsAccountKey();
      default:
        throw new Error(`Unsupported KMS provider type`);
    }
  }
}
