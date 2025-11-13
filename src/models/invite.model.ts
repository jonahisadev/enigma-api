import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Audit } from './audit.model';

@Entity("invites")
export class Invite extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: "public_id", unique: true })
  publicId: string;

  @Index()
  @Column({ name: "invite_code", unique: true, length: 6 })
  inviteCode: string;

  @Column()
  email: string;

  @Column({ type: 'text', name: 'kms_provider' })
  kmsProvider: 'aws' | 'gcp' | 'azure' | 'local';

  @Column({ type: 'timestamp', name: 'used_at', nullable: true })
  usedAt: Date | null;
}
