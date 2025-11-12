import { z } from 'zod';
import { errorResponseSchema } from './auth.schema';

// Role Management Request Schemas
export const createRoleSchema = z.object({
  name: z.string().min(1).describe("Role name"),
  description: z.string().optional().describe("Role description"),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional().describe("New role name"),
  description: z.string().optional().describe("New role description"),
});

export const roleIdParamSchema = z.object({
  roleId: z.string().describe("Role public ID"),
});

// Auth Methods Request Schemas
export const addAuthMethodSchema = z.object({
  authType: z.enum(['cidr', 'token']).describe("Authentication method type"),
  config: z.object({
    allowedCidrs: z.array(z.string()).optional().describe("Allowed CIDR ranges (for CIDR auth)"),
    lifetime: z.string().optional().describe("Token lifetime duration (for token auth, e.g., '30d')"),
    name: z.string().optional().describe("Token name/description (for token auth)"),
  }).describe("Auth method configuration"),
});

export const authMethodIdParamSchema = z.object({
  roleId: z.string().describe("Role public ID"),
  id: z.string().describe("Auth method ID"),
});

// Vault Permissions Request Schemas
export const grantVaultAccessSchema = z.object({
  vaultId: z.string().describe("Vault public ID"),
  canWrite: z.boolean().describe("Grant write permissions (true) or read-only (false)"),
});

export const updateVaultPermissionSchema = z.object({
  canWrite: z.boolean().describe("Update write permissions (true) or read-only (false)"),
});

export const vaultPermissionParamSchema = z.object({
  roleId: z.string().describe("Role public ID"),
  vaultId: z.string().describe("Vault public ID"),
});

// Role Tokens Request Schemas
export const tokenIdParamSchema = z.object({
  roleId: z.string().describe("Role public ID"),
  tokenId: z.string().describe("Token ID"),
});

// Role Auth Request Schemas
export const tokenLoginSchema = z.object({
  token: z.string().min(1).describe("Static authentication token"),
});

// Response Schemas
export const roleObjectSchema = z.object({
  publicId: z.string().describe("Role public ID"),
  name: z.string().describe("Role name"),
  description: z.string().optional().describe("Role description"),
  createdAt: z.coerce.date().describe("Creation timestamp"),
  updatedAt: z.coerce.date().describe("Last update timestamp"),
});

export const authMethodObjectSchema = z.object({
  id: z.string().describe("Auth method ID"),
  authType: z.enum(['cidr', 'token']).describe("Authentication method type"),
  config: z.object({
    allowedCidrs: z.array(z.string()).optional(),
    name: z.string().optional(),
  }).describe("Auth method configuration (token value never returned)"),
  createdAt: z.coerce.date().describe("Creation timestamp"),
});

export const vaultPermissionObjectSchema = z.object({
  vaultId: z.string().describe("Vault public ID"),
  vaultName: z.string().describe("Vault name"),
  canWrite: z.boolean().describe("Has write permissions"),
  createdAt: z.coerce.date().describe("Creation timestamp"),
});

export const tokenObjectSchema = z.object({
  publicId: z.string().describe("Token public ID"),
  name: z.string().describe("Token name"),
  expiresAt: z.coerce.date().nullable().describe("Expiration timestamp (null if no expiration)"),
  createdAt: z.coerce.date().describe("Creation timestamp"),
});

export const roleLoginResponseSchema = z.object({
  accessToken: z.string().describe("JWT access token for role-based access"),
});

export const createRoleResponseSchema = roleObjectSchema;

export const getRoleResponseSchema = roleObjectSchema;

export const getRolesResponseSchema = z.object({
  roles: z.array(roleObjectSchema),
});

export const updateRoleResponseSchema = roleObjectSchema;

export const deleteRoleResponseSchema = z.object({
  message: z.string(),
});

export const addAuthMethodResponseSchema = z.object({
  authMethod: authMethodObjectSchema,
  token: z.string().optional().describe("Generated token (only returned once for token auth)"),
});

export const getAuthMethodsResponseSchema = z.object({
  authMethods: z.array(authMethodObjectSchema),
});

export const grantVaultAccessResponseSchema = vaultPermissionObjectSchema;

export const getVaultPermissionsResponseSchema = z.object({
  permissions: z.array(vaultPermissionObjectSchema),
});

export const getTokensResponseSchema = z.object({
  tokens: z.array(tokenObjectSchema),
});

export const successMessageResponseSchema = z.object({
  message: z.string(),
});

// Re-export error schema
export { errorResponseSchema };
