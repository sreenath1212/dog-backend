import path from 'path';
import fs from 'fs/promises';
import { env } from '../config/env';

/**
 * StorageProvider interface — abstracts file storage so the implementation
 * can be swapped from local disk to S3/Cloudinary without changing any
 * other part of the application.
 *
 * To add cloud storage:
 * 1. Create a new class implementing this interface (e.g., S3StorageProvider)
 * 2. Change the `storage` export at the bottom to use the new class
 * 3. Everything else in the app remains unchanged
 */
export interface StorageProvider {
  /**
   * Save a file buffer and return the public URL path
   */
  save(filename: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Delete a file by its stored path
   */
  delete(filePath: string): Promise<void>;

  /**
   * Get the full public URL for a stored file path
   */
  getUrl(filePath: string): string;
}

// ─── Local Disk Implementation ───────────────────────────────────────────────

class LocalDiskStorageProvider implements StorageProvider {
  private uploadDir: string;
  private baseUrl: string;

  constructor() {
    this.uploadDir = path.resolve(env.UPLOAD_DIR);
    this.baseUrl = `${env.BACKEND_URL}/uploads`;
  }

  async save(filename: string, buffer: Buffer): Promise<string> {
    // Ensure the upload directory exists
    await fs.mkdir(this.uploadDir, { recursive: true });

    const filePath = path.join(this.uploadDir, filename);
    await fs.writeFile(filePath, buffer);

    // Return the relative path (used for getUrl and delete)
    return filename;
  }

  async delete(filename: string): Promise<void> {
    const filePath = path.join(this.uploadDir, filename);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // If file doesn't exist, don't throw — treat as already deleted
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  getUrl(filename: string): string {
    return `${this.baseUrl}/${filename}`;
  }
}

// Export the active storage provider.
// To switch to cloud storage, replace LocalDiskStorageProvider with your implementation.
export const storage: StorageProvider = new LocalDiskStorageProvider();
