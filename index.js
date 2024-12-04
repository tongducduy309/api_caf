
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
const { Storage } = require("@google-cloud/storage");
const formidable = require("formidable-serverless");
var admin = require("firebase-admin");
const UUID = require("uuid-v4");
var serviceAccount = require("./key/newapp-a6378-firebase-adminsdk-zuy4c-1478977781.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });


const storage = new Storage({
keyFilename: "./key/newapp-a6378-firebase-adminsdk-zuy4c-1478977781.json",
});



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

function formatPrice(num) {
    try {
      return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    catch (e){
      return '0'
    }
    return num
  }




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

async function sendEmail_Order(email_to,user,bill) {
    
    const source = fs.readFileSync(path.join(__dirname, 'template', 'bill.html'), 'utf-8').toString();
    const template = handlebars.compile(source);
    for (let product of bill.products){
        if (product.sale>0){
            product.cost_not_sale=formatPrice(product.cost)
            product.price=formatPrice((product.sale>0)?(product.cost-product.cost*(product.sale/100)):product.cost)
        }
        else product.price=formatPrice(product.cost)
    }
    console.log(bill.products);
    const replacements = {
    user:user,
    bill:{
        products:bill.products,
        cost_not_discount:formatPrice(bill.cost/(1-bill.discount/100)),
        subtotal:formatPrice(bill.subtotal),
        delivery_fee:formatPrice(bill.delivery_fee),
        discount:bill.discount,
        cost:formatPrice(bill.cost)
        
    }
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
    token:token,
    email:email_to
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

// ==========================USER================================
router.get('/get/check-admin/:token', (req, res) => {
    const token = req.params.token;
    pool.query(`SELECT id FROM USERS WHERE token='${token}' And role = '1'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            if (results.rowCount==0)
                return res.status(200).json({result:'failed'});
            let user = results.rows[0]
            user['result']='success'
            res.status(200).json(user);
        }
    });
})



// ==========================USER================================
router.get('/get/users/:token', (req, res) => {
    const token = req.params.token;
    pool.query(`SELECT id,fullname,email,point,verify,role FROM USERS WHERE token='${token}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            if (results.rowCount==0)
                return res.status(200).json({result:'Not Exist'});
            let user = results.rows[0]
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
    pool.query(`SELECT id,fullname,email,point,verify,token,password,role FROM USERS WHERE email='${email}'`, async (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            if (results.rowCount==0)
                return res.status(200).json({result:'Not Exist'});
            let user = results.rows[0]
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
    pool.query(`SELECT * FROM address_of_user WHERE uid='${uid}' ORDER BY default_ desc`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            const address = results.rows;
            
            
            res.status(200).json({data:address,result:'success'});
        }
    });
})

router.get('/get/reset-your-password/:email', (req, res) => {
    const email = req.params.email;
    pool.query(`SELECT * FROM USERS WHERE email='${email}'`, async (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({result:'failed',message:error});
        } else {
            
            if (results.rows.length==0)
                return res.status(200).json({result:'Not Exist'});
            const user = results.rows[0]
            await sendEmail_ResetYourPassword(email,user.fullname,user.token)
            res.status(200).json({result:'success'});
        }
    });
})

router.post('/post/address-of-user', (req, res) => {
    const form = req.body;
    const uid=form.uid
    const receiver=form.receiver
    const contactnumber=form.contactnumber
    const address=form.address
    const default_=form.default_
    pool.query(`Select Add_Address(${uid}, '${receiver}', '${contactnumber}', '${address}','${default_}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({data:results.rows[0].add_address,result:'success'});
        }
    });
})

router.delete('/delete/address-of-user/:aid', (req, res) => {
    const form = req.params;
    const aid=form.aid
    pool.query(`DELETE FROM ADDRESS_OF_USER WHERE id='${aid}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
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
            res.status(500).json({result:'failed',message:error});
        } else {

            return res.status(200).json({result:'success'})
        }
    });
})

router.put('/put/address-of-user/default', (req, res) => {
    const address = req.body
    const id = address.id
    const uid = address.uid
    pool.query(`UPDATE address_of_user
SET default_ = CASE WHEN id = '${id}' THEN TRUE ELSE FALSE END
WHERE uid = '${uid}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {

            return res.status(200).json({result:'success'})
        }
    });
})

router.put('/put/users/password', async (req, res) => {
    const user = req.body
    const email = user.email
    const password=await argon2.hash(user.password);
    const token = user.token
    const token_new = generateToken(
        { 
            email: email,
            password: password 
        });
    pool.query(`UPDATE USERS SET password = '${password}', token = '${token_new}' WHERE token='${token}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {

            return res.status(200).json({result:(results.rowCount==1)?'success':'failed',data:token_new})
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
            res.status(500).json({result:'failed',message:error});
        } else {
            if (results.rows[0].register=='Success'){
                await sendEmail_register(email,fullname,token)
                return res.status(200).json({result:'success'})
            }
            if (results.rows[0].register=='Existed'){
                return res.status(200).json({result:'existed'})
            }
            else return res.status(500).json({result:'failed',message:error});
            
        }
    });

    
    
})

router.put('/put/users/verify', (req, res) => {
    const token = req.body.token
    console.log(token);
    pool.query(`UPDATE USERS SET verify=1 WHERE token='${token}' AND verify=0`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
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
            res.status(500).json({result:'failed',message:error});
        } else {

            return res.status(200).json({result:'success'})
        }
    });
})

// router.get('/get/users', (req, res) => {
//     pool.query('SELECT * FROM accounts', (error, results) => {
//         if (error) {
//             console.error(error);
//             res.status(500).json({result:'failed',message:error});
//         } else {
//             res.json(results.rows);
//         }
//     });
// })

// ==========================PRODUCT================================
router.get('/get/products/all', (req, res) => {
    pool.query(`SELECT PRODUCTS.*, FS.SALE, FS.DATESALE_FROM,FS.DATESALE_TO FROM (SELECT products.*,CATEGORIES.name AS c_name,CATEGORIES.type AS c_type FROM (SELECT PRODUCTS.*,IMG_PRODUCT.img FROM PRODUCTS LEFT JOIN IMG_PRODUCT ON PRODUCTS.name_id=IMG_PRODUCT.p_name_id) AS PRODUCTS LEFT JOIN CATEGORIES ON PRODUCTS.cid=CATEGORIES.id) AS PRODUCTS LEFT JOIN (SELECT * FROM FLASH_SALES WHERE NOW()>= DATESALE_FROM AND NOW()<=DATESALE_TO) AS FS ON FS.pid=PRODUCTS.id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({data:group(results.rows),result:'success'});
        }
    });
})

// router.get('/get/products-by-customer-reviews/:number', (req, res) => {
//     const number = req.params.number
//     query = `SELECT PRODUCTS.*,CS.point FROM (SELECT PRODUCTS.*, FS.SALE, FS.DATESALE_FROM,FS.DATESALE_TO FROM (SELECT products.*,CATEGORIES.name AS c_name,CATEGORIES.type AS c_type FROM (SELECT PRODUCTS.*,IMG_PRODUCT.img FROM PRODUCTS LEFT JOIN IMG_PRODUCT ON PRODUCTS.name_id=IMG_PRODUCT.p_name_id) AS PRODUCTS LEFT JOIN CATEGORIES ON PRODUCTS.cid=CATEGORIES.id) AS PRODUCTS LEFT JOIN (SELECT * FROM FLASH_SALES WHERE NOW()>= DATESALE_FROM AND NOW()<=DATESALE_TO) AS FS ON FS.pid=PRODUCTS.id) AS PRODUCTS LEFT JOIN (select name_id,AVG(point) AS point from CUSTOMER_REVIEWS GROUP BY name_id) AS CS ON CS.name_id=PRODUCTS.name_id 
// ORDER BY CS.point DESC`
//     pool.query(query, (error, results) => {
//         if (error) {
//             console.error(error);
//             res.status(500).json({result:'failed',message:error});
//         } else {
//             if (number=='all')
//                 res.status(200).json({data:group(results.rows),result:'success'});
//             else
//             res.status(200).json({data:group(results.rows).slice(0,number),result:'success'});
//         }
//     });
// })

router.get('/get/products/:key', (req, res) => {
    let key_name = req.params.key
    let key = removeVietnameseTones(req.params.key);
    if (key!='all'){
        pool.query(`SELECT P.*,IMG_PRODUCT.img FROM (SELECT * FROM PRODUCTS WHERE LOWER(name) LIKE '%${key_name}%' OR LOWER(name_id) LIKE '%${key}%') as P LEFT JOIN IMG_PRODUCT ON P.name_id=IMG_PRODUCT.p_name_id
            `, (error, results) => {
            if (error) {
                console.error(error);
                res.status(500).json({result:'failed',message:error});
            } else {
                
                res.status(200).json({data:group(results.rows),result:'success'});
            }
        });
    }
})

router.get('/get/product/:id', (req, res) => {
    const id = req.params.id
    pool.query(`SELECT PRODUCTS.*, IMG_PRODUCT.img FROM (SELECT * FROM PRODUCTS WHERE id='${id}' AND shelf_status=true) AS PRODUCTS LEFT JOIN IMG_PRODUCT ON IMG_PRODUCT.p_name_id=PRODUCTS.name_id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({data:results.rows[0],result:'success'});
        }
    });
})

router.get('/get/flash-sales/all', (req, res) => {
    pool.query(`SELECT PRODUCTS.*, FS.SALE, FS.DATESALE_FROM,FS.DATESALE_TO FROM (SELECT products.id,products.img,products.name,products.size,products.cost,CATEGORIES.name AS c_name FROM (SELECT PRODUCTS.*,IMG_PRODUCT.img FROM PRODUCTS LEFT JOIN IMG_PRODUCT ON PRODUCTS.name_id=IMG_PRODUCT.p_name_id) AS PRODUCTS LEFT JOIN CATEGORIES ON PRODUCTS.cid=CATEGORIES.id) AS PRODUCTS RIGHT JOIN (SELECT * FROM FLASH_SALES WHERE NOW()>= DATESALE_FROM AND NOW()<=DATESALE_TO) AS FS ON FS.pid=PRODUCTS.id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            
            res.status(200).json({data:results.rows,result:'success'});
        }
    });
})

router.get('/get/all-products/:name_id_category', (req, res) => {
    const name_id_category = req.params.name_id_category;
    if (!name_id_category||name_id_category.trim()==''){
        return res.status(400).json({result:'failed',message:error});
    }
    pool.query(`
        SELECT PRODUCTS.*,IMG_PRODUCT.img FROM (SELECT PRODUCTS.* FROM PRODUCTS,(SELECT id FROM CATEGORIES WHERE name_id='${name_id_category}') AS c
        WHERE c.id=PRODUCTS.cid) as PRODUCTS LEFT JOIN IMG_PRODUCT ON PRODUCTS.name_id=IMG_PRODUCT.p_name_id`, (error, results) => {
            // AND PRODUCTS.shelf_status=1
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            
            res.status(200).json({data:group(results.rows),result:'success'});
        }
    });
})

router.post("/post/products", (req, res) => {
    const form = new formidable.IncomingForm({ multiples: true });
  
    try {
      form.parse(req, async (err, fields, files) => {
        let uuid = UUID();
        var downLoadPath =
          "https://firebasestorage.googleapis.com/v0/b/newapp-a6378.appspot.com/o/";
  
        const img = files.img;
        const name=fields.name
        const name_id = generateId(name)
        const listsize = JSON.parse(fields.listsize)
        // const size=fields.size
        // const cost=fields.cost
        const cid=fields.cid
        const description=fields.description
        const shelf_status=fields.shelf_status
        

        
  
        // url of the uploaded image
        let imageUrl;
  
        const bucket = storage.bucket("gs://newapp-a6378.appspot.com");
  
        if (img.size == 0) {
          // do nothing
          res.status(400)
        } else {
          const imageResponse = await bucket.upload(img.path, {
            destination: `Product/${img.name}`,
            resumable: true,
            metadata: {
                metadata: {
                  firebaseStorageDownloadTokens: uuid,
                },
              },
          });
          // profile image url
          imageUrl =
            downLoadPath +
            encodeURIComponent(imageResponse[0].name) +
            "?alt=media&token=" +
          uuid;
          let data = ''
        for (let s of listsize){
            data+=`('${name_id}', '${name}', '${s.size}', '${parseInt(s.cost)}', '${cid}' , '${description}', '${shelf_status}'),`
        }
        data = data.slice(0, -1);
        // console.log(data);
        // const sale=form.sale
        pool.query(`INSERT INTO PRODUCTS (name_id,name, size,cost,cid,description,shelf_status) VALUES
        ${data} ; INSERT INTO IMG_PRODUCT(img,p_name_id) VALUES ('${imageUrl}','${name_id}')`, (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({result:'failed',message:error});
            } 
            else{
                return res.status(200).json({result:"success"})
            }
        });
            // res.send(imageUrl)
        }

        
        // object to send to database
        // const userModel = {
        //   id: docID,
        //   name: fields.name,
        //   email: fields.email,
        //   age: fields.age,
        //   img: img.size == 0 ? "" : imageUrl,
        // };
  
        
      });
    } catch (err) {
      res.send({
        message: "Something went wrong",
        data: {},
        error: err,
      });
    }
});

router.delete('/delete/products/:name_id/:img', async (req, res) => {
    const form = req.params;
    const name_id=form.name_id
    const img=form.img.replaceAll("$$","/").replaceAll("@@","?")

    try {
        const bucket = storage.bucket("gs://newapp-a6378.appspot.com");
        
        const filePath = img.split('?')[0].split('/b/')[1].split('/o/')[1];
        bucket.file(filePath).delete()
        .then(() => {
            console.log('File deleted successfully.');
        })
        .catch((error) => {
            console.error('Error deleting file:', error);
            return res.status(500).json({result:'failed',message:error});
        });
    } catch (error) {
        return res.status(500).json({result:'failed',message:error});
    }
    pool.query(`DELETE FROM Products WHERE name_id='${name_id}' ; DELETE FROM IMG_PRODUCT WHERE p_name_id='${name_id}'`, (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({result:'success'});
        }
    });


})

router.post('/post/flash-sales', async (req, res) => {
    const form = req.body;
    const list = form.list
    let data = ''
    for (let s of list){
        data+=`('${s.pid}', '${s.sale}' , '${s.datesale_from}', '${s.datesale_to}'),`
    }
    data = data.slice(0, -1);

    pool.query(`INSERT INTO FLASH_SALES(pid,sale,datesale_from,datesale_to) VALUES ${data}`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({result:'success'});
        }
    });
})

// router.post('/post/products', (req, res) => {
//     //(name,size,cost,cid) 
//     const form = req.body;
    
// })

// ==========================CUSTOMER-REVIEWS================================
router.post('/post/customer-reviews', (req, res) => {
    const form = req.body;
    const point=form.point
    const name=form.name
    const email=form.email
    const comment=form.comment
    const name_id=form.name_id
    pool.query(`INSERT INTO CUSTOMER_REVIEWS (name_id,point,name, email,comment) VALUES
    ('${name_id}', '${point}', '${name}', '${email}', '${comment}')`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({result:'success'});
        }
    });
})

router.get('/get/customer-reviews/:id', (req, res) => {
    const id = req.params.id;
    pool.query(`SELECT * FROM CUSTOMER_REVIEWS WHERE name_id = '${id}' ORDER BY created desc`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({result:'success',data:results.rows});
        }
    });
})

router.get('/get/best-customer-reviews/:number', (req, res) => {
    const number = req.params.number;
    
    pool.query(`SELECT DISTINCT p.id,p.*,IMG_PRODUCT.img FROM (select CS.*, products.name as p_name from (SELECT * FROM CUSTOMER_REVIEWS 
ORDER BY point DESC
LIMIT ${number}) as CS
LEFT JOIN PRODUCTS ON PRODUCTS.name_id=CS.name_id) as p
LEFT JOIN IMG_PRODUCT ON IMG_PRODUCT.p_name_id=p.name_id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({result:'success',data:results.rows});
        }
    });
})

// ==========================CATEGORY================================
router.get('/get/categories/all', (req, res) => {
    pool.query(`SELECT * FROM CATEGORIES`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({result:'success',data:results.rows});
        }
    });
})

router.get('/get/categories/group-by-type', (req, res) => {
    pool.query(`SELECT * FROM CATEGORIES`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            let group_categories = {}
            results.rows.forEach((category)=>{
                if (category.type in group_categories){
                    group_categories[category.type].push(category)
                }else{
                    group_categories[category.type]=[category]
                }
            })
            res.status(200).json({result:'success',data:group_categories});
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
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({result:'success'});
        }
    });
})


// ==========================CHECKOUT================================
router.post('/post/checkout', async (req, res) => {
    const form = req.body;
    const bill=form.bill
    const user=form.user
    const inCart = form.inCart
    let query = ''
    let cart_ids = []

    let data = ''
    const bid = bill.id
    for (let s of bill.products){
        data+=`('${bid}', '${s.pid}', '${s.quantity}', '${s.cost}', '${s.sale}' , '${s.note}'),`
        if (inCart){
            cart_ids.push(s.id)
        }
    }
    data = data.slice(0, -1);
    if (inCart){
        const ids = cart_ids.join(",")
        query = `DELETE FROM CART WHERE id IN (${ids}) ; `
    }

    const point = parseInt(Math.floor(bill.cost/1000))
    
    pool.query(query+`INSERT INTO BILL (id,uid,receiver,contactnumber,address,subtotal,delivery_fee,cost,discount,paymentmethod,payment_status) VALUES
    ('${bid}','${user.id}','${user.receiver}', '${user.contactnumber}', '${user.address}', '${bill.subtotal}', '${bill.delivery_fee}', '${bill.cost}', '${bill.discount}', '${bill.paymentmethod}', '${bill.payment_status}') ; 
    UPDATE USERS SET POINT = POINT + ${point} WHERE id = '${user.id}';
    INSERT INTO DETAIL_BILL (bid,pid,quantity,cost,sale,note) VALUES `+data, async (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'error',message:error});
        } else {
            
            
            await sendEmail_Order(user.email,user,bill)
            res.status(200).json({result:'success'});
        }
    });
    
    // const products=form.products
    // res.status(200).send({result:'success'});
})


// ==========================CART================================
router.get('/get/cart/:uid', (req, res) => {
    const uid = req.params.uid
    pool.query(`SELECT PRODUCTS.*,IMG_PRODUCT.img FROM (SELECT PRODUCTS.name, PRODUCTS.name_id,PRODUCTS.cost,PRODUCTS.size,PRODUCTS.shelf_status,c.id,c.pid,c.note,c.quantity FROM (SELECT * FROM CART WHERE uid='${uid}') AS c
        LEFT JOIN PRODUCTS ON c.pid=PRODUCTS.id) AS PRODUCTS LEFT JOIN IMG_PRODUCT ON IMG_PRODUCT.p_name_id=PRODUCTS.name_id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed'});
        } else {
            res.status(200).json({data:results.rows,result:'success'});
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
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({data:results.rows[0].add_to_cart,result:'success'});
        }
    });
})

router.delete('/delete/cart/:id', (req, res) => {
    const form = req.params;
    const id=form.id
    pool.query(`DELETE FROM cart WHERE id='${id}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            res.status(200).json({result:'success'});
        }
    });
})

router.put('/put/cart', (req, res) => {
    const item = req.body

    pool.query(`UPDATE CART SET quantity = '${item.quantity}' WHERE id='${item.id}'`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {

            return res.status(200).json({result:(results.rowCount==1)?'success':'failed'})
        }
    });
})


// ==========================VOUCHER================================
router.get('/get/voucher', (req, res) => {
    const code = req.params.code
    pool.query(`SELECT * FROM voucher`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed'});
        } else {
            res.status(200).json({data:results.rows,result:'success'});
        }
    });
})
router.get('/get/voucher/:code', (req, res) => {
    const code = req.params.code
    pool.query(`SELECT * FROM voucher WHERE code="${code}" AND NOW()>= DATE_FROM AND NOW()<=DATE_TO`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed'});
        } else {
            res.status(200).json({data:results.rows,result:'success'});
        }
    });
})

// ==========================BILL================================
router.get('/get/bills/:uid', (req, res) => {
    const uid = req.params.uid
    pool.query(`SELECT PRODUCTS.*,img FROM (SELECT bill.*, PRODUCTS.name_id,PRODUCTS.name FROM (SELECT BILL.*,pid,quantity,DB.cost as p_cost,sale,note FROM (SELECT * FROM BILL WHERE uid = '${uid}') as BILL
LEFT JOIN DETAIL_BILL AS DB ON DB.bid = BILL.id) AS BILL
LEFT JOIN PRODUCTS ON BILL.pid=PRODUCTS.id) AS PRODUCTS
LEFT JOIN IMG_PRODUCT ON IMG_PRODUCT.p_name_id=PRODUCTS.name_id ORDER BY PRODUCTS.created desc`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            let bills = {}
            results.rows.forEach((row)=>{
                if (row.id in bills){
                    bills[row.id].products.push({
                        quantity:row.quantity,
                        sale:row.sale,
                        note:row.note,
                        name:row.name,
                        img:row.img,
                        cost:row.p_cost
                    })
                }
                else{
                    bills[row.id] = {
                        id:row.id,
                        uid:row.uid,
                        receiver:row.receiver,
                        contactnumber:row.contactnumber,
                        address:row.address,
                        created:row.created,
                        subtotal:row.subtotal,
                        delivery_fee:row.delivery_fee,
                        cost:row.cost,
                        discount:row.discount,
                        paymentmethod:row.paymentmethod,
                        payment_status:row.payment_status,
                        status:row.status,
                        products:[
                            {
                                quantity:row.quantity,
                                sale:row.sale,
                                note:row.note,
                                name:row.name,
                                img:row.img,
                                cost:row.p_cost
                            }
                        ]
                    }
                }
            })
            let r = []
            Object.keys(bills).forEach((key)=>{
                r.push(bills[key])
            })
            res.status(200).json({result:'success',data:r});
        }
    });
})

router.get('/get/bill/:bid/:uid', (req, res) => {
    const bid = req.params.bid
    const uid = req.params.uid
    pool.query(`SELECT PRODUCTS.*,img FROM (SELECT bill.*, PRODUCTS.name_id,PRODUCTS.name FROM (SELECT BILL.*,pid,quantity,DB.cost as p_cost,sale,note FROM (SELECT * FROM BILL WHERE id = '${bid}' AND uid = '${uid}') as BILL
LEFT JOIN DETAIL_BILL AS DB ON DB.bid = BILL.id) AS BILL
LEFT JOIN PRODUCTS ON BILL.pid=PRODUCTS.id) AS PRODUCTS
LEFT JOIN IMG_PRODUCT ON IMG_PRODUCT.p_name_id=PRODUCTS.name_id`, (error, results) => {
        if (error) {
            console.error(error);
            res.status(500).json({result:'failed',message:error});
        } else {
            let bills = {}
            results.rows.forEach((row)=>{
                if (row.id in bills){
                    bills[row.id].products.push({
                        quantity:row.quantity,
                        sale:row.sale,
                        note:row.note,
                        name:row.name,
                        img:row.img,
                        cost:row.p_cost
                    })
                }
                else{
                    bills[row.id] = {
                        id:row.id,
                        uid:row.uid,
                        receiver:row.receiver,
                        contactnumber:row.contactnumber,
                        address:row.address,
                        created:row.created,
                        subtotal:row.subtotal,
                        delivery_fee:row.delivery_fee,
                        cost:row.cost,
                        discount:row.discount,
                        paymentmethod:row.paymentmethod,
                        payment_status:row.payment_status,
                        status:row.status,
                        products:[
                            {
                                quantity:row.quantity,
                                sale:row.sale,
                                note:row.note,
                                name:row.name,
                                img:row.img,
                                cost:row.p_cost
                            }
                        ]
                    }
                }
            })
            let r = []
            Object.keys(bills).forEach((key)=>{
                r.push(bills[key])
            })
            res.status(200).json({result:'success',data:(r.length>0)?r[0]:null});
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

