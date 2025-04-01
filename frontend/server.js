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

// Helper function to extract transcript metadata
const extractMetadata = (content, format, originalFilename) => {
    const metadata = {
        speakers: [],
        duration: 0,
        processedAt: new Date().toISOString(),
    };
    
    try {
        // Extract metadata based on format
        if (format === 'json') {
            // Parse the JSON content directly
            const parsedContent = JSON.parse(content);
            metadata.speakers = parsedContent.speakers?.map(s => s.name) || [];
            metadata.duration = parsedContent.metadata?.duration || 0;
            metadata.processedAt = parsedContent.metadata?.processedAt || metadata.processedAt;
        } else if (format === 'md') {
            // Extract speakers from markdown using regex
            const speakerMatches = content.matchAll(/\*\*([^*]+)\*\*/g);
            const speakerSet = new Set();
            for (const match of speakerMatches) {
                speakerSet.add(match[1]);
            }
            metadata.speakers = Array.from(speakerSet);
            
            // Extract duration from markdown
            const durationMatch = content.match(/\*Duration: (\d+) minutes\*/);
            if (durationMatch && durationMatch[1]) {
                metadata.duration = parseInt(durationMatch[1]) * 60000; // Convert to milliseconds
            }
            
            // Extract processed date
            const processedMatch = content.match(/\*Processed on ([^*]+)\*/);
            if (processedMatch && processedMatch[1]) {
                metadata.processedAt = new Date(processedMatch[1]).toISOString();
            }
        }
        
        // Add original filename metadata
        metadata.originalFilename = originalFilename;
        
        return metadata;
    } catch (error) {
        console.error('Error extracting metadata:', error);
        return metadata; // Return default metadata on error
    }
};

// Helper function to create text chunks for future vectorization
const createTextChunks = (content, format) => {
    const chunks = [];
    const chunkSize = 1000; // Characters per chunk
    
    try {
        let plainText = '';
        
        // Convert different formats to plain text for chunking
        if (format === 'json') {
            try {
                const parsed = JSON.parse(content);
                plainText = parsed.segments
                    .map(segment => `${segment.speaker.name}: ${segment.text}`)
                    .join('\n');
            } catch (e) {
                plainText = content;
            }
        } else if (format === 'md') {
            // Remove markdown formatting for better chunking
            plainText = content
                .replace(/^#.*$/gm, '') // Remove headings
                .replace(/\*\*|\*/g, '') // Remove bold and italic markers
                .replace(/\[.*?\]\s*\*\*/g, '') // Remove timestamps and speaker labels
                .trim();
        } else if (format === 'srt') {
            // Remove SRT formatting (numbers and timestamps)
            plainText = content
                .replace(/^\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}\s*\n/gm, '')
                .trim();
        } else {
            // Default to the original content
            plainText = content;
        }
        
        // Create overlapping chunks for better search results
        let position = 0;
        const overlap = 100; // Characters of overlap between chunks
        
        while (position < plainText.length) {
            const chunkEnd = Math.min(position + chunkSize, plainText.length);
            chunks.push({
                text: plainText.substring(position, chunkEnd),
                position,
            });
            
            position += chunkSize - overlap;
            if (position < 0) position = 0;
        }
        
        return chunks;
    } catch (error) {
        console.error('Error creating text chunks:', error);
        return [{
            text: content.substring(0, Math.min(content.length, chunkSize)),
            position: 0
        }];
    }
};

// Generate a title from the transcript content
const generateTitle = (content, format, originalFilename) => {
    // Default to the original filename without extension
    let title = path.basename(originalFilename, path.extname(originalFilename))
        .replace(/_/g, ' ')
        .replace(/^\d+/, '') // Remove leading numbers (often from timestamp filenames)
        .trim();
        
    if (!title) {
        title = 'Untitled Transcript';
    }
    
    try {
        if (format === 'json') {
            // Try to extract a better title from the JSON
            const parsed = JSON.parse(content);
            if (parsed.metadata?.fileName) {
                title = path.basename(parsed.metadata.fileName, path.extname(parsed.metadata.fileName))
                    .replace(/_/g, ' ')
                    .trim();
            }
        } else if (format === 'md') {
            // Try to extract title from markdown heading
            const headingMatch = content.match(/^# (.+)$/m);
            if (headingMatch && headingMatch[1] && headingMatch[1].toLowerCase() !== 'meeting transcript') {
                title = headingMatch[1].trim();
            }
        }
        
        // If title is still empty or just "Transcript", use a timestamp
        if (!title || title.toLowerCase() === 'transcript' || title.toLowerCase() === 'meeting transcript') {
            const formattedDate = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            title = `Transcript - ${formattedDate}`;
        }
    } catch (error) {
        console.error('Error generating title:', error);
    }
    
    return title;
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

// API endpoint to check if API key is configured
app.get('/api/check-config', requireAuth, (req, res) => {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    res.json({ configured: !!apiKey });
});

// ------------------------
// Transcript API Endpoints
// ------------------------

// API Versioning Configuration
const API_VERSION = 'v1';
const API_BASE = `/api/${API_VERSION}`;

// Helper function to create both versioned and legacy routes
const createDualRoute = (method, path, handler) => {
    // Create versioned route (e.g., /api/v1/transcripts)
    app[method](`${API_BASE}${path}`, handler);
    
    // Also create legacy route for backward compatibility (e.g., /api/transcripts)
    app[method](`/api${path}`, handler);
    
    console.log(`Created dual routes: /api${path} and ${API_BASE}${path}`);
};

// 1. Transcribe and store audio/video files
// Keep backward compatibility with original /api/transcribe endpoint
app.post('/api/transcribe', requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get API key from .env file
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
        return res.status(400).json({ error: 'API key is not configured. Please add it to your .env file.' });
    }
    
    const format = req.body.format || 'md';
    const filePath = req.file.path;
    const outputPath = path.join(__dirname, 'outputs', path.parse(req.file.filename).name + '.' + format);
    const originalFilename = req.file.originalname;
    
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
    exec(command, async (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).json({ error: `Error processing file: ${error.message}` });
        }
        
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }
        
        // Read the generated output file
        try {
            const data = await fs.promises.readFile(outputPath, 'utf8');
            
            // Generate metadata and title
            const metadata = extractMetadata(data, format, originalFilename);
            const title = req.body.title || generateTitle(data, format, originalFilename);
            const chunks = createTextChunks(data, format);

            // Store transcript in Supabase
            const { data: transcript, error: insertError } = await supabase
                .from('transcripts')
                .insert({
                    user_id: req.user.id,
                    title: title,
                    content: data,
                    format: format,
                    file_name: originalFilename,
                    metadata: metadata,
                    chunks: chunks
                })
                .select()
                .single();
            
            if (insertError) {
                console.error('Error storing transcript:', insertError);
                return res.status(500).json({ 
                    error: 'Error storing transcript', 
                    details: insertError.message 
                });
            }
            
            // Return the transcript data and ID to the client
            res.json({
                id: transcript.id,
                title: transcript.title,
                content: data,
                format: format,
                created_at: transcript.created_at
            });
            
            // Clean up temporary files
            try {
                await fs.promises.unlink(filePath);
                await fs.promises.unlink(outputPath);
            } catch (err) {
                console.error(`Error cleaning up files: ${err.message}`);
            }
            
        } catch (err) {
            console.error(`Error reading or storing output: ${err.message}`);
            return res.status(500).json({ error: `Error reading or storing output: ${err.message}` });
        }
    });
});

// Also create the versioned endpoint for transcribe
app.post(`${API_BASE}/transcribe`, requireAuth, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Get API key from .env file
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
        return res.status(400).json({ error: 'API key is not configured. Please add it to your .env file.' });
    }
    
    const format = req.body.format || 'md';
    const filePath = req.file.path;
    const outputPath = path.join(__dirname, 'outputs', path.parse(req.file.filename).name + '.' + format);
    const originalFilename = req.file.originalname;
    
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
    exec(command, async (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).json({ error: `Error processing file: ${error.message}` });
        }
        
        if (stderr) {
            console.error(`stderr: ${stderr}`);
        }
        
        // Read the generated output file
        try {
            const data = await fs.promises.readFile(outputPath, 'utf8');
            
            // Generate metadata and title
            const metadata = extractMetadata(data, format, originalFilename);
            const title = req.body.title || generateTitle(data, format, originalFilename);
            const chunks = createTextChunks(data, format);

            // Store transcript in Supabase
            const { data: transcript, error: insertError } = await supabase
                .from('transcripts')
                .insert({
                    user_id: req.user.id,
                    title: title,
                    content: data,
                    format: format,
                    file_name: originalFilename,
                    metadata: metadata,
                    chunks: chunks
                })
                .select()
                .single();
            
            if (insertError) {
                console.error('Error storing transcript:', insertError);
                return res.status(500).json({ 
                    error: 'Error storing transcript', 
                    details: insertError.message 
                });
            }
            
            // Return the transcript data and ID to the client
            res.json({
                id: transcript.id,
                title: transcript.title,
                content: data,
                format: format,
                created_at: transcript.created_at
            });
            
            // Clean up temporary files
            try {
                await fs.promises.unlink(filePath);
                await fs.promises.unlink(outputPath);
            } catch (err) {
                console.error(`Error cleaning up files: ${err.message}`);
            }
            
        } catch (err) {
            console.error(`Error reading or storing output: ${err.message}`);
            return res.status(500).json({ error: `Error reading or storing output: ${err.message}` });
        }
    });
});

// 2. Get all transcripts for the authenticated user
// Handler for both legacy and versioned endpoints
const getTranscriptsHandler = async (req, res) => {
    try {
        // Get pagination parameters from query string
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // Get sorting parameters
        let orderColumn = req.query.order_by || 'updated_at';
        let orderDirection = req.query.order_direction || 'desc';
        
        // Security check for column name to prevent SQL injection
        const allowedColumns = ['created_at', 'updated_at', 'title'];
        if (!allowedColumns.includes(orderColumn)) {
            orderColumn = 'updated_at';
        }
        
        // Security check for direction
        if (!['asc', 'desc'].includes(orderDirection)) {
            orderDirection = 'desc';
        }
        
        // Create query for transcripts
        let query = supabase
            .from('transcripts')
            .select('id, title, format, file_name, created_at, updated_at, metadata')
            .order(orderColumn, { ascending: orderDirection === 'asc' })
            .range(offset, offset + limit - 1);
        
        // Add search filter if provided
        if (req.query.search) {
            const searchTerm = req.query.search.trim();
            query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
        }
        
        // Execute the query
        const { data: transcripts, error, count } = await query;
        
        if (error) {
            throw error;
        }
        
        // Get total count for pagination
        const { count: totalCount, error: countError } = await supabase
            .from('transcripts')
            .select('id', { count: 'exact', head: true });
        
        if (countError) {
            throw countError;
        }
        
        // Return the transcripts with pagination information
        res.json({
            transcripts,
            pagination: {
                total: totalCount,
                page,
                limit,
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching transcripts:', error);
        res.status(500).json({ error: 'Error fetching transcripts', details: error.message });
    }
};

// Set up both legacy and versioned routes for getting transcripts list
app.get('/api/transcripts', requireAuth, getTranscriptsHandler);
app.get(`${API_BASE}/transcripts`, requireAuth, getTranscriptsHandler);

// 3. Get a specific transcript by ID
// Handler for both legacy and versioned endpoints
const getTranscriptByIdHandler = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get transcript by ID (RLS policy will ensure user can only access their own)
        const { data: transcript, error } = await supabase
            .from('transcripts')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Transcript not found' });
            }
            throw error;
        }
        
        res.json(transcript);
    } catch (error) {
        console.error('Error fetching transcript:', error);
        res.status(500).json({ error: 'Error fetching transcript', details: error.message });
    }
};

// Set up both legacy and versioned routes for getting transcript by ID
app.get('/api/transcripts/:id', requireAuth, getTranscriptByIdHandler);
app.get(`${API_BASE}/transcripts/:id`, requireAuth, getTranscriptByIdHandler);

// 4. Update a specific transcript
// Handler for both legacy and versioned endpoints
const updateTranscriptHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, metadata } = req.body;
        
        // Validate required fields
        if (!title && !content && !metadata) {
            return res.status(400).json({ error: 'No update data provided' });
        }
        
        // Check if transcript exists and belongs to user
        const { data: existingTranscript, error: fetchError } = await supabase
            .from('transcripts')
            .select('id, format')
            .eq('id', id)
            .single();
        
        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return res.status(404).json({ error: 'Transcript not found' });
            }
            throw fetchError;
        }
        
        // Prepare update data
        const updateData = {};
        if (title) updateData.title = title;
        if (content) {
            updateData.content = content;
            
            // Regenerate chunks if content is updated
            updateData.chunks = createTextChunks(content, existingTranscript.format);
        }
        if (metadata) updateData.metadata = metadata;
        
        // Update transcript
        const { data: updatedTranscript, error: updateError } = await supabase
            .from('transcripts')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        
        if (updateError) {
            throw updateError;
        }
        
        res.json(updatedTranscript);
    } catch (error) {
        console.error('Error updating transcript:', error);
        res.status(500).json({ error: 'Error updating transcript', details: error.message });
    }
};

// Set up both legacy and versioned routes for updating transcript
app.put('/api/transcripts/:id', requireAuth, updateTranscriptHandler);
app.put(`${API_BASE}/transcripts/:id`, requireAuth, updateTranscriptHandler);

// 5. Delete a specific transcript
// Handler for both legacy and versioned endpoints
const deleteTranscriptHandler = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete transcript (RLS policy will ensure user can only delete their own)
        const { error } = await supabase
            .from('transcripts')
            .delete()
            .eq('id', id);
        
        if (error) {
            throw error;
        }
        
        res.json({ success: true, message: 'Transcript deleted successfully' });
    } catch (error) {
        console.error('Error deleting transcript:', error);
        res.status(500).json({ error: 'Error deleting transcript', details: error.message });
    }
};

// Set up both legacy and versioned routes for deleting transcript
app.delete('/api/transcripts/:id', requireAuth, deleteTranscriptHandler);
app.delete(`${API_BASE}/transcripts/:id`, requireAuth, deleteTranscriptHandler);

// Start the server
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