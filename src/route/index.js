const express = require('express');

const ping = require('./ping');
const record = require('./record');

const router = express.Router();

router.use('/ping', ping);
router.use('/record', record);

module.exports = router;
