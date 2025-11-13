import { z } from 'zod';
import { errorResponseSchema } from './auth.schema';

// Request schemas
export const createSecretSchema = z.object({
  name: z.string().min(1).describe("Secret name (unique per vault)"),
  value: z.string().min(1).describe("Secret value (will be encrypted)"),
});

export const updateSecretSchema = z.object({
  value: z.string().min(1).describe("New secret value (creates new version)"),
});

export const secretParamsSchema = z.object({
  vaultId: z.string().describe("Vault public ID"),
  secretId: z.string().describe("Secret public ID"),
});

export const vaultIdParamSchema = z.object({
  vaultId: z.string().describe("Vault public ID"),
});

export const getSecretsQuerySchema = z.object({
  name: z.string().optional().describe("Filter by secret name"),
  latest: z.coerce.boolean().optional().describe("Only return latest version of each secret"),
});

export const deleteSecretQuerySchema = z.object({
  name: z.string().min(1).describe("Secret name to delete (all versions)"),
});

// Response schemas
export const secretObjectSchema = z.object({
  publicId: z.string().describe("Secret public ID"),
  name: z.string().describe("Secret name"),
  value: z.string().optional().describe("Decrypted secret value (only in get by ID)"),
  version: z.number().describe("Secret version number"),
  createdAt: z.coerce.date().describe("Creation timestamp"),
  updatedAt: z.coerce.date().describe("Last update timestamp"),
});

export const createSecretResponseSchema = secretObjectSchema.omit({ value: true });

export const getSecretResponseSchema = secretObjectSchema;

export const getSecretsResponseSchema = z.object({
  secrets: z.array(secretObjectSchema.omit({ value: true })),
});

export const updateSecretResponseSchema = secretObjectSchema.omit({ value: true });

export const deleteSecretResponseSchema = z.object({
  message: z.string(),
  deletedCount: z.number(),
});

// Re-export error schema
export { errorResponseSchema };
