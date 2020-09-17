const fs = require('fs');

const _upload = (stream, filename) => new Promise((resolve, reject) => {
  stream.pipe(fs.createWriteStream(`${global.localStorageBucket}/${filename}`))
    .on('error', (error) => {
      reject(error);
    })
    .on('finish', () => {
      resolve(`http://localhost:${global.port}/${process.env.BUCKET_NAME}/${filename}`);
    });
});

const _delete = (filename) => {
  fs.unlinkSync(`${global.localStorageBucket}/${filename}`);
}

module.exports = {
  _upload,
  _delete
};
