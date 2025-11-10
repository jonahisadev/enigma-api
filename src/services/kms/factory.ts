import { AwsKmsProvider } from "./aws";
import { BaseKmsProvider } from "./base";
import { LocalKmsProvider } from "./local";


export class KmsFactory {
  static createProvider(type: string, kmsKeyId?: string): BaseKmsProvider {
    switch (type) {
      case 'aws':
        if (!kmsKeyId) {
          throw new Error('KMS Key ID is required for AWS KMS provider');
        }
        return new AwsKmsProvider(kmsKeyId);
      case 'local':
        return new LocalKmsProvider();
      default:
        throw new Error(`Unsupported KMS provider type: ${type}`);
    }
  }
}
