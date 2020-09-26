const { default: formatDate } = require('@bitty/format-date');
const { _upload, _delete } = process.env.NODE_ENV === 'production' ? require('./gcs') : require('./fs');

const handleUpload = async (file, res) => {
  if (!file.detectedFileExtension.match(/^(.jpg|.png|.gif)$/)) {
    res.status(400);
    throw new Error(`📷 Only .jpg, .png, or .gif image file is allowed, but you provided ${file.detectedFileExtension || file.clientReportedFileExtension} instead`);
  }

  const targetFileName = `${formatDate(new Date(), 'YYYYMMDD-HHmmss')}-${Math.round(Math.random() * 1E9)}${file.detectedFileExtension}`;

  return await _upload(file.stream, targetFileName);
}

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
