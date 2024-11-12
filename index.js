
const express = require('express')
// const c = require('express-handlebars');
const pg = require('pg')
const cors = require('cors');
const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const fs = require("fs");
const jwt = require('jsonwebtoken');
const { verify } = require('crypto');
const path = require('path');



const generateToken = (user) => {
    const token = jwt.sign({ userId: user.id }, 'cat-store'); // No 'expiresIn' option
    return token;
  };

const app = express()
app.use(express.static(path.join(__dirname, 'public')));
const port = 3000

const router = express.Router()
app.use(express.json())
require("dotenv").config();

function removeVietnameseTones(str) {
    str = str.normalize('NFD')
             .replaceAll(/[\u0300-\u036f]/g, '')
             .normalize('NFC');
    return str.replaceAll('đ','d').replaceAll('Đ','D');
}

function group(rows){
    
    let products = {}
    rows.forEach((row)=>{
        if (row.name in products){
            products[row.name].id.push(row.id)
            products[row.name].size.push(row.size)
            products[row.name].cost.push(row.cost)
            products[row.name].sale.push(row.sale)
            products[row.name].datesale_from.push(row.datesale_from)
            products[row.name].datesale_to.push(row.datesale_to)
        }
        else{
            row.id = [row.id]
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
    return r;
}

function generateId(s){
    return removeVietnameseTones(s).toLowerCase().replaceAll(" ","-")
}

// const hbsOptions = {
//     viewEngine:{
//         defaultLayout: false
//     },
//     viewPath: 'views'
// }

// const hbs = c.create(hbsOptions)



app.get('/email', (req, res) => {
  res.sendFile();
});


// transporter.use('compile', hbs)
    
    async function sendTo(email_to,name_to,token) {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            host: "smtp.gmail.com",
            secure: false, // true for port 465, false for other ports
            auth: {
                user: "kdk2003.sgu@gmail.com",
                pass: "zoexwccztcsxpozw",
            },
            });
        const source = fs.readFileSync(path.join(__dirname, 'template', 'verify.html'), 'utf-8').toString();
        const template = handlebars.compile(source);
        const replacements = {
        fullname: name_to,
        token:token
        }; 
        const htmlToSend = template (replacements)
    const info = await transporter.sendMail({
        from: '"COFFEE STORE" <kdk2003.sgu@gmail.com>', 
        to: email_to,
        subject: "Xác thực tài khoản", 
        text: "Xác thực tài khoản", 
        html:htmlToSend,
    });
    
    console.log("Message sent: %s", info.messageId);
    // Message sent: <d786aa62-4e0a-070a-47ed-0b0666549519@ethereal.email>
    }
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
router.get('/get/users/:token', (req, res) => {
    const token = req.params.token;
    pool.query(`SELECT id,fullname,email,point,verify FROM USERS WHERE token='${token}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Failed'});
        } else {
            if (results.rowCount==0)
                return res.status(200).json({result:'Not Exist'});
            const user = results.rows[0]
            if (user.verify==1){
                user['result']='Success'
            }
            else{
                user = {result:'Not Verify'}
            }
            res.status(200).json(user);
        }
    });
})



router.get('/get/users/:email/:password', (req, res) => {
    const email = req.params.email;
    const password = req.params.password;
    if (!email || !password) {
        return res.status(400).json({ result: 'Missing required fields' });
    }
    pool.query(`SELECT id,fullname,email,point,verify,token FROM USERS WHERE email='${email}' AND password='${password}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Failed'});
        } else {
            if (results.rowCount==0)
                return res.status(200).json({result:'Not Exist'});
            const user = results.rows[0]
            if (user.verify==1){
                user['result']='Success'
            }
            else{
                user = {result:'Not Verify'}
            }
            res.status(200).json(user);
        }
    });
})


router.get('/get/users/address/:uid', (req, res) => {
    const uid = req.params.uid;
    pool.query(`SELECT ares.* FROM users
FULL JOIN (SELECT * FROM address) as ares ON ares.uid='${uid}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Failed'});
        } else {
            const address = results.rows
            address['result']='Success'
            res.status(200).json(address);
        }
    });
})

router.post('/post/users/address', (req, res) => {
    const form = req.body;
    const uid=form.uid
    const receiver=form.receiver
    const contactNumber=form.contactNumber
    const address=form.address
    const addressDefault=form.addressDefault
    pool.query(`INSERT INTO Address (uid,receiver, contactNumber,address, addressDefault) VALUES
    ('${uid}', '${receiver}', '${contactNumber}', '${address}', '${addressDefault}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error: Insert Into');
        } else {
            res.status(200).send('Success');
        }
    });
})


router.post('/post/register', async (req, res) => {
    const user = req.body;
    const fullname=user.fullname
    const email = user.email
    const password=user.password

    const token = generateToken(
        { 
            email: email,
            password: password 
        });
        
    pool.query(`INSERT INTO USERS (fullname, email, password, token) VALUES
    ('${fullname}', '${email}', '${password}', '${token}')`, async (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error: Insert Into');
        } else {
            await sendTo(email,fullname,token)
            return res.status(200).send("Successful")
        }
    });

    
    
})

router.put('/put/users/verify', (req, res) => {
    const token = req.body.token
    console.log(token);
    pool.query(`UPDATE USERS SET verify=1 WHERE token='${token}' AND verify=0`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {

            return res.status(200).json({result:(results.rowCount==1)?'Success':'Verified'})
        }
    });
})

router.get('/get/users', (req, res) => {
    pool.query('SELECT * FROM accounts', (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {
            res.json(results.rows);
        }
    });
})

// ==========================PRODUCT================================
router.get('/get/products/all', (req, res) => {
    pool.query(`SELECT products.*,CATEGORIES.name AS c_name,CATEGORIES.type AS c_type FROM PRODUCTS LEFT JOIN CATEGORIES ON PRODUCTS.cid=CATEGORIES.id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {
            res.status(200).json(group(results.rows));
        }
    });
})

router.get('/get/products/:key', (req, res) => {
    let key = removeVietnameseTones(req.params.key);
    if (key!='all'){
        pool.query(`SELECT * FROM PRODUCTS WHERE LOWER(name) LIKE '%${key}%' OR LOWER(name_id) LIKE '%${key}%'`, (error, results) => {
            if (error) {
                console.error(error);
                res.status(500).send('Error',error);
            } else {
                
                res.status(200).json(group(results.rows));
            }
        });
    }
})

router.get('/get/products/ids/:ids', (req, res) => {
    const ids = req.params.ids;
    pool.query(`SELECT * FROM PRODUCTS WHERE id in (${ids})`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {
            
            res.status(200).json(group(results.rows));
        }
    });
})

router.get('/get/all-products/:name_id_category', (req, res) => {
    const name_id_category = req.params.name_id_category;
    if (!name_id_category||name_id_category.trim()==''){
        return res.status(400).send('Failed');
    }
    pool.query(`SELECT PRODUCTS.* FROM PRODUCTS,(SELECT id FROM CATEGORIES WHERE name_id='${name_id_category}') AS c
        WHERE c.id=PRODUCTS.cid AND PRODUCTS.shelf_status=1`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {
            
            res.status(200).json(group(results.rows));
        }
    });
})

router.post('/post/products', (req, res) => {
    //(name,size,cost,cid) 
    const form = req.body;
    const name=form.name
    const name_id = generateId(name)
    const size=form.size
    const cost=form.cost
    const cid=form.cid
    // const sale=form.sale
    pool.query(`INSERT INTO PRODUCTS (name_id,name, size,cost,cid) VALUES
    ('${name_id}', '${name}', '${size}', '${cost}', '${cid}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error: Insert Into');
        } else {
            res.status(200).send('Success');
        }
    });
})

// ==========================CUSTOMER-REVIEWS================================
router.post('/post/customer-reviews', (req, res) => {
    const form = req.body;
    const pid=form.pid
    const point=form.point
    const name=form.name
    const email=form.email
    const comment=form.comment
    const name_id=form.name_id
    pool.query(`INSERT INTO CUSTOMER_REVIEWS (name_id,pid,point,name, email,comment) VALUES
    ('${name_id}','${pid}', '${point}', '${name}', '${email}', '${comment}')`, (error, results) => {
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
    pool.query(`SELECT * FROM CUSTOMER_REVIEWS WHERE name_id = '${id}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
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
            res.status(500).send('Error',error);
        } else {
            res.status(200).json(results.rows);
        }
    });
})

router.get('/get/categories/group-by-type', (req, res) => {
    pool.query(`SELECT * FROM CATEGORIES`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {
            let group_categories = {}
            results.rows.forEach((category)=>{
                if (category.type in group_categories){
                    group_categories[category.type].push(category)
                }else{
                    group_categories[category.type]=[category]
                }
            })
            res.status(200).json(group_categories);
        }
    });
})

router.post('/post/categories', (req, res) => {
    //(name,size,cost,cid) 
    const form = req.body;
    const name=form.name
    const name_id = generateId(name)
    const type = form.type
    // const sale=form.sale
    pool.query(`INSERT INTO CATEGORIES(name,type,name_id) VALUES
    ('${name}', '${type}', '${name_id}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error: Insert Into');
        } else {
            res.status(200).send('Success');
        }
    });
})







app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use(cors({
    origin: ['http://localhost:4200' ,'https://caf-bay.vercel.app', 'http://localhost:3000']
   ,methods: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  allowedHeaders: ['Content-Type']
  }));

app.use("/api/",router)


app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

