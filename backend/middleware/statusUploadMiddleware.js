const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads/statuses');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed extensions and MIME types
const ALLOWED_MEDIA = {
  image: {
    maxSize: 15 * 1024 * 1024, // 15MB
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    mimes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  },
  video: {
    maxSize: 50 * 1024 * 1024, // 50MB
    exts: ['.mp4', '.webm', '.mov'],
    mimes: ['video/mp4', 'video/webm', 'video/quicktime']
  }
};

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const isImage = ALLOWED_MEDIA.image.exts.includes(ext) || ALLOWED_MEDIA.image.mimes.includes(mime) || mime.startsWith('image/');
  const isVideo = ALLOWED_MEDIA.video.exts.includes(ext) || ALLOWED_MEDIA.video.mimes.includes(mime) || mime.startsWith('video/');

  if (isImage) {
    file.statusType = 'image';
    return cb(null, true);
  } else if (isVideo) {
    file.statusType = 'video';
    return cb(null, true);
  } else {
    return cb(new Error('Invalid status file type. Only standard images (JPG, PNG, WEBP, GIF) and videos (MP4, WEBM, MOV) are supported.'), false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const prefix = file.statusType || 'status';
    cb(null, `${prefix}-${req.user?.id || 'guest'}-${uniqueSuffix}${ext}`);
  }
});

const uploadStatusMedia = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB absolute ceiling (individual video/image checks done on controller if needed)
  }
});

module.exports = {
  uploadStatusMedia
};

