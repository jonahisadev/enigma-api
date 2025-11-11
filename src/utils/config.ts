import { readFileSync } from 'fs';

/**
 * Load a secret from either an environment variable or a file.
 * Supports Docker secrets pattern where secrets are mounted as files.
 *
 * @param envVar - Name of the environment variable
 * @param envVarFile - Name of the environment variable that points to the file path
 * @returns The secret value
 */
export function loadSecret(envVar: string, envVarFile: string): string | undefined {
  // First, try to load from the file if the path is specified
  const filePath = process.env[envVarFile];
  if (filePath) {
    try {
      return readFileSync(filePath, 'utf-8').trim();
    } catch (error) {
      throw new Error(`Failed to read secret from file ${filePath}: ${error}`);
    }
  }

  // Fall back to the environment variable
  return process.env[envVar];
}
