import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Audit } from './audit.model';
import { Role } from './role.model';
import { RoleToken } from './role_token.model';

export type AuthType = 'cidr' | 'token';

export interface CidrConfig {
  allowedCidrs: string[];
}

export interface TokenConfig {
  lifetime: string; // e.g., "30d", "1y"
}

@Entity('role_auth_methods')
export class RoleAuthMethod extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', unique: true })
  publicId: string;

  @Column({ type: 'text', name: 'auth_type' })
  authType: AuthType;

  @Column({ type: 'jsonb' })
  config: CidrConfig | TokenConfig;

  @ManyToOne(() => Role, (role) => role.authMethods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @OneToMany(() => RoleToken, (token) => token.roleAuthMethod)
  tokens: RoleToken[];
}
