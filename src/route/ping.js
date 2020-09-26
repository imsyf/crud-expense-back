const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(
    {
      text: '👋 Pong',
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    }
  );
});

module.exports = router;
