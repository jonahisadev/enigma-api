import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';

// Mock the AWS SDK KMS Client
jest.mock('@aws-sdk/client-kms', () => {
  const mockSend = jest.fn();
  return {
    KMSClient: jest.fn(() => ({
      send: mockSend,
    })),
    GenerateDataKeyCommand: jest.fn(),
    DecryptCommand: jest.fn(),
  };
});

// Mock crypto.randomBytes
jest.mock('crypto', () => ({
  randomBytes: jest.fn((size: number) => Buffer.alloc(size, 'a')),
}));

// Import after mocks are set up
import { AwsKmsProvider, createKmsClient } from '../../services/kms/aws';

describe('AwsKmsProvider', () => {
  let provider: AwsKmsProvider;
  let mockKmsClient: any;
  const TEST_KMS_KEY_ID = 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012';

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset environment variables
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.AWS_ACCESS_KEY_ID_FILE;
    delete process.env.AWS_SECRET_ACCESS_KEY_FILE;

    // Reset the static kmsClient by clearing the class (hack for testing)
    // This ensures each test gets a fresh client
    (AwsKmsProvider as any).kmsClient = undefined;

    // Get the mocked KMSClient instance
    provider = new AwsKmsProvider(TEST_KMS_KEY_ID);
    const KMSClientMock = KMSClient as jest.MockedClass<typeof KMSClient>;
    mockKmsClient = KMSClientMock.mock.results[KMSClientMock.mock.results.length - 1].value;
  });

  describe('constructor', () => {
    it('should initialize with provided KMS key ID and create KMS client', () => {
      const testProvider = new AwsKmsProvider(TEST_KMS_KEY_ID);

      expect(testProvider).toBeInstanceOf(AwsKmsProvider);
      // createKmsClient is called internally, which creates a KMSClient
      expect(KMSClient).toHaveBeenCalled();
    });

    it('should create KMS client with default region when AWS_REGION is not set', () => {
      // Clear mocks and reset static client
      jest.clearAllMocks();
      (AwsKmsProvider as any).kmsClient = undefined;

      new AwsKmsProvider(TEST_KMS_KEY_ID);

      expect(KMSClient).toHaveBeenCalledWith({
        region: 'us-east-1',
      });
    });

    it('should create KMS client with AWS_REGION environment variable when set', () => {
      // Clear mocks and reset static client
      jest.clearAllMocks();
      (AwsKmsProvider as any).kmsClient = undefined;

      process.env.AWS_REGION = 'eu-west-1';

      new AwsKmsProvider(TEST_KMS_KEY_ID);

      expect(KMSClient).toHaveBeenCalledWith({
        region: 'eu-west-1',
      });
    });

    it('should throw error when kmsKeyId is empty string', () => {
      expect(() => {
        new AwsKmsProvider('');
      }).toThrow('KMS Key ID must be provided for AWS KMS Provider');
    });

    it('should throw error when kmsKeyId is whitespace only', () => {
      expect(() => {
        new AwsKmsProvider('   ');
      }).toThrow('KMS Key ID must be provided for AWS KMS Provider');

      expect(() => {
        new AwsKmsProvider('\t\n');
      }).toThrow('KMS Key ID must be provided for AWS KMS Provider');
    });

    it('should accept kmsKeyId with leading/trailing whitespace after trim', () => {
      // Note: The implementation trims before checking length, so this should fail
      // because ' ' becomes '' after trim
      expect(() => {
        new AwsKmsProvider(' ');
      }).toThrow('KMS Key ID must be provided for AWS KMS Provider');
    });

    it('should create KMS client only once (singleton pattern)', () => {
      // Clear previous calls
      jest.clearAllMocks();
      (AwsKmsProvider as any).kmsClient = undefined;

      // Create first provider
      const provider1 = new AwsKmsProvider(TEST_KMS_KEY_ID);
      expect(KMSClient).toHaveBeenCalledTimes(1);

      // Create second provider - should reuse existing client
      const provider2 = new AwsKmsProvider('another-key-id');
      expect(KMSClient).toHaveBeenCalledTimes(1); // Still 1, not 2

      // Both providers should exist
      expect(provider1).toBeInstanceOf(AwsKmsProvider);
      expect(provider2).toBeInstanceOf(AwsKmsProvider);
    });

    it('should reuse static KMS client across multiple instances', () => {
      jest.clearAllMocks();
      (AwsKmsProvider as any).kmsClient = undefined;

      // Create multiple providers
      new AwsKmsProvider('key-1');
      new AwsKmsProvider('key-2');
      new AwsKmsProvider('key-3');

      // KMSClient constructor should only be called once
      expect(KMSClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateVaultKey', () => {
    it('should successfully generate a vault key with encrypted data key and IV', async () => {
      // Arrange: Mock AWS KMS GenerateDataKey response
      const mockCiphertextBlob = Buffer.from('encrypted-data-key-from-kms');
      mockKmsClient.send.mockResolvedValueOnce({
        CiphertextBlob: new Uint8Array(mockCiphertextBlob),
        Plaintext: new Uint8Array(Buffer.from('plaintext-key')), // Not used in our implementation
        KeyId: TEST_KMS_KEY_ID,
      });

      // Act: Generate vault key
      const result = await provider.generateVaultKey();

      // Assert: Verify KMS was called correctly
      expect(GenerateDataKeyCommand).toHaveBeenCalledWith({
        KeyId: TEST_KMS_KEY_ID,
        KeySpec: 'AES_256',
      });
      expect(mockKmsClient.send).toHaveBeenCalledTimes(1);

      // Assert: Verify returned structure
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('iv');
      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(Buffer.isBuffer(result.iv)).toBe(true);

      // The key should be the CiphertextBlob (encrypted data key)
      expect(result.key).toEqual(mockCiphertextBlob);

      // The IV should be 16 bytes
      expect(result.iv.length).toBe(16);
    });

    it('should throw error when AWS KMS fails to generate data key', async () => {
      // Arrange: Mock AWS KMS failure (no CiphertextBlob in response)
      mockKmsClient.send.mockResolvedValueOnce({
        CiphertextBlob: undefined,
        KeyId: TEST_KMS_KEY_ID,
      });

      // Act & Assert: Should throw error
      await expect(provider.generateVaultKey()).rejects.toThrow(
        'Failed to generate vault key in AWS KMS'
      );
    });

    it('should throw error when AWS KMS send fails', async () => {
      // Arrange: Mock AWS KMS client error
      const kmsError = new Error('KMS service unavailable');
      mockKmsClient.send.mockRejectedValueOnce(kmsError);

      // Act & Assert: Should propagate error
      await expect(provider.generateVaultKey()).rejects.toThrow('KMS service unavailable');
    });
  });

  describe('decryptVaultKey', () => {
    it('should successfully decrypt a vault key', async () => {
      // Arrange: Mock encrypted key and IV
      const encryptedKey = Buffer.from('encrypted-vault-key').toString('base64');
      const iv = Buffer.from('1234567890abcdef').toString('base64');

      const mockPlaintextKey = Buffer.from('decrypted-plaintext-key-32bytes');
      mockKmsClient.send.mockResolvedValueOnce({
        Plaintext: new Uint8Array(mockPlaintextKey),
        KeyId: TEST_KMS_KEY_ID,
        EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
      });

      // Act: Decrypt vault key
      const result = await provider.decryptVaultKey(encryptedKey, iv);

      // Assert: Verify KMS was called correctly
      expect(DecryptCommand).toHaveBeenCalledWith({
        KeyId: TEST_KMS_KEY_ID,
        CiphertextBlob: Buffer.from(encryptedKey, 'base64'),
        EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
      });
      expect(mockKmsClient.send).toHaveBeenCalledTimes(1);

      // Assert: Verify returned structure
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('iv');
      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(Buffer.isBuffer(result.iv)).toBe(true);

      // The key should be the decrypted plaintext
      expect(result.key).toEqual(mockPlaintextKey);

      // The IV should match the input
      expect(result.iv).toEqual(Buffer.from(iv, 'base64'));
    });

    it('should handle base64 encoded inputs correctly', async () => {
      // Arrange: Create base64 encoded inputs
      const rawKey = Buffer.from('my-encrypted-key');
      const rawIv = Buffer.from('my-iv-16-bytes!!');
      const encryptedKey = rawKey.toString('base64');
      const iv = rawIv.toString('base64');

      const mockPlaintextKey = Buffer.from('plaintext-key');
      mockKmsClient.send.mockResolvedValueOnce({
        Plaintext: new Uint8Array(mockPlaintextKey),
        KeyId: TEST_KMS_KEY_ID,
      });

      // Act
      const result = await provider.decryptVaultKey(encryptedKey, iv);

      // Assert: Verify base64 decoding happened correctly
      expect(DecryptCommand).toHaveBeenCalledWith({
        KeyId: TEST_KMS_KEY_ID,
        CiphertextBlob: rawKey,
        EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
      });
      expect(result.iv).toEqual(rawIv);
    });

    it('should throw error when AWS KMS fails to decrypt', async () => {
      // Arrange: Mock AWS KMS failure (no Plaintext in response)
      mockKmsClient.send.mockResolvedValueOnce({
        Plaintext: undefined,
        KeyId: TEST_KMS_KEY_ID,
      });

      const encryptedKey = Buffer.from('encrypted-key').toString('base64');
      const iv = Buffer.from('iv-16-bytes!!!!!').toString('base64');

      // Act & Assert: Should throw error
      await expect(provider.decryptVaultKey(encryptedKey, iv)).rejects.toThrow(
        'Failed to decrypt vault key in AWS KMS'
      );
    });

    it('should throw error when AWS KMS decrypt fails', async () => {
      // Arrange: Mock AWS KMS client error
      const kmsError = new Error('Access denied');
      mockKmsClient.send.mockRejectedValueOnce(kmsError);

      const encryptedKey = Buffer.from('encrypted-key').toString('base64');
      const iv = Buffer.from('iv-16-bytes!!!!!').toString('base64');

      // Act & Assert: Should propagate error
      await expect(provider.decryptVaultKey(encryptedKey, iv)).rejects.toThrow('Access denied');
    });

    it('should handle invalid base64 input', async () => {
      // Arrange: Invalid base64 strings
      const invalidBase64 = 'not-valid-base64!!!';
      const validIv = Buffer.from('valid-iv-16bytes').toString('base64');

      // Act & Assert: Should throw error when Buffer.from fails
      await expect(async () => {
        await provider.decryptVaultKey(invalidBase64, validIv);
      }).rejects.toThrow();
    });
  });

  describe('integration with base class', () => {
    it('should implement all required BaseKmsProvider methods', () => {
      expect(provider.generateVaultKey).toBeDefined();
      expect(provider.decryptVaultKey).toBeDefined();
      expect(typeof provider.generateVaultKey).toBe('function');
      expect(typeof provider.decryptVaultKey).toBe('function');
    });
  });

  describe('round-trip encryption', () => {
    it('should generate and decrypt keys in a realistic flow', async () => {
      // Arrange: Simulate full KMS round-trip
      const mockEncryptedDataKey = Buffer.from('kms-encrypted-data-key');
      const mockPlaintextDataKey = Buffer.from('plaintext-data-key-32-bytes!!');

      // Mock GenerateDataKey
      mockKmsClient.send.mockResolvedValueOnce({
        CiphertextBlob: new Uint8Array(mockEncryptedDataKey),
        Plaintext: new Uint8Array(mockPlaintextDataKey),
        KeyId: TEST_KMS_KEY_ID,
      });

      // Act: Generate vault key
      const generatedKey = await provider.generateVaultKey();

      // Assert: Key should be the encrypted data key
      expect(generatedKey.key).toEqual(mockEncryptedDataKey);

      // Arrange: Mock DecryptDataKey for decryption
      mockKmsClient.send.mockResolvedValueOnce({
        Plaintext: new Uint8Array(mockPlaintextDataKey),
        KeyId: TEST_KMS_KEY_ID,
      });

      // Act: Decrypt the vault key
      const encryptedKeyBase64 = generatedKey.key.toString('base64');
      const ivBase64 = generatedKey.iv.toString('base64');
      const decryptedKey = await provider.decryptVaultKey(encryptedKeyBase64, ivBase64);

      // Assert: Decrypted key should match the plaintext data key
      expect(decryptedKey.key).toEqual(mockPlaintextDataKey);
      expect(decryptedKey.iv).toEqual(generatedKey.iv);
    });
  });
});
