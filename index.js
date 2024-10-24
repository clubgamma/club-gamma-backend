const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;


app.use(cors({
    origin: [process.env.FRONTEND_URL, 'http://localhost:5173'],
    credentials: true
}));


// Endpoint to download a test file
app.get('/download', (req, res) => {
    const filePath = path.join(__dirname, 'testfile.dat'); // Path to the test file
    res.download(filePath);
});

// Endpoint to handle file upload
app.post('/upload', express.raw({ type: 'application/octet-stream', limit: '50mb' }), (req, res) => {
    // Log the size of the uploaded data
    console.log(`Uploaded ${req.body.length} bytes`);
    res.sendStatus(200);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
