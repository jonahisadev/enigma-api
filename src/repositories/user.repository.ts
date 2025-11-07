import { AppDataSource } from '../data-source';
import { User } from '../models/user.model';

export const UserRepository = AppDataSource.getRepository(User);
