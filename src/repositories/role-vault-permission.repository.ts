import { AppDataSource } from '../data-source';
import { RoleVaultPermission } from '../models/role_vault_permission.model';

export const RoleVaultPermissionRepository = AppDataSource.getRepository(RoleVaultPermission);
