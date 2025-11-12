import { FastifyRequest, FastifyReply } from 'fastify';
import {
  CreateRoleRequest,
  UpdateRoleRequest,
  AddAuthMethodRequest,
  GrantVaultAccessRequest,
  UpdateVaultPermissionRequest,
} from '../types/requests';
import {
  RoleResponse,
  RolesListResponse,
  AuthMethodResponse,
  AuthMethodsListResponse,
  TokenAuthMethodResponse,
  VaultPermissionsListResponse,
  RoleTokensListResponse,
} from '../types/responses';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../services/errors';
import { Role } from '../models/role.model';
import { RoleRepository } from '../repositories/role.repository';
import { UserRepository } from '../repositories/user.repository';
import { v4 as uuid } from 'uuid';
import { createToken } from '../services/auth-methods/token';
import { CidrConfig, RoleAuthMethod } from '../models/role_auth_method.model';
import { RoleAuthMethodRepository } from '../repositories/role-auth-method.repository';
import { validateCidrs } from '../services/auth-methods/cidr';
import { VaultRepository } from '../repositories/vault.repository';
import { RoleVaultPermissionRepository } from '../repositories/role-vault-permission.repository';
import { RoleVaultPermission } from '../models/role_vault_permission.model';
import { RoleTokenRepository } from '../repositories/role-token.repository';
import { RoleToken } from '../models/role_token.model';

export async function createRole(
  request: FastifyRequest<{ Body: CreateRoleRequest }>,
  reply: FastifyReply
): Promise<RoleResponse> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to create roles');
  }

  const userId = request.user.userId;
  const { name, description } = request.body;

  const user = await UserRepository.findOne({
    where: { publicId: userId }
  });

  if (!user) {
    throw new ForbiddenError('Invalid user');
  }

  const existingRole = await RoleRepository.findOne({
    where: {
      name,
      user: {
        publicId: userId
      }
    }
  });

  if (existingRole) {
    throw new ConflictError(`Role with name ${name} already exists`);
  }

  const role = new Role();
  role.publicId = uuid();
  role.name = name;
  role.description = description || '';
  role.user = user;
  await RoleRepository.save(role);

  return reply.status(201).send({
    publicId: role.publicId,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  });
}

export async function getRoles(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<RolesListResponse> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view roles');
  }

  const roles = await RoleRepository.find({
    where: {
      user: {
        publicId: request.user.userId
      }
    }
  });

  const roleResponses: RoleResponse[] = roles.map(role => ({
    publicId: role.publicId,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  }));

  return reply.status(200).send({ roles: roleResponses });
}

export async function getRole(
  request: FastifyRequest<{ Params: { roleId: string } }>,
  reply: FastifyReply
): Promise<RoleResponse> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view roles');
  }

  const role = await RoleRepository.findOne({
    where: {
      publicId: request.params.roleId,
      user: {
        publicId: request.user.userId
      }
    }
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  return reply.status(200).send({
    publicId: role.publicId,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  });
}

export async function updateRole(
  request: FastifyRequest<{ Params: { roleId: string }; Body: UpdateRoleRequest }>,
  reply: FastifyReply
): Promise<RoleResponse> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to update roles');
  }

  const role = await RoleRepository.findOne({
    where: {
      publicId: request.params.roleId,
      user: {
        publicId: request.user.userId
      }
    }
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  const { name, description } = request.body;
  role.name = name || role.name;
  role.description = description || role.description;
  await RoleRepository.save(role);

  return reply.status(200).send({
    publicId: role.publicId,
    name: role.name,
    description: role.description,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  });
}

export async function deleteRole(
  request: FastifyRequest<{ Params: { roleId: string } }>,
  reply: FastifyReply
): Promise<{ message: string }> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to delete roles');
  }

  const role = await RoleRepository.findOne({
    where: {
      publicId: request.params.roleId,
      user: {
        publicId: request.user.userId
      }
    }
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  await RoleRepository.delete(role.id);

  return reply.status(200).send({ message: 'Role deleted successfully' });
}

export async function addAuthMethod(
  request: FastifyRequest<{ Params: { roleId: string }; Body: AddAuthMethodRequest }>,
  reply: FastifyReply
): Promise<AuthMethodResponse | TokenAuthMethodResponse> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to add auth methods');
  }

  const role = await RoleRepository.findOne({
    where: {
      publicId: request.params.roleId,
      user: {
        publicId: request.user.userId
      }
    }
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  const { authType } = request.body;

  switch (authType) {
    case 'token': {
      const { config } = request.body;
      if (!config || !config.name || !config.lifetime) {
        throw new BadRequestError('Missing token auth method configuration');
      }
      const tokenResponse = await createToken({
        role,
        name: config.name,
        lifetime: config.lifetime as string
      });

      const roleAuthMethod = new RoleAuthMethod();
      roleAuthMethod.publicId = uuid();
      roleAuthMethod.role = role;
      roleAuthMethod.authType = 'token';
      roleAuthMethod.config = { lifetime: config.lifetime };
      roleAuthMethod.tokens = [{ id: tokenResponse.id } as RoleToken];
      await RoleAuthMethodRepository.save(roleAuthMethod);

      return reply.status(201).send({
        publicId: roleAuthMethod.publicId,
        authType: roleAuthMethod.authType,
        token: tokenResponse.token,
        expiresAt: tokenResponse.expiresAt,
        createdAt: roleAuthMethod.createdAt,
      });
    }
    case 'cidr': {
      const { config } = request.body;
      if (!config || !config.allowedCidrs || !Array.isArray(config.allowedCidrs)) {
        throw new BadRequestError('Missing CIDR auth method configuration');
      }

      const valid = validateCidrs(config.allowedCidrs);
      if (!valid) {
        throw new BadRequestError('One or more CIDR blocks are invalid');
      }

      const roleAuthMethod = new RoleAuthMethod();
      roleAuthMethod.publicId = uuid();
      roleAuthMethod.role = role;
      roleAuthMethod.authType = 'cidr';
      roleAuthMethod.config = { allowedCidrs: config.allowedCidrs };
      await RoleAuthMethodRepository.save(roleAuthMethod);

      return reply.status(201).send({
        publicId: roleAuthMethod.publicId,
        authType: roleAuthMethod.authType,
        config: roleAuthMethod.config,
        createdAt: roleAuthMethod.createdAt,
      });
    }
    default:
      throw new BadRequestError('Invalid auth type');
  }
}

export async function getAuthMethods(
  request: FastifyRequest<{ Params: { roleId: string } }>,
  reply: FastifyReply
): Promise<AuthMethodsListResponse> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view auth methods');
  }

  const role = await RoleRepository.findOne({
    where: {
      publicId: request.params.roleId,
      user: {
        publicId: request.user.userId
      }
    }
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  const authMethods = await RoleAuthMethodRepository.find({
    where: {
      role: {
        id: role.id
      }
    },
    relations: ['tokens'],
  });

  const authMethodResponses = authMethods.map(method => {
    const baseResponse = {
      id: method.publicId,
      authType: method.authType,
      createdAt: method.createdAt,
    };

    if (method.authType === 'cidr') {
      return {
        ...baseResponse,
        config: {
          allowedCidrs: (method.config as CidrConfig).allowedCidrs,
        },
      };
    } else if (method.authType === 'token') {
      return {
        ...baseResponse,
        config: {
          name: method.tokens[0]?.name,
        },
      };
    } else {
      throw new Error('Unknown auth method type');
    }
  });


  return reply.status(200).send({
    authMethods: authMethodResponses,
  });
}

export async function removeAuthMethod(
  request: FastifyRequest<{ Params: { roleId: string; id: string } }>,
  reply: FastifyReply
): Promise<{ message: string }> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view auth methods');
  }

  const { roleId, id } = request.params;

  const role = await RoleRepository.findOne({
    where: {
      publicId: roleId,
      user: {
        publicId: request.user.userId
      }
    }
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  const authMethod = await RoleAuthMethodRepository.findOne({
    where: {
      publicId: id,
      role: {
        id: role.id
      }
    }
  });

  if (!authMethod) {
    throw new NotFoundError('No auth method found with the given ID for this role');
  }

  await RoleAuthMethodRepository.delete(authMethod.id);

  return reply.status(200).send({ message: 'Auth method removed successfully' });
}

export async function grantVaultAccess(
  request: FastifyRequest<{ Params: { roleId: string }; Body: GrantVaultAccessRequest }>,
  reply: FastifyReply
): Promise<{ message: string }> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view auth methods');
  }

  const { roleId } = request.params;

  const role = await RoleRepository.findOne({
    where: {
      publicId: roleId,
      user: {
        publicId: request.user.userId
      }
    },
    relations: ['vaultPermissions']
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  const vault = await VaultRepository.findOne({
    where: {
      publicId: request.body.vaultId,
      user: {
        publicId: request.user.userId
      }
    },
  });

  if (!vault) {
    throw new NotFoundError('No vault found with the given ID');
  }

  const existingPermission = role.vaultPermissions?.find(vp => vp.id === vault.id);
  if (existingPermission) {
    throw new ConflictError('Vault access permission already exists for this role');
  }

  const roleVaultPermission = new RoleVaultPermission();
  roleVaultPermission.publicId = uuid();
  roleVaultPermission.role = role;
  roleVaultPermission.vault = vault;
  roleVaultPermission.canWrite = request.body.canWrite || false;
  const result = await RoleVaultPermissionRepository.save(roleVaultPermission);

  return reply.status(201).send({
    message: `Vault access granted with ID ${result.publicId}`,
  });
}

export async function getVaultPermissions(
  request: FastifyRequest<{ Params: { roleId: string } }>,
  reply: FastifyReply
): Promise<VaultPermissionsListResponse> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view auth methods');
  }

  const { roleId } = request.params;

  const role = await RoleRepository.findOne({
    where: {
      publicId: roleId,
      user: {
        publicId: request.user.userId
      }
    },
    relations: ['vaultPermissions', 'vaultPermissions.vault']
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  const vaults = role.vaultPermissions.map(vp => ({
    vaultId: vp.vault.publicId,
    vaultName: vp.vault.name,
    canWrite: vp.canWrite,
    createdAt: vp.createdAt,
  }));

  return reply.status(200).send({
    permissions: vaults,
  });
}

export async function updateVaultPermission(
  request: FastifyRequest<{
    Params: { roleId: string; vaultId: string };
    Body: UpdateVaultPermissionRequest;
  }>,
  reply: FastifyReply
): Promise<{ message: string }> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view auth methods');
  }

  const { roleId, vaultId } = request.params;
  const { canWrite } = request.body;

  const rvp = await RoleVaultPermissionRepository.findOne({
    where: {
      role: {
        publicId: roleId,
        user: {
          publicId: request.user.userId
        }
      },
      vault: {
        publicId: vaultId,
        user: {
          publicId: request.user.userId
        }
      }
    }
  });

  if (!rvp) {
    throw new NotFoundError('No vault permission found for this role and vault');
  }

  rvp.canWrite = canWrite;
  await RoleVaultPermissionRepository.save(rvp);

  return reply.status(200).send({
    message: 'Vault permission updated successfully'
  });
}

export async function revokeVaultAccess(
  request: FastifyRequest<{ Params: { roleId: string; vaultId: string } }>,
  reply: FastifyReply
): Promise<{ message: string }> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view auth methods');
  }

  const { roleId, vaultId } = request.params;

  const rvp = await RoleVaultPermissionRepository.findOne({
    where: {
      role: {
        publicId: roleId,
        user: {
          publicId: request.user.userId
        }
      },
      vault: {
        publicId: vaultId,
        user: {
          publicId: request.user.userId
        }
      }
    }
  });

  if (!rvp) {
    throw new NotFoundError('No vault permission found for this role and vault');
  }

  await RoleVaultPermissionRepository.delete(rvp.id);

  return reply.status(200).send({
    message: 'Vault access revoked successfully'
  });
}

// TODO: Implement list tokens
// 1. Find role by publicId, verify ownership
// 2. Query RoleTokenRepository for all tokens for role's auth methods
// 3. Map to RoleTokenResponse array (exclude tokenHash!)
// 4. Return RoleTokensListResponse
export async function listTokens(
  request: FastifyRequest<{ Params: { roleId: string } }>,
  reply: FastifyReply
): Promise<RoleTokensListResponse> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view auth methods');
  }

  const { roleId } = request.params;
  const role = await RoleRepository.findOne({
    where: {
      publicId: roleId,
      user: {
        publicId: request.user.userId
      }
    },
    relations: ['authMethods', 'authMethods.tokens']
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  const tokens = role.authMethods
    .filter(am => am.authType === 'token')
    .map(am => am.tokens[0])
    .map(token => ({
      publicId: token.publicId,
      name: token.name,
      expiresAt: token.expiresAt,
      revoked: token.revoked || false,
      createdAt: token.createdAt,
    }));

  return reply.status(200).send({
    tokens,
  });
}

export async function revokeToken(
  request: FastifyRequest<{ Params: { roleId: string; tokenId: string } }>,
  reply: FastifyReply
): Promise<{ message: string }> {
  const isAdmin = request.user.authType === 'password';
  if (!isAdmin) {
    throw new ForbiddenError('Not authorized to view auth methods');
  }

  const { roleId, tokenId } = request.params;

  const role = await RoleRepository.findOne({
    where: {
      publicId: roleId,
      user: {
        publicId: request.user.userId
      }
    }
  });

  if (!role) {
    throw new NotFoundError('No role found with the given ID');
  }

  const token = await RoleTokenRepository.findOne({
    where: {
      publicId: tokenId,
      roleAuthMethod: {
        role: {
          id: role.id
        }
      }
    }
  });

  if (!token) {
    throw new NotFoundError('No token found with the given ID');
  }

  token.revoked = true;
  await RoleTokenRepository.save(token);

  return reply.status(200).send({
    message: 'Token revoked successfully'
  });
}
