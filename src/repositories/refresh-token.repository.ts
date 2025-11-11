import { AppDataSource } from '../data-source';
import { RefreshToken } from '../models/refresh_token.model';

export const RefreshTokenRepository = AppDataSource.getRepository(RefreshToken);
