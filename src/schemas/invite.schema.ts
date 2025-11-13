import { z } from 'zod';
import { userObjectSchema, errorResponseSchema } from './auth.schema';

// Request schema
export const acceptInviteSchema = z.object({
  email: z.string().email().describe("User's email address"),
  name: z.string().min(1).describe("User's name"),
  password: z.string().min(8).describe("User's password (minimum 8 characters)"),
  inviteCode: z.string()
    .length(6, "Invite code must be exactly 6 characters")
    .regex(/^[A-Za-z]{6}$/, "Invite code must contain only letters")
    .describe("6-letter invite code"),
});

// Response schema
export const acceptInviteResponseSchema = z.object({
  user: userObjectSchema.describe("Created user information"),
});

// Export error schema for reuse
export { errorResponseSchema };
