const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads/attachments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Map extensions and MIME types to categories
const ALLOWED_CATEGORIES = {
  image: {
    maxSize: 10 * 1024 * 1024, // 10MB
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  },
  document: {
    maxSize: 20 * 1024 * 1024, // 20MB
    exts: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip'],
    mimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed'
    ]
  },
  video: {
    maxSize: 50 * 1024 * 1024, // 50MB
    exts: ['.mp4', '.webm', '.mov'],
    mimes: ['video/mp4', 'video/webm', 'video/quicktime']
  },
  audio: {
    maxSize: 15 * 1024 * 1024, // 15MB
    exts: ['.webm', '.ogg', '.mp3', '.wav', '.m4a', '.aac'],
    mimes: [
      'audio/webm',
      'audio/ogg',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-m4a',
      'audio/m4a',
      'audio/aac'
    ]
  }
};

const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.vbs', '.msi', '.dll', '.scr', '.com', '.jar', '.apk'
];

/**
 * Determine category of uploaded file
 * @param {string} originalname 
 * @param {string} mimetype 
 * @returns {'image' | 'video' | 'audio' | 'document' | null}
 */
const detectAttachmentCategory = (originalname, mimetype) => {
  const ext = path.extname(originalname || '').toLowerCase();
  const mime = (mimetype || '').toLowerCase();

  // 1. Check exact MIME match first (prevents .webm audio being misclassified as video)
  for (const [category, config] of Object.entries(ALLOWED_CATEGORIES)) {
    if (config.mimes.includes(mime)) {
      return category;
    }
  }

  // 2. MIME type prefix fallback
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';

  // 3. Extension fallback
  for (const [category, config] of Object.entries(ALLOWED_CATEGORIES)) {
    if (config.exts.includes(ext)) {
      return category;
    }
  }
  return null;
};

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const category = detectAttachmentCategory(file.originalname, file.mimetype) || 'file';
    cb(null, `${category}-${req.user?.id || 'guest'}-${uniqueSuffix}${ext}`);
  }
});

// File filter: validate extension & category
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Executable or dangerous file types are strictly prohibited.'), false);
  }

  const category = detectAttachmentCategory(file.originalname, file.mimetype);
  if (!category) {
    return cb(new Error('Unsupported file format. Supported formats: images, documents, videos, and audio recordings.'), false);
  }

  cb(null, true);
};

// Base Multer upload instance
const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB absolute max limit
  }
}).single('file');

/**
 * Express middleware wrapper with category-specific size checks
 */
const handleAttachmentUpload = (req, res, next) => {
  multerUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            message: 'Uploaded file exceeds the maximum allowed size (50MB).'
          });
        }
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file was provided for upload'
      });
    }

    // Check category-specific size limits
    const category = detectAttachmentCategory(req.file.originalname, req.file.mimetype);
    if (category) {
      const config = ALLOWED_CATEGORIES[category];
      if (req.file.size > config.maxSize) {
        const sizeMb = Math.round(config.maxSize / (1024 * 1024));
        // Remove uploaded file from disk if it exceeded category limit
        try {
          fs.unlinkSync(req.file.path);
        } catch (_) {}

        return res.status(400).json({
          success: false,
          message: `${category.charAt(0).toUpperCase() + category.slice(1)} size cannot exceed ${sizeMb}MB.`
        });
      }
      req.file.category = category;
    } else {
      req.file.category = 'document';
    }

    next();
  });
};

module.exports = {
  handleAttachmentUpload,
  detectAttachmentCategory,
  ALLOWED_CATEGORIES
};
