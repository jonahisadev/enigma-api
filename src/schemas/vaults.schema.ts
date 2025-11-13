import { z } from 'zod';
import { errorResponseSchema } from './auth.schema';

// Request schemas
export const createVaultSchema = z.object({
  name: z.string().min(1).describe("Vault name"),
});

export const updateVaultSchema = z.object({
  name: z.string().min(1).describe("New vault name"),
});

export const vaultIdParamSchema = z.object({
  id: z.string().describe("Vault public ID"),
});

// Response schemas
export const vaultObjectSchema = z.object({
  publicId: z.string().describe("Vault public ID"),
  name: z.string().describe("Vault name"),
  createdAt: z.coerce.date().describe("Creation timestamp"),
  updatedAt: z.coerce.date().describe("Last update timestamp"),
});

export const createVaultResponseSchema = vaultObjectSchema;

export const getVaultResponseSchema = vaultObjectSchema;

export const getVaultsResponseSchema = z.object({
  vaults: z.array(vaultObjectSchema),
});

export const updateVaultResponseSchema = vaultObjectSchema;

export const deleteVaultResponseSchema = z.object({
  message: z.string(),
});

// Re-export error schema
export { errorResponseSchema };
