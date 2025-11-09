import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Audit } from './audit.model';
import { Vault } from './vault.model';

@Entity("secrets")
export class Secret extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: "public_id", unique: true })
  publicId: string;

  @Column()
  name: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @ManyToOne(() => Vault, (vault) => vault.secrets)
  @JoinColumn({ name: "vault_id" })
  vault: Vault;
}
