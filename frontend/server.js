require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const port = process.env.PORT || 3000;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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

// Middleware
app.use(express.json());
app.use(cookieParser());

// Authentication middleware
const requireAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        // If no auth header is present, check for a session cookie
        if (!req.cookies.sb_auth_token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        try {
            // Verify the token from cookie
            const { data: { user }, error } = await supabase.auth.getUser(req.cookies.sb_auth_token);
            
            if (error || !user) {
                throw new Error('Invalid authentication token');
            }
            
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Authentication required' });
        }
    } else {
        // Handle Bearer token from Authorization header
        const token = authHeader.split(' ')[1];
        
        try {
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error || !user) {
                throw new Error('Invalid authentication token');
            }
            
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ error: 'Authentication required' });
        }
    }
};

// Serve login page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Serve static files
app.use(express.static(__dirname));

// Route to get Supabase config for client-side usage
app.get('/api/supabase-config', (req, res) => {
    res.json({
        url: process.env.SUPABASE_URL,
        anon_key: process.env.SUPABASE_ANON_KEY
    });
});

// Session validation endpoint
app.get('/api/validate-session', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : req.cookies.sb_auth_token;
    
    if (!token) {
        return res.status(401).json({ authenticated: false });
    }
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return res.status(401).json({ authenticated: false });
        }
        
        res.json({ authenticated: true, user });
    } catch (error) {
        res.status(401).json({ authenticated: false });
    }
});

// Protected API endpoints
app.post('/api/transcribe', requireAuth, upload.single('file'), (req, res) => {
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
    
    // Get speaker names if provided
    let speakersOption = '';
    if (req.body.speakers) {
        try {
            const speakers = JSON.parse(req.body.speakers);
            if (Array.isArray(speakers) && speakers.length > 0) {
                // Format speakers for command line: -s "Speaker 1" "Speaker 2" ...
                speakersOption = `-s ${speakers.map(name => `"${name}"`).join(' ')}`;
            }
        } catch (err) {
            console.error(`Error parsing speakers: ${err.message}`);
        }
    }
    
    // Run the meeting-diary command
    const meetingDiaryPath = process.env.MEETING_DIARY_PATH || 'meeting-diary';
    const command = `ASSEMBLYAI_API_KEY=${apiKey} ${meetingDiaryPath} "${filePath}" -f ${format} -o "${outputPath}" ${speakersOption} --no-interactive`;
    
    console.log(`Executing command: ${command}`);
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
app.get('/api/check-config', requireAuth, (req, res) => {
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
    
    // Check Supabase configuration
    if (supabaseUrl && supabaseKey) {
        console.log('Supabase authentication is configured.');
    } else {
        console.log('Warning: Supabase authentication is not configured. Please add SUPABASE_URL and SUPABASE_SERVICE_KEY to your .env file.');
    }
});