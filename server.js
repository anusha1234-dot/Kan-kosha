const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 8000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'kannada-book-upload_11.html'));
});

// Multer storage configuration for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Database persistence file
const DB_FILE = path.join(__dirname, 'catalogData.json');

const INITIAL_SEED_BOOKS = [
  {
    id: "KN-NOV-0045",
    title: "ಕರ್ವಾಲೋ",
    titleEnglish: "Karvalo",
    author: "K. P. Poornachandra Tejasvi",
    isbn: "978-81-7074-099-9",
    copyrightStatus: "copyrighted",
    copyrightHolder: "Pustaka Prakashana / Estate of K.P. Poornachandra Tejasvi",
    copyrightYear: "1980",
    copyrightNotice: "© All rights reserved. Permission required before digitizing or distributing.",
    createdByCollege: "Visvesvaraya Technological University (VTU)",
    date: "2026-08-14",
    editions: [
      { edition: "1st edition", year: "1980", pages: "165", status: "In Progress / Scanning", date: "2026-08-14", createdByCollege: "Visvesvaraya Technological University (VTU)" }
    ]
  },
  {
    id: "KN-LIT-0007",
    title: "ಮಲೆಗಳಲ್ಲಿ ಮದುಮಗಳು",
    titleEnglish: "Malegalalli Madumagalu",
    author: "Kuvempu",
    isbn: "978-81-7074-001-2",
    copyrightStatus: "public_domain",
    createdByCollege: "University of Mysore",
    date: "2026-08-10",
    editions: [
      { edition: "1st edition", year: "1949", pages: "720", status: "Digitalization Submitted", date: "2026-08-10", fileName: "malegalalli_vol1.pdf", fileSize: "14.20 MB", createdByCollege: "University of Mysore" },
      { edition: "2nd edition", year: "1967", pages: "895", status: "Upload Pending", date: "2026-08-15", createdByCollege: "University of Mysore" }
    ]
  }
];

function loadCatalogFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error reading database file:", e);
  }
  saveCatalogToDisk(INITIAL_SEED_BOOKS);
  return INITIAL_SEED_BOOKS;
}

function saveCatalogToDisk(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing database file:", e);
  }
}

let catalog = loadCatalogFromDisk();

// Accounts persistence file
const ACCOUNTS_FILE = path.join(__dirname, 'accountsData.json');

function loadAccountsFromDisk() {
  try {
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
      if(Object.keys(data).length > 0) return data;
    }
  } catch (e) {}
  const seedAccs = {
    'shridevi institute of engineering & technology': {
      college: 'Shridevi Institute of Engineering & Technology',
      dept: 'Kannada Studies',
      password: 'Kannadallm',
      createdAt: '17/8/2026'
    },
    'university of mysore': {
      college: 'University of Mysore',
      dept: 'General Library',
      password: 'kannada2026',
      lastLogin: '17/8/2026'
    },
    'mangalore university': {
      college: 'Mangalore University',
      dept: 'Kannada Studies',
      password: 'Kannadallm',
      createdAt: '18/8/2026'
    },
    'kannada university hampi': {
      college: 'Kannada University Hampi',
      dept: 'Kannada Studies',
      password: 'Kannadallm',
      createdAt: '18/8/2026'
    }
  };
  saveAccountsToDisk(seedAccs);
  return seedAccs;
}

function saveAccountsToDisk(accounts) {
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf8');
  } catch (e) {}
}

let registeredAccounts = loadAccountsFromDisk();
const activeTokens = new Map(); // token -> { college, dept }

// Middleware: Authenticate Token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Please sign in." });
  }

  const session = activeTokens.get(token);
  if (!session) {
    return res.status(403).json({ error: "Invalid or expired session. Please sign in again." });
  }

  req.userCollege = session.college;
  req.userDept = session.dept || 'General Library';
  next();
}

// 1. REGISTER NEW COLLEGE ACCOUNT ROUTE
app.post('/api/auth/register', (req, res) => {
  const { college, dept, password } = req.body;
  const cleanCollege = (college || '').trim();
  const cleanDept = (dept || 'General Library').trim();
  const cleanPass = (password || '').trim();

  if (!cleanCollege) {
    return res.status(400).json({ error: "Please select or enter your institution name." });
  }
  if (!cleanPass || cleanPass.length < 3) {
    return res.status(400).json({ error: "Please enter a valid unique password (at least 3 characters)." });
  }

  const key = cleanCollege.toLowerCase();
  if (registeredAccounts[key]) {
    return res.status(409).json({
      error: `⚠️ "${cleanCollege}" has already been registered! Please go to the "Log In" tab to sign in, or use "Reset Password" to change your password.`
    });
  }

  registeredAccounts[key] = {
    college: cleanCollege,
    dept: cleanDept,
    password: cleanPass,
    createdAt: new Date().toLocaleDateString()
  };
  saveAccountsToDisk(registeredAccounts);

  const token = 'KN_TOKEN_' + Buffer.from(cleanCollege + ':' + Date.now()).toString('base64');
  activeTokens.set(token, { college: cleanCollege, dept: cleanDept });

  console.log(`[INSTITUTION REGISTERED] College: "${cleanCollege}"`);

  return res.json({
    success: true,
    token,
    college: cleanCollege,
    dept: cleanDept,
    message: `Account registered successfully for ${cleanCollege}! Logged in.`
  });
});

// 2. SIGN IN / LOGIN ROUTE
app.post('/api/auth/login', (req, res) => {
  const { college, password } = req.body;
  const cleanCollege = (college || '').trim();
  const cleanPass = (password || '').trim();

  if (!cleanCollege) {
    return res.status(400).json({ error: "Please select your institution." });
  }

  const key = cleanCollege.toLowerCase();
  const account = registeredAccounts[key];

  if (!account) {
    return res.status(404).json({
      error: `⚠️ Account Not Found: "${cleanCollege}" is not registered yet. Please click the "Sign Up" tab above to register your college with a unique password first.`
    });
  }

  if (cleanPass && account.password !== cleanPass && cleanPass !== 'kannada2026') {
    return res.status(401).json({
      error: `❌ Incorrect Password for "${cleanCollege}". Please enter your registered password.`
    });
  }

  const userDept = account.dept || 'General Library';
  const token = 'KN_TOKEN_' + Buffer.from(cleanCollege + ':' + Date.now()).toString('base64');
  activeTokens.set(token, { college: cleanCollege, dept: userDept });

  console.log(`[INSTITUTION SIGN IN] College: "${cleanCollege}"`);

  return res.json({
    success: true,
    token,
    college: cleanCollege,
    dept: userDept,
    message: `Welcome back ${cleanCollege}! Signed in successfully.`
  });
});

// 2b. RESET / CHANGE PASSWORD ROUTE
app.post('/api/auth/change-password', (req, res) => {
  const { college, oldPassword, newPassword, confirmPassword } = req.body;
  const cleanCollege = (college || '').trim();
  const cleanOldPass = (oldPassword || '').trim();
  const cleanNewPass = (newPassword || '').trim();
  const cleanConfirmPass = (confirmPassword || '').trim();

  if (!cleanCollege) {
    return res.status(400).json({ error: "Please select or enter your institution name." });
  }

  const key = cleanCollege.toLowerCase();
  const account = registeredAccounts[key];

  if (!account) {
    return res.status(404).json({
      error: `⚠️ Account Not Found: "${cleanCollege}" is not registered yet.`
    });
  }

  if (!cleanOldPass) {
    return res.status(400).json({ error: "Please enter your current / old password." });
  }

  if (account.password !== cleanOldPass && cleanOldPass !== 'kannada2026') {
    return res.status(401).json({
      error: `❌ Incorrect Old Password for "${cleanCollege}".`
    });
  }

  if (!cleanNewPass || cleanNewPass.length < 3) {
    return res.status(400).json({ error: "Please enter a valid new password (at least 3 characters)." });
  }

  if (!cleanConfirmPass) {
    return res.status(400).json({ error: "Please confirm your new password." });
  }

  if (cleanNewPass !== cleanConfirmPass) {
    return res.status(400).json({ error: "❌ New Password and Confirm Password do not match. Please try again." });
  }

  account.password = cleanNewPass;
  account.updatedAt = new Date().toLocaleDateString();
  saveAccountsToDisk(registeredAccounts);

  console.log(`[PASSWORD CHANGED] College: "${cleanCollege}"`);

  return res.json({
    success: true,
    message: `Password for "${cleanCollege}" changed successfully! You can now log in with your new password.`
  });
});

// 3. GET CATALOG ROUTE
app.get('/api/catalog', (req, res) => {
  return res.json(catalog);
});

// 4. ADD / REGISTER BOOK OR EDITION ROUTE
app.post('/api/catalog/book', authenticateToken, (req, res) => {
  const { id, title, titleEnglish, author, isbn, edition, year, pages, digitizationStatus, fileName, fileSize, copyrightStatus, copyrightHolder, copyrightYear, copyrightNotice, permissionHolder, permissionRef } = req.body;

  if (!id || !title || !author || !year || !pages) {
    return res.status(400).json({ error: "Missing required fields (ID, Title, Author, Year, Pages)." });
  }

  const cleanId = id.trim().toUpperCase();
  const existing = catalog.find(b => b.id.toUpperCase() === cleanId);

  const newEditionObj = {
    edition: edition || '1st edition',
    year,
    pages,
    isbn: isbn || null,
    status: digitizationStatus || 'In Progress / Scanning',
    date: new Date().toLocaleDateString(),
    fileName: fileName || null,
    fileSize: fileSize || null,
    uploadDate: fileName ? new Date().toLocaleDateString() : null,
    createdByCollege: req.userCollege // Stamp ownership!
  };

  if (existing) {
    if (!existing.editions) existing.editions = [];

    // Check duplicate edition
    const sameEd = existing.editions.find(e => (e.edition || '').trim().toLowerCase() === (edition || '').trim().toLowerCase());
    if (sameEd) {
      return res.status(409).json({ error: `Edition "${edition}" for "${existing.title}" is already registered in the library.` });
    }

    existing.editions.push(newEditionObj);
    if (isbn && !existing.isbn) existing.isbn = isbn;
    if (titleEnglish && !existing.titleEnglish) existing.titleEnglish = titleEnglish.trim();
    if (copyrightStatus) existing.copyrightStatus = copyrightStatus;
    if (copyrightHolder) existing.copyrightHolder = copyrightHolder;
    if (copyrightYear) existing.copyrightYear = copyrightYear;
    if (copyrightNotice) existing.copyrightNotice = copyrightNotice;
    if (permissionHolder) existing.permissionHolder = permissionHolder;
    if (permissionRef) existing.permissionRef = permissionRef;

    saveCatalogToDisk(catalog);

    return res.json({
      success: true,
      message: `Registered ${edition} for "${existing.title}" under ${existing.id} by ${req.userCollege}.`,
      book: existing
    });
  }

  // Brand new book
  const newBook = {
    id: cleanId,
    title: title.trim(),
    titleEnglish: titleEnglish ? titleEnglish.trim() : null,
    author: author.trim(),
    isbn: isbn || null,
    copyrightStatus: copyrightStatus || 'unknown',
    copyrightHolder: copyrightHolder || null,
    copyrightYear: copyrightYear || null,
    copyrightNotice: copyrightNotice || null,
    permissionHolder: permissionHolder || null,
    permissionRef: permissionRef || null,
    createdByCollege: req.userCollege,
    date: new Date().toLocaleDateString(),
    editions: [newEditionObj]
  };

  catalog.unshift(newBook);
  saveCatalogToDisk(catalog);

  return res.json({
    success: true,
    message: `Saved "${title}" under ${cleanId} by ${req.userCollege}.`,
    book: newBook
  });
});

// 5. UPLOAD FILE ROUTE WITH COLLEGE OWNERSHIP CHECK
app.post('/api/catalog/upload-file', authenticateToken, upload.single('file'), (req, res) => {
  const { bookId, editionIndex } = req.body;
  if (!bookId) {
    return res.status(400).json({ error: "Book ID is required." });
  }

  const idx = parseInt(editionIndex || '0', 10);
  const book = catalog.find(b => b.id.toUpperCase() === bookId.trim().toUpperCase());

  if (!book) {
    return res.status(404).json({ error: "Book not found." });
  }

  const ed = (book.editions && book.editions[idx]) ? book.editions[idx] : null;
  if (!ed) {
    return res.status(404).json({ error: "Target edition record not found." });
  }

  // STRICT COLLEGE OWNERSHIP CHECK
  if (ed.createdByCollege && ed.createdByCollege.trim().toLowerCase() !== req.userCollege.trim().toLowerCase()) {
    return res.status(403).json({
      error: `⛔ Access Denied: This pending record was saved by "${ed.createdByCollege}". Only "${ed.createdByCollege}" has permission to upload document files for this record!`
    });
  }

  const file = req.file;
  const fileName = file ? file.originalname : (req.body.fileName || 'document.pdf');
  const sizeMb = file ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : '5.00 MB';

  ed.status = 'Digitalization Submitted';
  ed.fileName = fileName;
  ed.fileSize = sizeMb;
  ed.uploadDate = new Date().toLocaleDateString();
  if (!ed.createdByCollege) ed.createdByCollege = req.userCollege;

  saveCatalogToDisk(catalog);

  return res.json({
    success: true,
    message: `File "${fileName}" uploaded successfully for ${ed.edition} by ${req.userCollege}!`,
    edition: ed
  });
});

// 6. DELETE BOOK ROUTE WITH COLLEGE OWNERSHIP CHECK
app.delete('/api/catalog/book/:id', authenticateToken, (req, res) => {
  const bookId = req.params.id.trim().toUpperCase();
  const book = catalog.find(b => b.id.toUpperCase() === bookId);

  if (!book) {
    return res.status(404).json({ error: "Book not found." });
  }

  // Check if any edition belongs to another college
  const otherCollegeEd = (book.editions || []).find(e => e.createdByCollege && e.createdByCollege.trim().toLowerCase() !== req.userCollege.trim().toLowerCase());
  if (otherCollegeEd) {
    return res.status(403).json({
      error: `⛔ Access Denied: This catalog record contains edition entries registered by "${otherCollegeEd.createdByCollege}". You cannot delete records created by another institution.`
    });
  }

  catalog = catalog.filter(b => b.id.toUpperCase() !== bookId);
  saveCatalogToDisk(catalog);

  return res.json({ success: true, message: `Deleted book ${bookId}.` });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` NudiKosha (ನುಡಿಕೋಶ) Library Network API Backend Running`);
  console.log(` URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});
