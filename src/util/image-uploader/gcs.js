const { Storage } = require('@google-cloud/storage');
const path = require('path');

const storage = new Storage({
  keyFilename: path.join(__dirname, './service-key.json'),
  projectId: process.env.GCP_PROJECT_ID
});

const bucket = storage.bucket(process.env.BUCKET_NAME);

const _upload = (stream, filename) => new Promise((resolve, reject) => {
  stream.pipe(
    bucket.file(filename)
      .createWriteStream({
        metadata: {
          cacheControl: 'max-age=0, no-cache'
        }
      })
  )
    .on('error', (error) => {
      reject(error);
    })
    .on('finish', () => {
      resolve(`https://storage.googleapis.com/${process.env.BUCKET_NAME}/${filename}`);
    });
});

const _delete = (filename) => new Promise((resolve, reject) => {
  bucket.file(filename)
    .delete((error, response) => {
      if (error) reject(error);
      resolve(response);
    });
});

module.exports = {
  _upload,
  _delete
};
