import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Audit } from './audit.model';
import { User } from './user.model';
import { RoleAuthMethod } from './role_auth_method.model';
import { RoleVaultPermission } from './role_vault_permission.model';
import { RoleToken } from './role_token.model';

@Entity('roles')
export class Role extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', unique: true })
  publicId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => RoleAuthMethod, (authMethod) => authMethod.role)
  authMethods: RoleAuthMethod[];

  @OneToMany(() => RoleVaultPermission, (permission) => permission.role)
  vaultPermissions: RoleVaultPermission[];

  @OneToMany(() => RoleToken, (token) => token.roleAuthMethod)
  tokens: RoleToken[];
}
