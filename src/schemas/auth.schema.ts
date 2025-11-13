import { z } from 'zod';

// Request schemas
export const loginSchema = z.object({
  email: z.string().email().describe("User's email address"),
  password: z.string().min(1).describe("User's password"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).describe("Refresh token obtained from login"),
});

export const revokeTokenSchema = z.object({
  refreshToken: z.string().optional().describe("Specific refresh token to revoke (omit to revoke all)"),
});

// Response schemas
export const userObjectSchema = z.object({
  publicId: z.string().describe("User public ID"),
  name: z.string().describe("User name"),
  email: z.string().email().describe("User email"),
});

export const loginResponseSchema = z.object({
  accessToken: z.string().describe("JWT access token (expires in 15 minutes)"),
  refreshToken: z.string().describe("Refresh token (expires in 30 days)"),
  user: userObjectSchema.describe("User information"),
});

export const refreshResponseSchema = z.object({
  accessToken: z.string().describe("New JWT access token"),
  refreshToken: z.string().describe("New refresh token"),
  user: userObjectSchema.describe("User information"),
});

export const revokeResponseSchema = z.object({
  message: z.string().describe("Success message"),
});

export const errorResponseSchema = z.object({
  ok: z.literal(false),
  reason: z.string().describe("Error description"),
});
