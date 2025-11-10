export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RevokeTokenRequest {
  refreshToken?: string;
}

export interface CreateVaultRequest {
  name: string;
}

export interface UpdateVaultRequest {
  name: string;
}

export interface CreateSecretRequest {
  name: string;
  value: string;
}

export interface UpdateSecretRequest {
  value: string;
}

export interface GetSecretsQuery {
  name?: string;
  latest?: boolean;
}

export interface DeleteSecretQuery {
  name: string;
}

// Role Management
export interface CreateRoleRequest {
  name: string;
  description?: string;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
}

export interface AddAuthMethodRequest {
  authType: 'cidr' | 'token';
  config: {
    allowedCidrs?: string[];  // For CIDR
    lifetime?: string;        // For Token (e.g., "30d")
    name?: string;            // Optional name for Token
  };
}

export interface GrantVaultAccessRequest {
  vaultId: string;
  canWrite: boolean;
}

export interface UpdateVaultPermissionRequest {
  canWrite: boolean;
}

// Role Auth
export interface TokenLoginRequest {
  token: string;
}
