import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Audit } from './audit.model';
import { Vault } from './vault.model';
import { RefreshToken } from './refresh_token.model';

@Entity("users")
export class User extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: "public_id", unique: true })
  publicId: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ type: 'text', name: 'kms_provider' })
  kmsProvider: 'aws' | 'gcp' | 'azure' | 'local';

  @Column({ type: 'text', name: 'kms_account_key_id' })
  accountKeyId: string;

  @OneToMany(() => Vault, (vault) => vault.user)
  vaults: Vault[];

  @OneToMany(() => RefreshToken, (refreshToken) => refreshToken.user)
  refreshTokens: RefreshToken[];
}
