import { AppDataSource } from '../data-source';
import { RoleToken } from '../models/role_token.model';

export const RoleTokenRepository = AppDataSource.getRepository(RoleToken);
