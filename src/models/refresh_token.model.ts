import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Audit } from "./audit.model";
import { User } from "./user.model";

@Entity("refresh_tokens")
export class RefreshToken extends Audit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  token: string;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @ManyToOne(() => User, (user) => user.refreshTokens)
  user: User;
}
