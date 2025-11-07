import { z } from 'zod';

export const createVaultSchema = z.object({
  name: z.string().min(1),
  encryptionKey: z.string().min(1),
});

export const updateVaultSchema = z.object({
  name: z.string().min(1).optional(),
  encryptionKey: z.string().min(1).optional(),
});

export const vaultIdParamSchema = z.object({
  id: z.string(),
});
