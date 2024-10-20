const express = require('express')
const pg = require('pg')
const cors = require('cors');
const app = express()
const port = 3000

const router = express.Router()
app.use(express.json())
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

// const db =pool.connect();

// ==========================USER================================
router.post('/login', (req, res) => {
    const user = req.body;
    const username=user.username
    const password=user.password
    if (!username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    pool.query(`SELECT * FROM accounts WHERE USERNAME='${username}' AND PASSWORD='${password}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error retrieving users');
        } else {
            res.status(200).json(results.rows[0]);
        }
    });
})

//Chưa hoàn thành
router.post('/register', (req, res) => {
    const user = req.body;
    const username=user.username
    const password=user.password
    const firstName=user.firstName
    const lastName=user.lastName
    const email = user.email
    if (!username || !password) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    pool.query(`INSERT INTO accounts (username, email, password, firstname,lastname) VALUES
    ('${username}', '${email}', '${password}', '${firstName}', '${lastName}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error: Insert Into');
        } else {
            res.status(200);
        }
    });
})

router.get('get/users', (req, res) => {
    pool.query('SELECT * FROM accounts', (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error retrieving users');
        } else {
            res.json(results.rows);
        }
    });
})

// ==========================PRODUCT================================
router.get('/get/products/all', (req, res) => {
    pool.query(`SELECT products.* FROM PRODUCTS LEFT JOIN CATEGORIES ON PRODUCTS.cid=CATEGORIES.id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('NOT EXIST ANY PRODUCT');
        } else {
            res.status(200).json(results.rows);
        }
    });
})

router.get('/get/products/:key', (req, res) => {
    const key = req.params.key;
    if (key!='all'){
        let fl = true
        let query = `SELECT * FROM PRODUCTS WHERE LOWER(name) LIKE '%${key}%'`
        if (key.replaceAll(/\D/g, '')==key){
            query = `SELECT * FROM PRODUCTS WHERE LOWER(name) LIKE '%${key}%' OR id = ${key}`
            fl = false
        }
        pool.query(query, (error, results) => {
            if (error) {
                console.error(error);
                res.status(500).send('NOT EXIST ANY PRODUCT');
            } else {
                const rows = results.rows;
                let products = {}
                rows.forEach((row)=>{
                    if (row.name in products){
                        products[row.name].size.push(row.size)
                        products[row.name].cost.push(row.cost)
                        products[row.name].sale.push(row.sale)
                        products[row.name].datesale_from.push(row.datesale_from)
                        products[row.name].datesale_to.push(row.datesale_to)
                    }
                    else{
                        row.size = [row.size]
                        row.cost = [row.cost]
                        row.sale = [row.sale]
                        row.datesale_from = [row.datesale_from]
                        row.datesale_to = [row.datesale_to]
                        products[row.name] = {...row}
                    }
                })
                let r = []
                Object.keys(products).forEach((key)=>{
                    r.push(products[key])
                })
                res.status(200).json(r);
            }
        });
    }
})

// ==========================CUSTOMER-REVIEWS================================
router.post('/post/customer-reviews', (req, res) => {
    const form = req.body;
    const pid=form.pid
    const point=form.point
    const name=form.name
    const email=form.email
    const comment=form.comment
    pool.query(`INSERT INTO CUSTOMER_REVIEWS (pid,point,name, email,comment) VALUES
    ('${pid}', '${point}', '${name}', '${email}', '${comment}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error: Insert Into');
        } else {
            res.status(200).send('Success');
        }
    });
})

router.get('/get/customer-reviews/:id', (req, res) => {
    const id = req.params.id;
    pool.query(`SELECT * FROM CUSTOMER_REVIEWS WHERE pid = '${id}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('NOT EXIST CUSTOMER-REVIEWS FOR THIS PRODUCT');
        } else {
            res.status(200).json(results.rows);
        }
    });
})

// ==========================CATEGORY================================
router.get('/get/categories/all', (req, res) => {
    pool.query(`SELECT * FROM CATEGORIES`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error retrieving CATEGORIES');
        } else {
            res.status(200).json(results.rows);
        }
    });
})



app.get('/', (req, res) => {
  res.send('Hello World!')
})



app.use(cors({
    origin: ['http://localhost:4200' ,'https://caf-bay.vercel.app']
   ,methods: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  allowedHeaders: ['Content-Type']
  }));

app.use("/api/",router)


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})