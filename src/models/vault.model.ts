import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Audit } from './audit.model';
import { User } from './user.model';
import { Secret } from './secret.model';

@Entity("vaults")
export class Vault extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: "public_id", unique: true })
  publicId: string;

  @Column()
  name: string;

  @Column({ type: 'text', name: 'encryption_key' })
  encryptionKey: string;

  @ManyToOne(() => User, (user) => user.vaults)
  @JoinColumn({ name: "user_id" })
  user: User;

  @OneToMany(() => Secret, (secret) => secret.vault)
  secrets: Secret[];
}
