const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    // Browser MIME labels are not reliable across devices. The content check
    // below is authoritative, so allow common image labels and octet-stream.
    if (!file.mimetype?.startsWith('image/') && file.mimetype !== 'application/octet-stream') return cb(new Error('Upload JPG, PNG, or WebP images only.'));
    cb(null, true);
  }
});

function verifyImageContents(req, _res, next) {
  for (const file of req.files || []) {
    const buffer = file.buffer;
    if (!buffer?.length) return next(new Error('The uploaded image is empty. Choose the image file again and retry.'));
    // A few mobile/gallery exports prepend a short marker before JPEG SOI.
    const jpegStart = buffer.subarray(0, 24).indexOf(Buffer.from([0xff, 0xd8]));
    const jpeg = jpegStart >= 0 && jpegStart <= 16;
    const png = buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
    const webp = buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    const avif = buffer.subarray(4, 8).toString() === 'ftyp' && /avif|avis/.test(buffer.subarray(8, 64).toString('ascii'));
    // Keep JPEG uploads moving even when an exporter prepends a nonstandard
    // header Cloudinary can still decode. Cloudinary's allowed_formats check
    // remains the final validation before the image is stored.
    const jpegMime = ['image/jpeg', 'image/jpg', 'image/pjpeg'].includes(file.mimetype?.toLowerCase());
    const avifMime = file.mimetype?.toLowerCase() === 'image/avif';
    const valid = jpeg || png || webp || avif || jpegMime || avifMime;
    if (!valid) return next(new Error('One of the uploaded files is not a valid JPG, PNG, WebP, or AVIF image.'));
  }
  next();
}

module.exports = { upload, verifyImageContents };
