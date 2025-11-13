import { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import { hashSync } from 'bcrypt';
import { InviteRepository } from '../repositories/invite.repository';
import { UserRepository } from '../repositories/user.repository';
import { BadRequestError } from '../services/errors';
import { formatUserResponse } from '../services/auth.service';
import { KmsFactory } from '../services/kms/factory';
import { User } from '../models/user.model';

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

  // Create account key using KMS factory
  const accountKeyId = await KmsFactory.createAccountKey(invite.kmsProvider);

  // Create new user
  const user = new User();
  user.publicId = randomUUID();
  user.email = email;
  user.name = name;
  user.password = hashSync(password, 10);
  user.kmsProvider = invite.kmsProvider;
  user.accountKeyId = accountKeyId;

  await UserRepository.save(user);

  // Mark invite as used
  invite.usedAt = new Date();
  await InviteRepository.save(invite);

  return reply.send({
    user: formatUserResponse(user)
  });
}
