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
