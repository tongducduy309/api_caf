const express = require('express')
// const pg = require('pg')
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

// const db =pool.connect();


// router.get('/users', (req, res) => {
//     pool.query('SELECT * FROM accounts', (error, results) => {
//         if (error) {
//             console.error(error);
//             res.status(500).send('Error retrieving users');
//         } else {
//             res.json(results.rows);
//         }
//     });
// })

router.get('/products', (req, res) => {
    const products = [
        { id: 1, name: 'Sản phẩm 1' },
        { id: 2, name: 'Sản phẩm 2' }
    ];
    res.json(products);
});
app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use("/api/",router)

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})