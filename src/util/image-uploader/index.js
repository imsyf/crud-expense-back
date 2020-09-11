const { default: formatDate } = require('@bitty/format-date');
const { _upload, _delete } = process.env.NODE_ENV === 'production' ? require('./gcs') : require('./fs');

const handleUpload = async (req, res, next) => {
  if (req.file) {
    try {
      if (!req.file.detectedFileExtension.match(/^(.jpg|.png|.gif)$/)) {
        res.status(400);
        throw new Error(`⛔ - Unsupported filetype - Pick .jpg, .png, or .gif instead of ${req.file.detectedFileExtension || req.file.clientReportedFileExtension}`);
      }

      const targetFileName = `${formatDate(new Date(), 'YYYYMMDD-HHmmss')}-${Math.round(Math.random() * 1E9)}${req.file.detectedFileExtension}`;

      req.file.publicUrl = await _upload(req.file.stream, targetFileName);
    } catch (error) {
      next(error);
    }
  }
  return next();
};

const handleDelete = async (publicUrl) => {
  const segments = publicUrl.split('/');

  if (segments.length > 1) {
    const filename = segments.pop();
    await _delete(filename);
  }
};

module.exports = {
  handleUpload,
  handleDelete
}
