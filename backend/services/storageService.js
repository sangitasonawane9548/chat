const path = require('path');
const fs = require('fs');

// Default uploads directory on local disk
const ATTACHMENTS_DIR = path.join(__dirname, '../uploads/attachments');

// Ensure attachments directory exists
if (!fs.existsSync(ATTACHMENTS_DIR)) {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
}

/**
 * Storage Service Abstraction
 * Handles local filesystem storage and provides seamless extension hooks
 * for AWS S3 or Cloudinary if configured via environment variables.
 */
class StorageService {
  constructor() {
    this.attachmentsDir = ATTACHMENTS_DIR;
    this.driver = process.env.STORAGE_DRIVER || 'local'; // 'local' | 'cloudinary' | 's3'
  }

  /**
   * Get absolute path for stored file
   * @param {string} storageFilename 
   * @returns {string}
   */
  getAbsolutePath(storageFilename) {
    return path.join(this.attachmentsDir, path.basename(storageFilename));
  }

  /**
   * Check if file exists on disk
   * @param {string} storageFilename 
   * @returns {boolean}
   */
  fileExists(storageFilename) {
    const fullPath = this.getAbsolutePath(storageFilename);
    return fs.existsSync(fullPath);
  }

  /**
   * Delete a stored file
   * @param {string} storageFilename 
   * @returns {Promise<boolean>}
   */
  async deleteFile(storageFilename) {
    try {
      const fullPath = this.getAbsolutePath(storageFilename);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[StorageService] Error deleting file:', err.message);
      return false;
    }
  }

  /**
   * Generate accessible file URL (relative or CDN URL)
   * @param {string} storageFilename 
   * @param {number|string} attachmentId 
   * @returns {string}
   */
  getFileUrl(storageFilename, attachmentId) {
    if (this.driver === 'cloudinary' && process.env.CLOUDINARY_URL) {
      return `${process.env.CLOUDINARY_URL}/${storageFilename}`;
    }
    // Default local file route: direct static URL or authorized attachment stream URL
    return `/uploads/attachments/${storageFilename}`;
  }
}

module.exports = new StorageService();

