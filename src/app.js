const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const middlewares = require('./middlewares');
const route = require('./route');

const app = express();

global.port = process.env.PORT || 8080;

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'development') {
  global.localStorageBucket = path.resolve(`./${process.env.BUCKET_NAME}`);

  app.use(
    `/${process.env.BUCKET_NAME}`,
    express.static(global.localStorageBucket)
  );

  console.log(`Local storage bucket base URL: http://localhost:${global.port}/${process.env.BUCKET_NAME}`);
}
app.use('/', route);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
