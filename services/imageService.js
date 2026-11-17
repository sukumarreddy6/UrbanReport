const { cloudinary, ensureConfigured } = require('../config/cloudinary');

function uploadImage(file) {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: 'urbanreport/complaints', resource_type: 'image', type: 'private',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'avif'],
      transformation: [{ width: 1800, height: 1800, crop: 'limit' }]
    }, (error, result) => error ? reject(error) : resolve({
      assetId: result.asset_id, publicId: result.public_id, url: result.secure_url,
      format: result.format, bytes: result.bytes
    }));
    stream.end(file.buffer);
  });
}

async function deleteImages(images) {
  await Promise.allSettled(images.map(image => cloudinary.uploader.destroy(image.publicId, { type: 'private', resource_type: 'image' })));
}

module.exports = { uploadImage, deleteImages };
