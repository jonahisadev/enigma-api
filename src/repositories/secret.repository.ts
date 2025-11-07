import { AppDataSource } from '../data-source';
import { Secret } from '../models/secret.model';

export const SecretRepository = AppDataSource.getRepository(Secret);
