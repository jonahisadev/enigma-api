import { BaseKmsProvider } from "./base";
import { AesKey } from "../crypto.service";
import { randomBytes } from "crypto";
import {
  CreateKeyCommand,
  CreateKeyCommandInput,
  DecryptCommand,
  DecryptCommandInput,
  GenerateDataKeyCommand,
  GenerateDataKeyCommandInput,
  KMSClient,
  KMSClientConfig
} from '@aws-sdk/client-kms';
import { loadSecret } from "../../utils/config";

/**
 * Create a KMS client with credentials loaded from file-based or direct environment variables.
 * Supports Docker secrets pattern where secrets are mounted as files.
 *
 * @returns Configured KMSClient instance
 */
export function createKmsClient(): KMSClient {
  // Load AWS credentials from file-based or direct environment variables
  const accessKeyId = loadSecret('AWS_ACCESS_KEY_ID', 'AWS_ACCESS_KEY_ID_FILE');
  const secretAccessKey = loadSecret('AWS_SECRET_ACCESS_KEY', 'AWS_SECRET_ACCESS_KEY_FILE');

  // Build KMS client configuration
  const clientConfig: KMSClientConfig = {
    region: process.env.AWS_REGION || 'us-east-1',
  };

  // Only add credentials if both are present, otherwise rely on AWS SDK default credential chain
  if (accessKeyId && secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId,
      secretAccessKey,
    };
  }

  return new KMSClient(clientConfig);
}

export class AwsKmsProvider extends BaseKmsProvider {

  private kmsKeyId: string;
  private static kmsClient: KMSClient;

  constructor(kmsKeyId: string) {
    super();

    if (kmsKeyId.trim().length === 0) {
      throw new Error("KMS Key ID must be provided for AWS KMS Provider");
    }

    this.kmsKeyId = kmsKeyId;
    if (!AwsKmsProvider.kmsClient) {
      AwsKmsProvider.kmsClient = createKmsClient();
    }
  }

  private async generateDataKey(): Promise<Buffer> {
    const input: GenerateDataKeyCommandInput = {
      KeyId: this.kmsKeyId,
      KeySpec: 'AES_256'
    };
    const res = await AwsKmsProvider.kmsClient.send(new GenerateDataKeyCommand(input));

    if (!res.CiphertextBlob) {
      throw new Error("Failed to generate vault key in AWS KMS");
    }

    return Buffer.from(res.CiphertextBlob);
  }

  private async decryptDataKey(encryptedKey: Buffer): Promise<Buffer> {
    const input: DecryptCommandInput = {
      KeyId: this.kmsKeyId,
      CiphertextBlob: encryptedKey,
      EncryptionAlgorithm: 'SYMMETRIC_DEFAULT'
    };

    const res = await AwsKmsProvider.kmsClient.send(new DecryptCommand(input));

    if (!res.Plaintext) {
      throw new Error("Failed to decrypt vault key in AWS KMS");
    }

    return Buffer.from(res.Plaintext);
  }

  async generateVaultKey(): Promise<AesKey> {
    const vaultKey = await this.generateDataKey();
    const vaultIv = randomBytes(16);

    return {
      key: vaultKey,
      iv: vaultIv
    };
  }

  async decryptVaultKey(encryptedKey: string, iv: string): Promise<AesKey> {
    const vaultKey = await this.decryptDataKey(Buffer.from(encryptedKey, 'base64'));

    return {
      key: vaultKey,
      iv: Buffer.from(iv, 'base64')
    };
  }

}

export const createAwsAccountKey = async (): Promise<string> => {
  const client = createKmsClient();

  const input: CreateKeyCommandInput = {
    KeySpec: 'SYMMETRIC_DEFAULT',
    KeyUsage: 'ENCRYPT_DECRYPT',
  };

  let results;
  try {
    results = await client.send(new CreateKeyCommand(input));

    if (!results.KeyMetadata || !results.KeyMetadata.KeyId) {
      throw new Error("Invalid response from AWS KMS when creating key");
    }
  } catch (error) {
    throw new Error(`Failed to create AWS KMS Key: ${error}`);
  }

  return results.KeyMetadata.KeyId;
};
