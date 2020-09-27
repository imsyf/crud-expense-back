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
  const select = 'SELECT * FROM records WHERE id = ?';
  const del = 'DELETE FROM records WHERE id = ?';

  const id = req.params.id;

  try {
    const [ rows ] = await pool.execute(select, [id]);

    if (rows.length < 1) {
      res.status(404);
      const err = new Error(`🙈 Record with ID#${id} is not found`);
      err.code = 'ID404';
      throw err;
    }
    
    await handleDelete(rows[0].attachment);

    const [ result ] = await pool.execute(del, [id]);
    
    if (result.affectedRows < 1) {
      throw new Error('🛑 Query failed, record didn\'t get deleted');
    }
    
    res.json({ deleted: rows[0] });
  } catch(error) {
    next(error);
  }
});

router.post(
  '/create',
  multi.single('receipt'),
  async (req, res, next) => {
    const { name, amount, date, notes } = req.body;
    let imageUrl = '';
    
    try {
      if (!Date.parse(date)) {
        res.status(400);
        throw new Error('📆 Invalid date and/or time');
      }

      if (!(name && amount && date)) {
        res.status(400);
        throw new Error('🙄 Not all of the required fields were provided');
      }

      if (req.file) {
        imageUrl = await handleUpload(req.file, res);
      }

      const insert = 'INSERT INTO records (name, amount, date, notes, attachment) values (?, ?, ?, ?, ?)';
      const [ result ] = await pool.execute(insert, [name, amount, date, notes, imageUrl]);
      
      if (result.affectedRows < 1) {
        throw new Error('🛑 Query failed, record didn\'t get created');
      }
      const select = 'SELECT * FROM records WHERE id = ?';
      const [ rows ] = await pool.execute(select, [result.insertId]);

      res.status(201);
      res.json({ created: rows[0] });
    } catch(error) {
      await handleDelete(imageUrl);
      next(error);
    }
  }
);

router.put(
  '/update/:id(\\d+)',
  multi.single('receipt'),
  async (req, res, next) => {
    const select = 'SELECT * FROM records WHERE id = ?';

    const id = req.params.id;
    const { name, amount, date, notes } = req.body;
    let newImageUrl = '';

    try {
      const [ rows ] = await pool.execute(select, [id]);

      if (rows.length < 1) {
        res.status(404);
        const err = new Error(`🙈 Record with ID#${id} is not found`);
        err.code = 'ID404';
        throw err;
      }

      if (!Date.parse(date)) {
        res.status(400);
        throw new Error('📆 Invalid date and/or time');
      }

      if (!(name && amount && date)) {
        res.status(400);
        throw new Error('🙄 Not all of the required fields were provided');
      }

      const columns = [];
      const values = [];
      const diff = {};

      if (rows[0].name !== name) {
        columns.push('name = ?');
        values.push(name);
        diff.name = {
          old: rows[0].name,
          new: name
        };
      }

      if (rows[0].amount !== parseInt(amount)) {
        columns.push('amount = ?');
        values.push(amount);
        diff.amount = {
          old: rows[0].amount,
          new: parseInt(amount)
        };
      }

      const oldTimeStamp = Date.parse(rows[0].date);
      const newTimeStamp = Date.parse(date);
      if (oldTimeStamp !== newTimeStamp) {
        columns.push('date = ?');
        values.push(date);
        diff.date = {
          old: new Date(oldTimeStamp),
          new: new Date(newTimeStamp)
        };
      }

      if (rows[0].notes !== notes) {
        columns.push('notes = ?');
        values.push(notes);
        diff.notes = {
          old: rows[0].notes,
          new: notes
        };
      }

      if (req.file) {
        newImageUrl = await handleUpload(req.file, res);
        
        columns.push('attachment = ?');
        values.push(newImageUrl);
        diff.attachment = {
          old: rows[0].attachment,
          new: newImageUrl
        };
      }

      if (columns.length < 1) {
        res.status(400);
        throw new Error('👋 No new values were provided');
      }

      const query = `UPDATE records SET ${columns.join(', ')} WHERE id = ?`;
      values.push(id);

      console.log(query);
      console.log(values);

      const [ result ] = await pool.execute(query, values);

      if (result.changedRows < 1) {
        throw new Error('🛑 Query failed, record didn\'t get updated');
      }

      let response = {
        updated: diff
      };

      if (newImageUrl) {
        try {
          await handleDelete(rows[0].attachment);
        } catch (error) {
          response.warning = true;
          response.message = error.message;
        }
      }

      res.json(response);
    } catch (error) {
      await handleDelete(newImageUrl);
      next(error);
    }
  }
);

module.exports = router;
