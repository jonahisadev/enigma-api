import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class Audit {
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
