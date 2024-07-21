const express = require('express');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const app = express();
const PORT = 5000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Note: For production, set secure: true if using HTTPS
}));

// Logging middleware
app.use((req, res, next) => {
    console.log(`Request URL: ${req.url}`);
    next();
});

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'my_root_name',               // CAN BE CHANGED
    password: 'mysql_password',         // CAN BE CHANGED
    database: 'my_database_name'        // CAN BE CHANGED
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        throw err;
    }
    console.log('Connected to database');
});

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'my_email',           // CAN BE CHANGED
        pass: 'App_password'        // CAN BE CHANGED
    },
    tls: {
        rejectUnauthorized: false
    },
    debug: true,
    logger: true
});

// Function to generate a token
const generateToken = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Multer setup for profile photo upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Registration route
app.post('/register', async (req, res) => {
    const { firstName, lastName, email, phone, password, updates } = req.body;
    const updatesBoolean = updates === 'on';

    const emailToken = generateToken();
    const phoneToken = generateToken();
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = 'SELECT email, phone FROM farmers WHERE email = ? OR phone = ?';
    db.query(query, [email, phone], async (err, results) => {
        if (err) {
            console.error('Database query failed:', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
        }

        if (results.length > 0) {
            const existingEmail = results.some(result => result.email === email);
            const existingPhone = results.some(result => result.phone === phone);

            let message = '';
            if (existingEmail && existingPhone) {
                message = 'Both user Email and Phone Number already exist';
            } else if (existingEmail) {
                message = 'User Email already exists';
            } else if (existingPhone) {
                message = 'User Phone Number already exists';
            }

            res.status(400).json({ message });
        } else {
            const insertQuery = 'INSERT INTO temporary_farmers (firstName, lastName, email, phone, password, updates, emailToken, phoneToken) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            db.query(insertQuery, [firstName, lastName, email, phone, hashedPassword, updatesBoolean, emailToken, phoneToken], (err, results) => {
                if (err) {
                    console.error('Database insertion failed:', err);
                    res.status(500).json({ message: 'Internal Server Error' });
                    return;
                }

                // Send verification codes via email
                const mailOptions = {
                    from: 'my_email',       //CAN BE CHANGED
                    to: email,
                    subject: 'Email and Phone Number Verification',
                    text: `Your email verification code is: ${emailToken}\nYour phone number verification code is: ${phoneToken}`
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error('Nodemailer error:', error);
                        res.status(500).json({ message: 'Error sending verification email.' });
                    } else {
                        console.log('Email sent: ' + info.response);
                        res.status(200).json({
                            message: 'Registration successful! Please verify your email and phone number.',
                            emailToken: emailToken,
                            phoneToken: phoneToken
                        });
                    }
                });
            });
        }
    });
});

// Email and phone verification route
app.post('/verify', (req, res) => {
    const { email, emailToken, phoneToken } = req.body;

    const query = 'SELECT * FROM temporary_farmers WHERE email = ? AND emailToken = ? AND phoneToken = ?';
    db.query(query, [email, emailToken, phoneToken], (err, results) => {
        if (err) {
            console.error('Database query failed:', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
        }

        if (results.length > 0) {
            const user = results[0];
            const insertQuery = 'INSERT INTO farmers (firstName, lastName, email, phone, password, updates) VALUES (?, ?, ?, ?, ?, ?)';
            db.query(insertQuery, [user.firstName, user.lastName, user.email, user.phone, user.password, user.updates], (err, insertResults) => {
                if (err) {
                    console.error('Database insertion failed:', err);
                    res.status(500).json({ message: 'Internal Server Error' });
                    return;
                }

                const deleteQuery = 'DELETE FROM temporary_farmers WHERE id = ?';
                db.query(deleteQuery, [user.id], (err, deleteResults) => {
                    if (err) {
                        console.error('Database deletion failed:', err);
                        res.status(500).json({ message: 'Internal Server Error' });
                        return;
                    }

                    res.status(200).json({ message: 'Email and phone number verified successfully!' });
                });
            });
        } else {
            res.status(400).json({ message: 'Invalid verification tokens.' });
        }
    });
});

// Login route
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const loginQuery = 'SELECT * FROM farmers WHERE email = ?';
    db.query(loginQuery, [email], async (err, results) => {
        if (err) {
            console.error('Database query failed:', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
        }

        if (results.length > 0) {
            const user = results[0];
            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {
                const profilePhotoPath = user.profilePhoto ? user.profilePhoto : '/uploads/default/default-photo.jpg';
                req.session.user = {
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    profilePhoto: profilePhotoPath
                };
                res.status(200).json({ 
                    message: 'Login successful', 
                    user: {
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        profilePhoto: profilePhotoPath
                    }
                });
            } else {
                res.status(401).json({ message: 'Wrong Password!' });
            }
        } else {
            res.status(401).json({ message: 'User Email does not exist!' });
        }
    });
});


// Fetch user data route
app.get('/fetch-user-data', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ message: 'User not authenticated' });
    }
    const email = req.session.user.email;
    const query = 'SELECT firstName, lastName, phone, email, profilePhoto FROM farmers WHERE email = ?';
    db.query(query, [email], (err, results) => {
        if (err) {
            console.error('Database query failed:', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
        }
        if (results.length > 0) {
            const user = results[0];
            res.status(200).json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    });
});


// Profile photo upload route
app.post('/upload-profile-photo', upload.single('profilePhoto'), (req, res) => {
    const email = req.session.user.email;
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const profilePhotoPath = '/uploads/' + req.file.filename;
    const updateQuery = 'UPDATE farmers SET profilePhoto = ? WHERE email = ?';

    db.query(updateQuery, [profilePhotoPath, email], (err, results) => {
        if (err) {
            console.error('Database update failed:', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
        }

        req.session.user.profilePhoto = profilePhotoPath; // Update session with new profile photo path
        res.status(200).json({ message: 'Profile photo updated successfully', newProfilePhoto: profilePhotoPath });
    });
});


// Update user settings route
app.post('/update-settings', upload.single('profilePhoto'), (req, res) => {
    const { firstName, lastName, phoneNumber } = req.body;
    const email = req.session.user.email;
    let profilePhotoPath = req.session.user.profilePhoto;

    if (req.file) {
        profilePhotoPath = '/uploads/' + req.file.filename;
    }

    const updateQuery = 'UPDATE farmers SET firstName = ?, lastName = ?, phone = ?, profilePhoto = ? WHERE email = ?';

    db.query(updateQuery, [firstName, lastName, phoneNumber, profilePhotoPath, email], (err, results) => {
        if (err) {
            console.error('Database update failed:', err);
            res.status(500).json({ message: 'Internal Server Error' });
            return;
        }
        req.session.user = { firstName, lastName, phone: phoneNumber, email, profilePhoto: profilePhotoPath }; // Update session data
        res.status(200).json({ message: 'Settings updated successfully' });
    });
});


// Home data route
app.get('/home-data', (req, res) => {
    if (req.session.user) {
        res.status(200).json(req.session.user);
    } else {
        res.status(401).json({ message: 'User not authenticated' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
})

app.listen(PORT, '0.0.0.0', () => {
   console.log(`Server running at http://0.0.0.0:${PORT}`);
});
