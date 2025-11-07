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
  value: string;
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
