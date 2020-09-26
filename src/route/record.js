const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');

const { handleUpload, handleDelete } = require('../util/image-uploader');

const router = express.Router();
const multi = multer({
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: [
    'DATE',
    'DATETIME'
  ]
}).promise();

router.get('/list', async (req, res, next) => {
  let query = 'SELECT * FROM records';

  try {
    const type = req.query.type;
    if (type) {
      if (type.toUpperCase() === 'IN') query += ' WHERE amount > 0';
      else if (type.toUpperCase() === 'OUT') query += ' WHERE amount < 0';
      else {
        res.status(400);
        throw new Error('💸 Invalid record type');
      }
    }

    const orderBy = req.query.order_by;
    if (orderBy) {
      let [col, order = 'ASC'] = orderBy.split(':');
      
      if (!col.match(/^(id|name|amount|date)$/i)) {
        res.status(400);
        throw new Error('🧣 Invalid sorting column');
      }
      
      if (!order.match(/^(ASC|DESC)$/i)) {
        res.status(400);
        throw new Error('🧻 Invalid sorting order');
      }

      query += ` ORDER BY ${col} ${order.toUpperCase()}`;
    }

    let limit = req.query.limit;
    if (limit) {
      limit = parseInt(limit);

      if (limit > 0) query += ` LIMIT ${limit}`;
      else {
        res.status(400);
        throw new Error('🚀 Invalid limit number');
      }
    }

    const [ rows ] = await pool.query(`${query};`);

    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (_req, res, next) => {
  const query = 'SELECT (SELECT COUNT(*) FROM records WHERE MONTH(records.date) = MONTH(now()) AND YEAR(records.date) = YEAR(now())) as number_of_records, (SELECT SUM(amount) FROM records) as balance;';

  try {
    const [ rows ] = await pool.query(query);

    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get('/search/:q', async (req, res, next) => {
  const query = 'SELECT * FROM records WHERE name LIKE ? OR notes LIKE ?';

  const q = `%${req.params.q}%`;

  try {
    const [ rows ] = await pool.execute(query, [q, q]);

    res.json(rows);
  } catch(error) {
    next(error);
  }
});

router.get('/:id(\\d+)', async (req, res, next) => {
  const query = 'SELECT * FROM records WHERE id = ?';

  const id = req.params.id;

  try {
    const [ rows ] = await pool.execute(query, [id]);

    if (rows.length < 1) {
      res.status(404);
      const err = new Error(`🙈 Record with ID#${id} is not found`);
      err.code = 'ID404';
      throw err;
    }

    res.json(rows[0]);
  } catch(error) {
    next(error);
  }
});

router.delete('/:id(\\d+)', async (req, res, next) => {
  const query = 'SELECT attachment FROM records WHERE id = ?';
  const deleteQuery = 'DELETE FROM records WHERE id = ?';
  const id = req.params.id;

  try {
    const [ rows ] = await pool.execute(query, [id]);

    const publicUrl = rows[0].attachment;
    await handleDelete(publicUrl);

    const [ deletedRows ] = await pool.execute(deleteQuery, [id]);

    if (deletedRows.affectedRows == 0) throw new Error('🙈 - Record is not found');

    res.send({ message: `Record #${id} is successfully deleted` });
  } catch(error) {
    next(error);
  }
});

router.post('/add', multi.single('receipt'), handleUpload, async (req, res, next) => {
  const query = "INSERT INTO records (name, amount, date, notes, attachment) values (?, ?, ?, ?, ?)";
  const { name, amount, date, notes } = req.body;
  const imageUrl = req.file ? req.file.publicUrl : '';
  
  try {
    const [ rows ] = await pool.execute(query, [name, amount, date, notes, imageUrl]);
    
    res.send({ message: `Record #${rows.insertId} is successfully inserted` });
  } catch(error) {
    await handleDelete(imageUrl);
    next(error);
  }
});

router.put('/edit/:id(\\d+)', multi.single('receipt'), handleUpload, async (req, res, next) => {
  const query = 'UPDATE records SET name = ?, amount = ?, date = ?, notes = ?, attachment = ? WHERE id = ?';
  const id = req.params.id;
  const { name, amount, date, notes } = req.body;
  const imageUrl = req.file ? req.file.publicUrl : '';

  try {
    const [ rows ] = await pool.execute(query, [name, amount, date, notes, imageUrl, id]);
    
    if (rows.affectedRows == 0) throw new Error('🙈 - Record is not found');
    
    res.send({ message: `Record #${id} is successfully updated` });
  } catch (error) {
    await handleDelete(imageUrl);
    next(error);
  }
});

module.exports = router;
