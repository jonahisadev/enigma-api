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
  KMSClient
} from '@aws-sdk/client-kms';

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
      AwsKmsProvider.kmsClient = new KMSClient({
        region: process.env.AWS_REGION || 'us-east-1',
      });
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
  const client = new KMSClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });

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
