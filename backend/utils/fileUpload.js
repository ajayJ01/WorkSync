const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const crypto = require("crypto");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function uploadFile(partData, options = {}) {
  const {
    folder = "uploads",
    allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"],
    maxSizeMB = 5,
  } = options;

  if (!partData || !partData.buffer || !partData.filename) {
    throw new Error("Invalid file data provided for upload.");
  }

  const ext = path.extname(partData.filename).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`Invalid file type. Allowed: ${allowedExtensions.join(", ")}`);
  }

  const fileSizeInBytes = partData.buffer.length;
  const maxSizeInBytes = maxSizeMB * 1024 * 1024;
  if (fileSizeInBytes > maxSizeInBytes) {
    throw new Error(`File size exceeds the limit of ${maxSizeMB} MB.`);
  }

  const randomName = crypto.randomBytes(16).toString("hex") + ext;
  const key = `${folder}/${randomName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: partData.buffer,
    ContentType: partData.mimetype,
  });

  await s3.send(command);

  const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  return url;
}

module.exports = { uploadFile };