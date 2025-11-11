import { AppDataSource } from '../data-source';
import { RoleAuthMethod } from '../models/role_auth_method.model';

export const RoleAuthMethodRepository = AppDataSource.getRepository(RoleAuthMethod);
