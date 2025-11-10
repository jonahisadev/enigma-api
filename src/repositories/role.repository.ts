import { AppDataSource } from '../data-source';
import { Role } from '../models/role.model';

export const RoleRepository = AppDataSource.getRepository(Role);
