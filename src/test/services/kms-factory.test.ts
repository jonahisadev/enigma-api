import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { KmsFactory } from '../../services/kms/factory';
import { BaseKmsProvider } from '../../services/kms/base';
import { AwsKmsProvider } from '../../services/kms/aws';
import { LocalKmsProvider } from '../../services/kms/local';

// Mock the KMS providers
jest.mock('../../services/kms/aws');
jest.mock('../../services/kms/local');

// Mock AWS SDK to prevent actual initialization
jest.mock('@aws-sdk/client-kms', () => ({
  KMSClient: jest.fn(() => ({
    send: jest.fn(),
  })),
  GenerateDataKeyCommand: jest.fn(),
  DecryptCommand: jest.fn(),
}));

// Mock crypto for LocalKmsProvider
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,
    randomBytes: jest.fn((size: number) => Buffer.alloc(size, 'a')),
  };
});

// Mock crypto service for LocalKmsProvider
jest.mock('../../services/crypto.service', () => ({
  aesEncrypt: jest.fn(),
  aesDecrypt: jest.fn(),
}));

describe('KmsFactory', () => {
  const TEST_KMS_KEY_ID = 'test-kms-key-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProvider', () => {
    it('should create an AWS KMS provider when type is "aws"', () => {
      // Act
      const provider = KmsFactory.createProvider('aws', TEST_KMS_KEY_ID);

      // Assert
      expect(AwsKmsProvider).toHaveBeenCalledWith(TEST_KMS_KEY_ID);
      expect(provider).toBeInstanceOf(AwsKmsProvider);
    });

    it('should create a Local KMS provider when type is "local"', () => {
      // Act
      const provider = KmsFactory.createProvider('local', TEST_KMS_KEY_ID);

      // Assert
      expect(LocalKmsProvider).toHaveBeenCalledWith();
      expect(provider).toBeInstanceOf(LocalKmsProvider);
    });

    it('should pass kmsKeyId to AWS provider constructor', () => {
      // Arrange
      const customKeyId = 'arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012';

      // Act
      KmsFactory.createProvider('aws', customKeyId);

      // Assert
      expect(AwsKmsProvider).toHaveBeenCalledWith(customKeyId);
      expect(AwsKmsProvider).toHaveBeenCalledTimes(1);
    });

    it('should not pass kmsKeyId to Local provider constructor', () => {
      // Act
      KmsFactory.createProvider('local', TEST_KMS_KEY_ID);

      // Assert
      // LocalKmsProvider constructor takes no parameters
      expect(LocalKmsProvider).toHaveBeenCalledWith();
      expect(LocalKmsProvider).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unsupported provider type', () => {
      // Arrange
      const unsupportedType = 'azure';

      // Act & Assert
      expect(() => {
        KmsFactory.createProvider(unsupportedType, TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: azure');
    });

    it('should throw error for empty provider type', () => {
      // Act & Assert
      expect(() => {
        KmsFactory.createProvider('', TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: ');
    });

    it('should throw error for null provider type', () => {
      // Act & Assert
      expect(() => {
        KmsFactory.createProvider(null as any, TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: null');
    });

    it('should throw error for undefined provider type', () => {
      // Act & Assert
      expect(() => {
        KmsFactory.createProvider(undefined as any, TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: undefined');
    });

    it('should be case-sensitive for provider type', () => {
      // Act & Assert: Uppercase should fail
      expect(() => {
        KmsFactory.createProvider('AWS', TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: AWS');

      expect(() => {
        KmsFactory.createProvider('Local', TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: Local');

      expect(() => {
        KmsFactory.createProvider('LOCAL', TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: LOCAL');
    });

    it('should return instances that implement BaseKmsProvider interface', () => {
      // Act
      const awsProvider = KmsFactory.createProvider('aws', TEST_KMS_KEY_ID);
      const localProvider = KmsFactory.createProvider('local', TEST_KMS_KEY_ID);

      // Assert: Check that both providers have the required methods
      expect(awsProvider).toHaveProperty('generateVaultKey');
      expect(awsProvider).toHaveProperty('decryptVaultKey');
      expect(typeof awsProvider.generateVaultKey).toBe('function');
      expect(typeof awsProvider.decryptVaultKey).toBe('function');

      expect(localProvider).toHaveProperty('generateVaultKey');
      expect(localProvider).toHaveProperty('decryptVaultKey');
      expect(typeof localProvider.generateVaultKey).toBe('function');
      expect(typeof localProvider.decryptVaultKey).toBe('function');
    });

    it('should create new instances on each call', () => {
      // Act
      const provider1 = KmsFactory.createProvider('local', TEST_KMS_KEY_ID);
      const provider2 = KmsFactory.createProvider('local', TEST_KMS_KEY_ID);

      // Assert: Should be different instances (not singleton)
      expect(provider1).not.toBe(provider2);
      expect(LocalKmsProvider).toHaveBeenCalledTimes(2);
    });

    it('should handle different AWS KMS key IDs', () => {
      // Arrange
      const keyId1 = 'key-id-1';
      const keyId2 = 'arn:aws:kms:eu-west-1:123456789012:key/abcdef';

      // Act
      KmsFactory.createProvider('aws', keyId1);
      KmsFactory.createProvider('aws', keyId2);

      // Assert
      expect(AwsKmsProvider).toHaveBeenNthCalledWith(1, keyId1);
      expect(AwsKmsProvider).toHaveBeenNthCalledWith(2, keyId2);
    });
  });

  describe('static class behavior', () => {
    it('should not require instantiation', () => {
      // Act & Assert: Should work without creating instance
      expect(() => {
        KmsFactory.createProvider('local', TEST_KMS_KEY_ID);
      }).not.toThrow();

      // Factory pattern should not require new KmsFactory()
      const provider = KmsFactory.createProvider('aws', TEST_KMS_KEY_ID);
      expect(provider).toBeDefined();
    });

    it('should not be instantiable (static class)', () => {
      // Note: In TypeScript, we can still instantiate classes with only static methods
      // but it's a pattern indicator that it shouldn't be
      const factory = new KmsFactory();
      expect(factory).toBeInstanceOf(KmsFactory);

      // But the instance won't have the createProvider method
      expect((factory as any).createProvider).toBeUndefined();
    });
  });

  describe('error messages', () => {
    it('should include the invalid provider type in error message', () => {
      // Arrange
      const invalidTypes = ['gcp', 'vault', 'custom-kms', '123', 'aws-kms'];

      // Act & Assert
      invalidTypes.forEach((type) => {
        expect(() => {
          KmsFactory.createProvider(type, TEST_KMS_KEY_ID);
        }).toThrow(`Unsupported KMS provider type: ${type}`);
      });
    });

    it('should provide clear error for typos', () => {
      // Common typos
      expect(() => {
        KmsFactory.createProvider('awss', TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: awss');

      expect(() => {
        KmsFactory.createProvider('locall', TEST_KMS_KEY_ID);
      }).toThrow('Unsupported KMS provider type: locall');
    });
  });

  describe('integration scenarios', () => {
    it('should support switching between provider types', () => {
      // Act: Create different providers in sequence
      const awsProvider1 = KmsFactory.createProvider('aws', 'key-1');
      const localProvider = KmsFactory.createProvider('local', 'key-2');
      const awsProvider2 = KmsFactory.createProvider('aws', 'key-3');

      // Assert: All should be created successfully
      expect(awsProvider1).toBeInstanceOf(AwsKmsProvider);
      expect(localProvider).toBeInstanceOf(LocalKmsProvider);
      expect(awsProvider2).toBeInstanceOf(AwsKmsProvider);

      // Verify call counts
      expect(AwsKmsProvider).toHaveBeenCalledTimes(2);
      expect(LocalKmsProvider).toHaveBeenCalledTimes(1);
    });

    it('should delegate validation to AWS provider for empty kmsKeyId', () => {
      // Arrange: Mock AWS provider to throw error for empty key ID
      (AwsKmsProvider as jest.MockedClass<typeof AwsKmsProvider>).mockImplementationOnce(() => {
        throw new Error('KMS Key ID must be provided for AWS KMS Provider');
      });

      // Act & Assert: Factory should pass empty string, AWS provider validates
      expect(() => {
        KmsFactory.createProvider('aws', '');
      }).toThrow('KMS Key ID must be provided for AWS KMS Provider');

      expect(AwsKmsProvider).toHaveBeenCalledWith('');
    });
  });
});
