const fs = require('fs');

const _upload = (stream, filename) => new Promise((resolve, reject) => {
  stream.pipe(fs.createWriteStream(`${global.localStorageBucket}/${filename}`))
    .on('error', (error) => {
      reject(error);
    })
    .on('finish', () => {
      resolve(`http://localhost:${global.port}/${process.env.BUCKET_NAME}-bucket/${filename}`);
    });
});

const _delete = (filename) => {
  fs.unlinkSync(`${global.localStorageBucket}/${filename}`);
}

const initBucket = (dir) => {
  if (!fs.existsSync(dir)) {
    console.log('Local storage bucket doesn\'t exist, creating one');
    fs.mkdirSync(dir);
  } else {
    console.log('Use existing local storage bucket');
  }
};

module.exports = {
  _upload,
  _delete,
  initBucket
};
