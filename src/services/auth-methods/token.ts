import { createHash, randomBytes } from "crypto";
import { RoleToken } from "../../models/role_token.model";
import { RoleTokenRepository } from "../../repositories/role-token.repository";
import { v4 as uuid } from "uuid";
import { Role } from "../../models/role.model";
import { DateTime } from "luxon";
import parse from 'parse-duration'

export interface CreateTokenOpts {
  role: Role;
  lifetime: string;
  name?: string;
}

export interface TokenResponse {
  id: number;
  publicId: string;
  token: string;
  expiresAt: Date;
}

export const createToken = async (opts: CreateTokenOpts): Promise<TokenResponse> => {
  const tokenData = randomBytes(32).toString("base64");
  const tokenHash = createHash('sha256').update(tokenData).digest('base64');
  const ms = parse(opts.lifetime);

  if (!ms) {
    throw new Error("Invalid lifetime format");
  }

  const roleToken = new RoleToken();
  roleToken.publicId = uuid();
  roleToken.name = opts.name || "default";
  roleToken.tokenHash = tokenHash;
  roleToken.expiresAt = DateTime.now().plus({ milliseconds: ms }).toJSDate();
  const result = await RoleTokenRepository.save(roleToken);

  return {
    id: result.id,
    publicId: result.publicId,
    token: tokenData,
    expiresAt: result.expiresAt,
  }
}
