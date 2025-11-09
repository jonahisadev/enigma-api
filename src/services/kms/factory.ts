import { AwsKmsProvider } from "./aws";
import { BaseKmsProvider } from "./base";
import { LocalKmsProvider } from "./local";


export class KmsFactory {
  static createProvider(type: string): BaseKmsProvider {
    switch (type) {
      case 'aws':
        return new AwsKmsProvider();
      case 'local':
        return new LocalKmsProvider();
      default:
        throw new Error(`Unsupported KMS provider type: ${type}`);
    }
  }
}
