
const express = require('express')
// const c = require('express-handlebars');
const pg = require('pg')
const cors = require('cors');
const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const fs = require("fs");
const jwt = require('jsonwebtoken');
// const { verify } = require('crypto');
const path = require('path');
const argon2 = require('argon2');



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

async function verifyPassword(password,   
 hash) {
    const match = await argon2.verify(hash, password);
    return match;
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
const transporter = nodemailer.createTransport({
    service:"gmail",
    host: "smtp.gmail.com",
    secure: false, // true for port 465, false for other ports
    auth: {
        user: "kdk2003.sgu@gmail.com",
        pass: "zoexwccztcsxpozw",
    },
});
    
async function sendEmail_register(email_to,name_to,token) {
    
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

    console.log("Message sent: %s", info.messageId)
}

async function sendEmail_Order(email_to,user) {
    
    const source = fs.readFileSync(path.join(__dirname, 'template', 'bill.html'), 'utf-8').toString();
    const template = handlebars.compile(source);
    const replacements = {
    user:user,
    products:[
        {name:"C",
            quantity:2,
            size:"L",
            note:"Ít đá"
        }
    ]
    }; 
    const htmlToSend = template (replacements)
    const info = await transporter.sendMail({
        from: '"COFFEE STORE" <kdk2003.sgu@gmail.com>', 
        to: email_to,
        subject: "Thông báo đơn hàng", 
        text: "Thông báo đơn hàng", 
        html:htmlToSend,
    });

    console.log("Message sent: %s", info.messageId)
}

async function sendEmail_ResetYourPassword(email_to,fullname,token) {
    
    const source = fs.readFileSync(path.join(__dirname, 'template', 'reset_your_password.html'), 'utf-8').toString();
    const template = handlebars.compile(source);
    const replacements = {
    fullname:fullname,
    token:token
    }; 
    const htmlToSend = template (replacements)
    const info = await transporter.sendMail({
        from: '"COFFEE STORE" <kdk2003.sgu@gmail.com>', 
        to: email_to,
        subject: "Đặt Lại Mật Khẩu", 
        text: "Đặt Lại Mật Khẩu", 
        html:htmlToSend,
    });

    console.log("Message sent: %s", info.messageId)
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

// ==========================Admin================================
router.get('/get/sf/:token', (req, res) => {
    const token = req.params.token;
    pool.query(`SELECT id,role FROM USERS WHERE token='${token}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Failed'});
        } else {
            if (results.rowCount==0)
                return res.status(200).json({result:'Not Exist'});
            const user = results.rows[0]
            user['result']='Success'
            res.status(200).json(user);
        }
    });
})

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
    pool.query(`SELECT id,fullname,email,point,verify,token,password FROM USERS WHERE email='${email}'`, async (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Failed'});
        } else {
            if (results.rowCount==0)
                return res.status(200).json({result:'Not Exist'});
            const user = results.rows[0]
            const isMatch = await argon2.verify(user.password, password);
            if (!isMatch)
                return res.status(200).json({result:'Wrong Password'});
            if (user.verify==1){
                user['result']='Success'
            }
            else{
                user = {result:'Not Verify'}
            }
            delete user['password']
            res.status(200).json(user);
        }
    });
})


router.get('/get/address-of-user/:uid', (req, res) => {
    const uid = req.params.uid;
    pool.query(`SELECT * FROM address_of_user WHERE uid='${uid}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Failed'});
        } else {
            const address = results.rows
            for (let a of address){
                if (a.uid==uid){
                    a['default']=true
                }
                else a['default']=false
            }
            // address['result']='Success'
            
            
            res.status(200).json({rows:address,result:'success'});
        }
    });
})

router.get('/get/rest-your/:email', (req, res) => {
    const email = req.params.email;
    pool.query(`SELECT * FROM USERS WHERE email='${email}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed'});
        } else {
            const address = results.rows
            
            
            res.status(200).json({rows:address,result:'success'});
        }
    });
})

router.post('/post/address-of-user', (req, res) => {
    const form = req.body;
    const uid=form.uid
    const receiver=form.receiver
    const contactnumber=form.contactnumber
    const address=form.address
    pool.query(`Select Add_Address(${uid}, '${receiver}', '${contactnumber}', '${address}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Error: '+error});
        } else {
            res.status(200).json({rows:results.rows[0].add_address,result:'success'});
        }
    });
})

router.post('/delete/address-of-user/:aid', (req, res) => {
    const form = req.params;
    const aid=form.aid
    pool.query(`DELETE FROM ADDRESS_OF_USER WHERE id='${aid}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Error: '+error});
        } else {
            res.status(200).json({result:'success'});
        }
    });
})

router.put('/put/address-of-user', (req, res) => {
    const address = req.body
    pool.query(`UPDATE address_of_user SET receiver = '${address.receiver}',contactnumber = '${address.contactnumber}',address = '${address.address}' WHERE id='${address.id}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {

            return res.status(200).json({result:(results.rowCount==1)?'Success':'Failed'})
        }
    });
})


router.post('/post/register', async (req, res) => {
    const user = req.body;
    const fullname=user.fullname
    const email = user.email
    const password=await argon2.hash(user.password);

    const token = generateToken(
        { 
            email: email,
            password: password 
        });
        
    pool.query(`SELECT REGISTER ('${fullname}', '${email}', '${password}', '${token}')`, async (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error: Insert Into');
        } else {
            if (results.rows[0].register=='Success'){
                await sendEmail_register(email,fullname,token)
                return res.status(200).send("Successful")
            }
            else return res.status(200).send("Failed")
            
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

router.put('/put/users/changeName', (req, res) => {
    const uid = req.body.uid
    const fullname = req.body.fullname
    pool.query(`UPDATE USERS SET fullname='${fullname}' WHERE id='${uid}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {

            return res.status(200).json({result:(results.rowCount==1)?'Success':'Failed'})
        }
    });
})

// router.get('/get/users', (req, res) => {
//     pool.query('SELECT * FROM accounts', (error, results) => {
//         if (error) {
//             console.error(error);
//             res.status(500).send('Error',error);
//         } else {
//             res.json(results.rows);
//         }
//     });
// })

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
    let key_name = req.params.key
    let key = removeVietnameseTones(req.params.key);
    if (key!='all'){
        pool.query(`SELECT * FROM PRODUCTS WHERE LOWER(name) LIKE '%${key_name}%' OR LOWER(name_id) LIKE '%${key}%'`, (error, results) => {
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
        WHERE c.id=PRODUCTS.cid`, (error, results) => {
            // AND PRODUCTS.shelf_status=1
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
            res.status(200).send('success');
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
            res.status(200).send('success');
        }
    });
})


// ==========================CHECKOUT================================
router.post('/post/checkout', async (req, res) => {
    const form = req.body;
    // const uid=form.uid
    // const bill=form.bill
    const user=form.user
    await sendEmail_Order(user.email,user)
    // const products=form.products
    res.status(200).send('success');
})

// ==========================CART================================
router.get('/get/cart/:uid', (req, res) => {
    const uid = req.params.uid
    pool.query(`SELECT PRODUCTS.*,c.note,c.quantity FROM (SELECT * FROM CART WHERE uid='${uid}') AS c
        LEFT JOIN PRODUCTS ON c.pid=PRODUCTS.id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Failed'});
        } else {
            res.status(200).json({rows:results.rows,result:'success'});
        }
    });
})

router.post('/post/cart', async (req, res) => {
    const form = req.body;
    const uid=form.uid
    const pid=form.pid
    const quantity=form.quantity
    const note=form.note

    pool.query(`Select Add_To_Cart('${uid}', '${pid}', '${quantity}', '${note}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Error: '+error});
        } else {
            res.status(200).json({rows:results.rows[0].add_to_cart,result:'success'});
        }
    });
})

router.post('/delete/cart/:id', (req, res) => {
    const form = req.params;
    const id=form.id
    pool.query(`DELETE FROM cart WHERE id='${id}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'Error: '+error});
        } else {
            res.status(200).json({result:'success'});
        }
    });
})

router.put('/put/cart', (req, res) => {
    const item = req.body

    pool.query(`UPDATE address_of_user SET quantity = '${item.quantity}' WHERE id='${item.id}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).send('Error',error);
        } else {

            return res.status(200).json({result:(results.rowCount==1)?'Success':'Failed'})
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

