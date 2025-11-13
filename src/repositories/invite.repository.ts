import { AppDataSource } from '../data-source';
import { Invite } from '../models/invite.model';

export const InviteRepository = AppDataSource.getRepository(Invite);
