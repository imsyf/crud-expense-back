const fs = require('fs');
const path = require('path');

const _upload = (stream, targetFilename) => new Promise((resolve, reject) => {
  const targetFilePath = `./bucket/${targetFilename}`;

  stream.pipe(fs.createWriteStream(targetFilePath))
    .on('error', (error) => {
      reject(error);
    })
    .on('finish', () => {
      resolve(path.resolve(targetFilePath).replace(/\\/g, '/'));
    });
});

const _delete = (filename) => {
  fs.unlinkSync(`./bucket/${filename}`);
}

module.exports = {
  _upload,
  _delete
};
