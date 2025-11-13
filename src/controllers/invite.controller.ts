import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { hashSync } from 'bcrypt';
import { InviteRepository } from '../repositories/invite.repository';
import { UserRepository } from '../repositories/user.repository';
import { BadRequestError, ConflictError } from '../services/errors';
import { formatUserResponse } from '../services/auth.service';
import { KmsFactory } from '../services/kms/factory';
import { User } from '../models/user.model';
import { AppDataSource } from '../data-source';

interface AcceptInviteRequest {
  email: string;
  name: string;
  password: string;
  inviteCode: string;
}

interface AcceptInviteResponse {
  user: {
    publicId: string;
    name: string;
    email: string;
  };
}

export async function acceptInvite(
  request: FastifyRequest<{ Body: AcceptInviteRequest }>,
  reply: FastifyReply
): Promise<AcceptInviteResponse> {
  const { email, name, password, inviteCode } = request.body;

  // Normalize invite code to uppercase for case-insensitive lookup
  const normalizedCode = inviteCode.toUpperCase();

  // Find the invite
  const invite = await InviteRepository.findOne({
    where: { inviteCode: normalizedCode }
  });

  if (!invite) {
    throw new BadRequestError('Invalid invite code');
  }

  // Check if invite has already been used
  if (invite.usedAt !== null) {
    throw new BadRequestError('Invite code has already been used');
  }

  // Validate email matches invite (case-insensitive)
  if (email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new BadRequestError('Email does not match invite');
  }

  // Check if user with this email already exists
  const existingUser = await UserRepository.findOne({
    where: { email: email.toLowerCase() }
  });

  if (existingUser) {
    throw new ConflictError('A user with this email already exists');
  }

  // Create account key using KMS factory
  const accountKeyId = await KmsFactory.createAccountKey(invite.kmsProvider);

  // Use transaction to ensure atomicity of user creation and invite marking
  const user = await AppDataSource.transaction(async (transactionalEntityManager) => {
    // Create new user
    const newUser = new User();
    newUser.publicId = randomUUID();
    newUser.email = email;
    newUser.name = name;
    newUser.password = hashSync(password, 10);
    newUser.kmsProvider = invite.kmsProvider;
    newUser.accountKeyId = accountKeyId;

    await transactionalEntityManager.save(newUser);

    // Mark invite as used
    invite.usedAt = new Date();
    await transactionalEntityManager.save(invite);

    return newUser;
  });

  return reply.send({
    user: formatUserResponse(user)
  });
}
