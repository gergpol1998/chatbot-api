const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const mysql = require("mysql2");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Invoking the cors middleware

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USERNAME,
    password: process.env.PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DATABASE
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to database: ' + err.stack);
        return;
    }
    console.log(`Connected to database as ${db.config.database}`);
});

app.post("/v1/ask", async (req, res) => {
    const question = req.body.question;
    try {
        const typebookData = await new Promise((resolve, reject) => {
            db.query("SELECT COUNT(book_type.btype_typeid), typebook.type_name \
            FROM book \
            INNER JOIN bookscore ON bookscore.bscore_bookid = book.book_id \
            INNER JOIN book_type ON book_type.btype_bookid = book.book_id \
            INNER JOIN typebook ON typebook.type_id = book_type.btype_typeid \
            WHERE book_status = '2' AND bookscore.bscore_score >= 3 \
            GROUP BY book_type.btype_typeid \
            ORDER BY COUNT(book_type.btype_typeid) DESC LIMIT 4", (error, results) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(results);
                }
            });
        });

        if (question === "ทักทาย") {
            res.status(200).json({ "answer": "สวัสดี ฉันคือ chatbot ต้องการให้ช่วยอะไร" })
        } else if (question === "เกี่ยวกับเว็บไซต์ของเรา") {
            res.status(200).json({ "answer": "เว็บไซต์นี้เป็นเว็บไซต์ตัวกลางที่จะให้นักเขียนสามารถมาขายผลงานของพวกเขาในรูปแบบ ebook ซึ่งเว็บไซต์เราจะช่วยกระตุ้นยอดขายให้กลับผู้เผยแพร่ที่มาลงขายกับเว็บไซต์ของเรา" })
        } else if (question === "หนังสือ") {
            res.status(200).json({
                "answer": typebookData
            });
        } else if (question === "หนังสือแนะนำประจำเดือน") {
            try {
                const bookData = await new Promise((resolve, reject) => {
                    db.query(`SELECT book.book_id, book.book_name, book.book_cover, book.book_summary, book.book_price \
                    FROM book \
                    INNER JOIN receipt_detail ON book.book_id = receipt_detail.recd_bookid \
                    INNER JOIN receipt ON receipt.rec_id = receipt_detail.recd_recid \
                    WHERE book_status = '2' AND DATE_FORMAT(receipt.rec_date, '%m') = DATE_FORMAT(CURDATE(), '%m') \
                    GROUP BY book_id \
                    ORDER BY COUNT(receipt_detail.recd_bookid) DESC LIMIT 5`, (error, results) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(results);
                        }
                    });
                });

                res.status(200).json({
                    "answer": bookData
                });

            } catch (error) {
                res.status(400).json({ "error": error });
            }
        } else {
            let matchFound = false;
            for (let i = 0; i < typebookData.length; i++) {
                if (question === typebookData[i].type_name) {
                    matchFound = true;

                    try {
                        const bookData = await new Promise((resolve, reject) => {
                            db.query(`SELECT book.book_id, book.book_name, book.book_cover, book.book_summary, book.book_price  \
                            FROM book \
                            INNER JOIN bookscore ON bookscore.bscore_bookid = book.book_id \
                            INNER JOIN book_type ON book_type.btype_bookid = book.book_id \
                            INNER JOIN typebook ON typebook.type_id = book_type.btype_typeid \
                            WHERE book_status = '2' AND bookscore.bscore_score >= 3 AND typebook.type_name = '${question}' \
                            GROUP BY book.book_id \
                            ORDER BY COUNT(book_type.btype_typeid) DESC LIMIT 5`, (error, results) => {
                                if (error) {
                                    reject(error);
                                } else {
                                    resolve(results);
                                }
                            });
                        });

                        res.status(200).json({
                            "answer": bookData
                        });

                    } catch (error) {
                        res.status(400).json({ "error": error });
                    }
                    break; // Break the loop once a match is found
                }
            }
            if (!matchFound) {
                res.status(404).json({ "error": "ไม่พบข้อมูลที่ต้องการ" });
            }
        }
    } catch (error) {
        res.status(500).json({ "error": error.message });
    }
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
