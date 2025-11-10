import { z } from 'zod';

// Role Management
export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export const roleIdParamSchema = z.object({
  roleId: z.string(),
});

// Auth Methods
export const addAuthMethodSchema = z.object({
  authType: z.enum(['cidr', 'token']),
  config: z.object({
    allowedCidrs: z.array(z.string()).optional(),
    lifetime: z.string().optional(),
    name: z.string().optional(),
  }),
});

export const authMethodIdParamSchema = z.object({
  roleId: z.string(),
  id: z.string(),
});

// Vault Permissions
export const grantVaultAccessSchema = z.object({
  vaultId: z.string(),
  canWrite: z.boolean(),
});

export const updateVaultPermissionSchema = z.object({
  canWrite: z.boolean(),
});

export const vaultPermissionParamSchema = z.object({
  roleId: z.string(),
  vaultId: z.string(),
});

// Role Tokens
export const tokenIdParamSchema = z.object({
  roleId: z.string(),
  tokenId: z.string(),
});

// Role Auth
export const tokenLoginSchema = z.object({
  token: z.string().min(1),
});
