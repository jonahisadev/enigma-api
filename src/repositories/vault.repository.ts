import { AppDataSource } from '../data-source';
import { Vault } from '../models/vault.model';

export const VaultRepository = AppDataSource.getRepository(Vault);
