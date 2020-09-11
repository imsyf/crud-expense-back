const express = require('express');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: `👋 - Pong - ${req.originalUrl}`
  });
});

module.exports = router;
