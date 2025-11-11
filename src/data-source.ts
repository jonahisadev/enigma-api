import { DataSource } from 'typeorm';
import { User } from './models/user.model';
import { Vault } from './models/vault.model';
import { Secret } from './models/secret.model';
import { RefreshToken } from './models/refresh_token.model';
import { Role } from './models/role.model';
import { RoleAuthMethod } from './models/role_auth_method.model';
import { RoleVaultPermission } from './models/role_vault_permission.model';
import { RoleToken } from './models/role_token.model';
import { loadSecret } from './utils/config';

const databaseUrl = loadSecret('DATABASE_URL', 'DATABASE_URL_FILE');

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: databaseUrl,
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
  entities: [User, Vault, Secret, RefreshToken, Role, RoleAuthMethod, RoleVaultPermission, RoleToken],
  migrations: [],
  subscribers: [],
});
