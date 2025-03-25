require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const app = express();
const port = process.env.PORT || 3000;

// Set up storage for uploaded files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// Serve static files from the current directory
app.use(express.static(__dirname));

// API endpoint to handle file upload and processing
app.post('/api/transcribe', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded');
    }
    
    // Get API key from .env file
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
        return res.status(400).send('API key is not configured. Please add it to your .env file.');
    }
    
    const format = req.body.format || 'md';
    const filePath = req.file.path;
    const outputPath = path.join(__dirname, 'outputs', path.parse(req.file.filename).name + '.' + format);
    
    // Create outputs directory if it doesn't exist
    const outputsDir = path.join(__dirname, 'outputs');
    if (!fs.existsSync(outputsDir)) {
        fs.mkdirSync(outputsDir);
    }
    
    // Run the meeting-diary command
    const meetingDiaryPath = process.env.MEETING_DIARY_PATH || 'meeting-diary';
    const command = `ASSEMBLYAI_API_KEY=${apiKey} ${meetingDiaryPath} "${filePath}" -f ${format} -o "${outputPath}" --no-interactive`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).send(`Error processing file: ${error.message}`);
        }
        
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }
        
        // Read the generated output file
        fs.readFile(outputPath, 'utf8', (err, data) => {
            if (err) {
                console.error(`Error reading output file: ${err.message}`);
                return res.status(500).send(`Error reading output: ${err.message}`);
            }
            
            res.send(data);
            
            // Clean up the uploaded file after processing
            fs.unlink(filePath, err => {
                if (err) console.error(`Error deleting uploaded file: ${err.message}`);
            });
        });
    });
});

// API endpoint to check if API key is configured
app.get('/api/check-config', (req, res) => {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    res.json({ configured: !!apiKey });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    
    // Display API key status on startup
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (apiKey) {
        console.log('AssemblyAI API key is configured.');
    } else {
        console.log('Warning: AssemblyAI API key is not configured. Please add it to your .env file.');
    }
});