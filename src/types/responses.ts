export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    publicId: string;
    name: string;
    email: string;
  };
}

export interface RefreshTokenResponse {
  accessToken: string;
}

export interface RevokeTokenResponse {
  message: string;
}

export interface VaultResponse {
  publicId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultsListResponse {
  vaults: VaultResponse[];
}

export interface SecretResponse {
  publicId: string;
  name: string;
  value?: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecretsListResponse {
  secrets: SecretResponse[];
}

export interface DeleteSecretResponse {
  message: string;
  deletedCount: number;
}

// Role Management
export interface RoleResponse {
  publicId: string;
  name: string;
  description?: string;
  vaultIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RolesListResponse {
  roles: RoleResponse[];
}

export interface AuthMethodResponse {
  authType: 'cidr' | 'token';
  config: {
    allowedCidrs?: string[];
    lifetime?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthMethodsListResponse {
  authMethods: AuthMethodResponse[];
}

export interface TokenAuthMethodResponse extends AuthMethodResponse {
  publicId: string;
  name?: string;
  token: string;
  expiresAt: Date;
}

export interface VaultPermissionResponse {
  vaultId: string;
  vaultName: string;
  canWrite: boolean;
}

export interface VaultPermissionsListResponse {
  permissions: VaultPermissionResponse[];
}

export interface RoleTokenResponse {
  publicId: string;
  name?: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
}

export interface RoleTokensListResponse {
  tokens: RoleTokenResponse[];
}

// Role Auth
export interface RoleLoginResponse {
  accessToken: string;
}
