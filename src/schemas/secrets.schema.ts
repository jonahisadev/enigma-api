import { z } from 'zod';

export const createSecretSchema = z.object({
  name: z.string().min(1),
  value: z.string().min(1),
});

export const updateSecretSchema = z.object({
  value: z.string().min(1),
});

export const secretParamsSchema = z.object({
  vaultId: z.string(),
  secretId: z.string(),
});

export const vaultIdParamSchema = z.object({
  vaultId: z.string(),
});

export const getSecretsQuerySchema = z.object({
  name: z.string().optional(),
  latest: z.coerce.boolean().optional(),
});

export const deleteSecretQuerySchema = z.object({
  name: z.string().min(1),
});
