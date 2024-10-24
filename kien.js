// nodemon kien.js
const express = require('express')
const pg = require('pg')
const cors = require('cors');
const app = express()
const port = 3000

const router = express.Router()
app.use(express.json())
require("dotenv").config();

function removeVietnameseTones(str) {
    str = str.normalize('NFD')
             .replace(/[\u0300-\u036f]/g, '')
             .normalize('NFC');
    return str;
}

function group(rows){
    
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
    return r;
}

function generateId(s){
    return removeVietnameseTones(s).replaceAll(" ","-").toLowerCase()
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

//Viết code ở đây

// ==========================BILL================================

router.post('/post/bill',(req,res)=>{
    const bill=req.body;
    // const id=bill.id
    const nameCustomer=bill.nameCustomer
    const contactNumber=bill.contactNumber
    const address=bill.address
    // const BillDate=bill.BillDate
    const total=bill.total
    const Subtotal=bill.Subtotal
    const discount=bill.discount
    const payment=bill.paymentmethod
    // const status=bill.status
    // const note=bill.note
    pool.query(`Insert into bill  (nameCustomer,contactNumber,address,total,Subtotal,discount,paymentmethod) values
        ('${nameCustomer}','${contactNumber}','${address}','${total}','${Subtotal}',${discount},'${payment}')`,(error, results) =>{
            if (error) {
                console.error(error);
                res.status(500).send('NOT EXIST CUSTOMER-REVIEWS FOR THIS PRODUCT');
            } else {
                res.status(200).send('Succes');
            }
        }
    );
}
)

// ==========================DetailBILL================================

router.post('/post/detailBill',(req,res)=>{
    const detailBill=req.body;
    // const id=detailBill.id
    const bid=detailBill.bid
    const pid=detailBill.pid
    const quantity=detailBill.quantity
    const price=detailBill.price
    // const sale=detailBill.sale
    pool.query(`Insert into detailbill (bid,pid,quantity,price) values('${bid}','${pid}','${quantity}','${price}')`,(error,results)=>{
        if(error) {
            console.error(error);
            res.status(500).send('NOT EXIST CUSTOMER-REVIEWS FOR THIS PRODUCT');
        } else{
            res.status(200).send('Success');
        }
    }
    );
}
)

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


