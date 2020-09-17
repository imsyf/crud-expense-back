const app = require('./app');

app.listen(port, () => {
  console.log(`Listening: http://localhost:${global.port}`);
});
