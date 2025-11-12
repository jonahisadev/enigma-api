import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LocalKmsProvider } from '../../services/kms/local';
import * as crypto from 'crypto';

// Mock crypto.randomBytes
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof crypto>('crypto');
  return {
    ...actual,
    randomBytes: jest.fn((size: number) => {
      // Return predictable bytes for testing
      return Buffer.alloc(size, size === 32 ? 'k' : 'i');
    }),
  };
});

// Mock the crypto service functions
jest.mock('../../services/crypto.service', () => ({
  aesEncrypt: jest.fn(),
  aesDecrypt: jest.fn(),
}));

import { aesEncrypt, aesDecrypt } from '../../services/crypto.service';

describe('LocalKmsProvider', () => {
  let provider: LocalKmsProvider;
  const MASTER_KEY = Buffer.from('2e1f761f30487e5d032c49f1002887a3a54485ce93b3ba32bddb94515ce3895f', 'hex');
  const MASTER_IV = Buffer.from('8647ebebf1a43832709699b45ee7278d', 'hex');

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LocalKmsProvider();
  });

  describe('constructor', () => {
    it('should initialize with hardcoded master key and IV', () => {
      const testProvider = new LocalKmsProvider();

      expect(testProvider).toBeInstanceOf(LocalKmsProvider);
    });

    it('should always use the same master key for consistency', () => {
      // Create multiple instances
      const provider1 = new LocalKmsProvider();
      const provider2 = new LocalKmsProvider();

      // Both should be valid instances (we can't directly access private masterKey)
      expect(provider1).toBeInstanceOf(LocalKmsProvider);
      expect(provider2).toBeInstanceOf(LocalKmsProvider);
    });
  });

  describe('generateVaultKey', () => {
    it('should generate a vault key with random key and IV', async () => {
      // Arrange: Mock aesEncrypt to return encrypted key
      const mockEncryptedKey = Buffer.from('encrypted-vault-key');
      (aesEncrypt as jest.Mock).mockReturnValueOnce(mockEncryptedKey);

      // Act: Generate vault key
      const result = await provider.generateVaultKey();

      // Assert: Verify crypto.randomBytes was called correctly
      expect(crypto.randomBytes).toHaveBeenCalledTimes(2);
      expect(crypto.randomBytes).toHaveBeenNthCalledWith(1, 32); // vault key (32 bytes)
      expect(crypto.randomBytes).toHaveBeenNthCalledWith(2, 16); // vault IV (16 bytes)

      // Assert: Verify aesEncrypt was called with generated vault key and master key
      expect(aesEncrypt).toHaveBeenCalledTimes(1);
      const encryptCall = (aesEncrypt as jest.Mock).mock.calls[0];
      expect(encryptCall[0]).toEqual(Buffer.alloc(32, 'k')); // Generated vault key
      expect(encryptCall[1]).toEqual({
        key: MASTER_KEY,
        iv: MASTER_IV,
      });

      // Assert: Verify returned structure
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('iv');
      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(Buffer.isBuffer(result.iv)).toBe(true);

      // The key should be the encrypted vault key
      expect(result.key).toEqual(mockEncryptedKey);

      // The IV should be 16 bytes
      expect(result.iv).toEqual(Buffer.alloc(16, 'i'));
    });

    it('should generate different keys on multiple calls', async () => {
      // Arrange: Mock randomBytes to return different values
      const mockRandomBytes = crypto.randomBytes as jest.Mock;
      mockRandomBytes
        .mockReturnValueOnce(Buffer.from('key1-32-bytes-long-for-aes-256!'))
        .mockReturnValueOnce(Buffer.from('iv1-16-bytes-!!!'))
        .mockReturnValueOnce(Buffer.from('key2-32-bytes-long-for-aes-256!'))
        .mockReturnValueOnce(Buffer.from('iv2-16-bytes-!!!'));

      (aesEncrypt as jest.Mock)
        .mockReturnValueOnce(Buffer.from('encrypted-key-1'))
        .mockReturnValueOnce(Buffer.from('encrypted-key-2'));

      // Act: Generate two vault keys
      const result1 = await provider.generateVaultKey();
      const result2 = await provider.generateVaultKey();

      // Assert: Keys should be different
      expect(result1.key).not.toEqual(result2.key);
      expect(result1.iv).not.toEqual(result2.iv);

      // Both should be valid
      expect(result1.key.length).toBeGreaterThan(0);
      expect(result2.key.length).toBeGreaterThan(0);
    });

    it('should encrypt vault key with master key', async () => {
      // Arrange
      const mockEncryptedKey = Buffer.from('encrypted-vault-key');
      (aesEncrypt as jest.Mock).mockReturnValueOnce(mockEncryptedKey);

      // Act
      await provider.generateVaultKey();

      // Assert: Verify master key was used for encryption
      expect(aesEncrypt).toHaveBeenCalledWith(
        expect.any(Buffer),
        {
          key: MASTER_KEY,
          iv: MASTER_IV,
        }
      );
    });
  });

  describe('decryptVaultKey', () => {
    it('should successfully decrypt a vault key', async () => {
      // Arrange: Mock encrypted key and IV
      const encryptedKey = Buffer.from('encrypted-vault-key').toString('base64');
      const iv = Buffer.from('1234567890abcdef').toString('base64');

      const mockDecryptedKey = Buffer.from('decrypted-vault-key-32-bytes!!!');
      (aesDecrypt as jest.Mock).mockReturnValueOnce(mockDecryptedKey);

      // Act: Decrypt vault key
      const result = await provider.decryptVaultKey(encryptedKey, iv);

      // Assert: Verify aesDecrypt was called correctly
      expect(aesDecrypt).toHaveBeenCalledTimes(1);
      expect(aesDecrypt).toHaveBeenCalledWith(
        Buffer.from(encryptedKey, 'base64'),
        {
          key: MASTER_KEY,
          iv: MASTER_IV,
        }
      );

      // Assert: Verify returned structure
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('iv');
      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(Buffer.isBuffer(result.iv)).toBe(true);

      // The key should be the decrypted plaintext
      expect(result.key).toEqual(mockDecryptedKey);

      // The IV should match the input
      expect(result.iv).toEqual(Buffer.from(iv, 'base64'));
    });

    it('should handle base64 encoded inputs correctly', async () => {
      // Arrange: Create base64 encoded inputs
      const rawKey = Buffer.from('my-encrypted-vault-key');
      const rawIv = Buffer.from('my-iv-16-bytes!!');
      const encryptedKey = rawKey.toString('base64');
      const iv = rawIv.toString('base64');

      const mockDecryptedKey = Buffer.from('decrypted-key');
      (aesDecrypt as jest.Mock).mockReturnValueOnce(mockDecryptedKey);

      // Act
      const result = await provider.decryptVaultKey(encryptedKey, iv);

      // Assert: Verify base64 decoding happened correctly
      expect(aesDecrypt).toHaveBeenCalledWith(
        rawKey,
        {
          key: MASTER_KEY,
          iv: MASTER_IV,
        }
      );
      expect(result.iv).toEqual(rawIv);
    });

    it('should decrypt vault key with master key', async () => {
      // Arrange
      const encryptedKey = Buffer.from('encrypted-key').toString('base64');
      const iv = Buffer.from('iv-16-bytes!!!!!').toString('base64');
      const mockDecryptedKey = Buffer.from('decrypted-key');

      (aesDecrypt as jest.Mock).mockReturnValueOnce(mockDecryptedKey);

      // Act
      await provider.decryptVaultKey(encryptedKey, iv);

      // Assert: Verify master key was used for decryption
      expect(aesDecrypt).toHaveBeenCalledWith(
        expect.any(Buffer),
        {
          key: MASTER_KEY,
          iv: MASTER_IV,
        }
      );
    });

    it('should handle decryption errors', async () => {
      // Arrange: Mock aesDecrypt to throw error
      const decryptError = new Error('Invalid key or corrupted data');
      (aesDecrypt as jest.Mock).mockImplementationOnce(() => {
        throw decryptError;
      });

      const encryptedKey = Buffer.from('bad-encrypted-key').toString('base64');
      const iv = Buffer.from('iv-16-bytes!!!!!').toString('base64');

      // Act & Assert: Should propagate error
      await expect(provider.decryptVaultKey(encryptedKey, iv)).rejects.toThrow(
        'Invalid key or corrupted data'
      );
    });

    it('should handle invalid base64 input', async () => {
      // Arrange: Invalid base64 strings
      const invalidBase64 = 'not-valid-base64!!!';
      const validIv = Buffer.from('valid-iv-16bytes').toString('base64');

      // Note: Buffer.from with 'base64' is actually quite forgiving and won't throw
      // for most invalid input, but we can test the behavior
      (aesDecrypt as jest.Mock).mockReturnValueOnce(Buffer.from('result'));

      // Act
      const result = await provider.decryptVaultKey(invalidBase64, validIv);

      // Assert: Should still attempt decryption (Buffer.from is forgiving)
      expect(result).toBeDefined();
      expect(aesDecrypt).toHaveBeenCalled();
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
      // Arrange: Setup mocks for round-trip
      const mockVaultKey = Buffer.from('vault-key-32-bytes-for-aes-256!');
      const mockVaultIv = Buffer.from('vault-iv-16bytes');
      const mockEncryptedKey = Buffer.from('encrypted-vault-key-by-master');

      (crypto.randomBytes as jest.Mock)
        .mockReturnValueOnce(mockVaultKey)
        .mockReturnValueOnce(mockVaultIv);

      (aesEncrypt as jest.Mock).mockReturnValueOnce(mockEncryptedKey);
      (aesDecrypt as jest.Mock).mockReturnValueOnce(mockVaultKey);

      // Act: Generate vault key
      const generatedKey = await provider.generateVaultKey();

      // Assert: Key should be encrypted
      expect(generatedKey.key).toEqual(mockEncryptedKey);
      expect(generatedKey.iv).toEqual(mockVaultIv);

      // Act: Decrypt the vault key
      const encryptedKeyBase64 = generatedKey.key.toString('base64');
      const ivBase64 = generatedKey.iv.toString('base64');
      const decryptedKey = await provider.decryptVaultKey(encryptedKeyBase64, ivBase64);

      // Assert: Decrypted key should match original vault key
      expect(decryptedKey.key).toEqual(mockVaultKey);
      expect(decryptedKey.iv).toEqual(mockVaultIv);

      // Verify encryption and decryption were called
      expect(aesEncrypt).toHaveBeenCalledTimes(1);
      expect(aesDecrypt).toHaveBeenCalledTimes(1);
    });
  });

  describe('master key consistency', () => {
    it('should use the same master key across multiple operations', async () => {
      // Arrange
      (aesEncrypt as jest.Mock).mockReturnValue(Buffer.from('encrypted'));
      (aesDecrypt as jest.Mock).mockReturnValue(Buffer.from('decrypted'));

      // Act: Perform multiple operations
      await provider.generateVaultKey();
      await provider.decryptVaultKey('dGVzdA==', 'dGVzdA==');
      await provider.generateVaultKey();

      // Assert: All operations should use the same master key
      const encryptCalls = (aesEncrypt as jest.Mock).mock.calls;
      const decryptCalls = (aesDecrypt as jest.Mock).mock.calls;

      // Check all encrypt calls used same master key
      encryptCalls.forEach((call) => {
        expect(call[1]).toEqual({
          key: MASTER_KEY,
          iv: MASTER_IV,
        });
      });

      // Check all decrypt calls used same master key
      decryptCalls.forEach((call) => {
        expect(call[1]).toEqual({
          key: MASTER_KEY,
          iv: MASTER_IV,
        });
      });
    });
  });
});
