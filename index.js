const express = require('express')
const pg = require('pg')
const app = express()
const port = 3000

const router = express.Router()

require("dotenv").config();


// const pool = new pg.Pool({
//     host:process.env.DB_HOST,
//     port:process.env.DB_PORT,
//     user:process.env.DB_USER,
//     password:process.env.DB_PASSWORD,
//     database:process.env.DB_DATABASE,
// });

const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
  })

const db =pool.connect();

// ==========================USER================================
router.post('/login', (req, res) => {
    return res.status(200)
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    db.query(`SELECT 1 FROM accounts WHERE USERNAME=${username} AND PASSWORD=${password}`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error retrieving users');
        } else {
            res.status(200).json(results.rows);
        }
    });
})

router.get('/users', (req, res) => {
    db.query('SELECT * FROM accounts', (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error retrieving users');
        } else {
            res.json(results.rows);
        }
    });
})



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use("/api/",router)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})