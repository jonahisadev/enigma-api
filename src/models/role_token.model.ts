import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Audit } from './audit.model';
import { RoleAuthMethod } from './role_auth_method.model';

@Entity('role_tokens')
export class RoleToken extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', unique: true })
  publicId: string;

  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ default: false })
  revoked: boolean;

  @ManyToOne(() => RoleAuthMethod, (authMethod) => authMethod.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_auth_method_id' })
  roleAuthMethod: RoleAuthMethod;
}
