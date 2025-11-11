import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Audit } from './audit.model';
import { Role } from './role.model';
import { Vault } from './vault.model';

@Entity('role_vault_permissions')
export class RoleVaultPermission extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'public_id', unique: true })
  publicId: string;

  @Column({ name: 'can_write', default: false })
  canWrite: boolean;

  @ManyToOne(() => Role, (role) => role.vaultPermissions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @ManyToOne(() => Vault, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vault_id' })
  vault: Vault;
}
