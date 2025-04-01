/**
 * Transcript Management Module
 * 
 * This module handles interactions with the transcript storage API.
 * It provides functions for listing, retrieving, updating, and deleting transcripts.
 */

// Initialize transcript management when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Only initialize if we're on the transcripts page
    if (document.getElementById('transcripts-list')) {
        try {
            // First ensure the supabase global variable is defined
            if (typeof window.supabase === 'undefined' && typeof supabase === 'undefined') {
                console.log('No Supabase client detected, checking if library is loaded...');
                
                // Check if the Supabase library is available
                if (typeof supabase === 'undefined' && typeof window.supabase === 'undefined') {
                    throw new Error('Supabase client library is not loaded. Please check your network connection or script inclusion.');
                }
            }
            
            // Make sure Supabase is initialized before proceeding
            if (!window.supabase) {
                console.log('Fetching Supabase configuration...');
                // Get Supabase config and initialize client
                const response = await fetch('/api/supabase-config');
                
                if (!response.ok) {
                    throw new Error('Failed to load Supabase configuration');
                }
                
                const config = await response.json();
                
                if (!config.url || !config.anon_key) {
                    throw new Error('Incomplete Supabase configuration');
                }
                
                console.log('Initializing Supabase client for transcript management...');
                
                // Check which method to use for initialization
                if (typeof window.supabase === 'object' && window.supabase?.createClient) {
                    // Use window.supabase.createClient method
                    console.log('Using window.supabase.createClient method');
                    window.supabase = window.supabase.createClient(config.url, config.anon_key);
                } else if (typeof supabase === 'object' && supabase?.createClient) {
                    // Use global supabase.createClient method
                    console.log('Using global supabase.createClient method');
                    window.supabase = supabase.createClient(config.url, config.anon_key);
                } else {
                    throw new Error('Could not find Supabase createClient method');
                }
                
                console.log('Supabase client initialized successfully!');
            } else {
                console.log('Supabase client already initialized');
            }
            
            // Ensure window.supabase is accessible
            if (!window.supabase) {
                throw new Error('Failed to initialize Supabase client');
            }
            
            // Verify that auth is available by checking the object
            if (!window.supabase.auth) {
                throw new Error('Supabase auth is not available. Client may be incorrectly initialized.');
            }
            
            // Make sure we have a global variable reference
            supabase = window.supabase;
            
            // Verify we can access auth methods
            await window.supabase.auth.getSession();
            console.log('Supabase authentication verified successfully');
            
            // Now that Supabase is initialized and verified, proceed with transcript management
            console.log('Proceeding with transcript management initialization');
            initTranscriptManagement();
            
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            const errorEl = document.getElementById('transcripts-error');
            if (errorEl) {
                errorEl.textContent = `Error: Failed to initialize Supabase: ${error.message}`;
                errorEl.style.display = 'block';
                
                // Show more detailed troubleshooting information
                errorEl.innerHTML += `<br><br>Troubleshooting tips:<br>
                    1. Make sure you've set up your Supabase project correctly.<br>
                    2. Check your .env file has SUPABASE_URL and SUPABASE_ANON_KEY.<br>
                    3. Run the check-supabase.js diagnostic tool.<br>
                    4. Verify the Supabase client library is loading correctly.`;
            }
            
            // Hide loading indicator if present
            const loadingEl = document.getElementById('transcripts-loading');
            if (loadingEl) {
                loadingEl.style.display = 'none';
            }
            return;
        }
    }
});

// Global variables
let currentPage = 1;
let totalPages = 1;
let currentTranscript = null;
let searchDebounceTimer = null;

/**
 * Initialize the transcript management functionality
 */
async function initTranscriptManagement() {
    // Add event listeners for pagination
    document.getElementById('prev-page-btn')?.addEventListener('click', goToPreviousPage);
    document.getElementById('next-page-btn')?.addEventListener('click', goToNextPage);
    
    // Add event listener for search
    const searchInput = document.getElementById('transcript-search');
    if (searchInput) {
        searchInput.addEventListener('input', debounceSearch);
    }
    
    // Set up sorting functionality
    setupSortingControls();
    
    // Load initial transcripts
    await loadTranscripts();
    
    // Add event listener for the create new transcript button if it exists
    const newTranscriptBtn = document.getElementById('new-transcript-btn');
    if (newTranscriptBtn) {
        newTranscriptBtn.addEventListener('click', showUploadModal);
    }
}

/**
 * Set up the sorting controls for the transcripts list
 */
function setupSortingControls() {
    const sortBySelect = document.getElementById('sort-by');
    const sortDirectionBtn = document.getElementById('sort-direction');
    
    if (sortBySelect) {
        sortBySelect.addEventListener('change', async () => {
            currentPage = 1;
            await loadTranscripts();
        });
    }
    
    if (sortDirectionBtn) {
        sortDirectionBtn.addEventListener('click', async () => {
            // Toggle between asc and desc
            const currentDirection = sortDirectionBtn.getAttribute('data-direction');
            const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
            
            // Update the button state
            sortDirectionBtn.setAttribute('data-direction', newDirection);
            sortDirectionBtn.innerHTML = newDirection === 'asc' 
                ? '↑' // Up arrow for ascending
                : '↓'; // Down arrow for descending
            
            currentPage = 1;
            await loadTranscripts();
        });
    }
}

/**
 * Debounce the search input to avoid excessive API calls
 */
function debounceSearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
        currentPage = 1;
        await loadTranscripts();
    }, 500); // 500ms debounce time
}

/**
 * Navigate to the previous page of transcripts
 */
async function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        await loadTranscripts();
    }
}

/**
 * Navigate to the next page of transcripts
 */
async function goToNextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        await loadTranscripts();
    }
}

/**
 * Load transcripts from the API with the current filters
 */
async function loadTranscripts() {
    const loadingEl = document.getElementById('transcripts-loading');
    const errorEl = document.getElementById('transcripts-error');
    const listEl = document.getElementById('transcripts-list');
    const paginationEl = document.getElementById('pagination-controls');
    
    if (!listEl) return;
    
    // Show loading state
    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    if (listEl) listEl.innerHTML = '';
    
    try {
        // Get the current token for authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('No authenticated session found');
        }
        
        // Get sorting parameters
        const sortBySelect = document.getElementById('sort-by');
        const sortDirectionBtn = document.getElementById('sort-direction');
        const searchInput = document.getElementById('transcript-search');
        
        const orderBy = sortBySelect ? sortBySelect.value : 'updated_at';
        const orderDirection = sortDirectionBtn ? sortDirectionBtn.getAttribute('data-direction') : 'desc';
        const searchTerm = searchInput ? searchInput.value.trim() : '';
        
        // Build query parameters
        const params = new URLSearchParams({
            page: currentPage,
            limit: 10,
            order_by: orderBy,
            order_direction: orderDirection
        });
        
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        
        // Fetch transcripts
        const response = await fetch(`/api/transcripts?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load transcripts');
        }
        
        const data = await response.json();
        
        // Update pagination state
        if (data.pagination) {
            totalPages = data.pagination.pages;
            updatePaginationControls(data.pagination);
        }
        
        // Display transcripts
        if (data.transcripts && data.transcripts.length > 0) {
            displayTranscripts(data.transcripts);
        } else {
            listEl.innerHTML = '<div class="empty-state">No transcripts found</div>';
        }
    } catch (error) {
        console.error('Error loading transcripts:', error);
        if (errorEl) {
            errorEl.textContent = `Error: ${error.message}`;
            errorEl.style.display = 'block';
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

/**
 * Display the list of transcripts
 * 
 * @param {Array} transcripts List of transcript objects
 */
function displayTranscripts(transcripts) {
    const listEl = document.getElementById('transcripts-list');
    if (!listEl) return;
    
    listEl.innerHTML = '';
    
    transcripts.forEach(transcript => {
        const item = document.createElement('div');
        item.className = 'transcript-item';
        item.setAttribute('data-id', transcript.id);
        
        // Format date
        const createdDate = new Date(transcript.created_at).toLocaleDateString();
        
        // Get duration
        const durationMinutes = transcript.metadata && transcript.metadata.duration 
            ? Math.round(transcript.metadata.duration / 60000) 
            : 0;
        
        // Get speaker count
        const speakerCount = transcript.metadata && transcript.metadata.speakers 
            ? transcript.metadata.speakers.length 
            : 0;
        
        // Create HTML
        item.innerHTML = `
            <div class="transcript-title">${transcript.title}</div>
            <div class="transcript-meta">
                <span class="transcript-date">${createdDate}</span>
                <span class="transcript-format">${transcript.format.toUpperCase()}</span>
                ${durationMinutes ? `<span class="transcript-duration">${durationMinutes} min</span>` : ''}
                ${speakerCount ? `<span class="transcript-speakers">${speakerCount} speaker${speakerCount > 1 ? 's' : ''}</span>` : ''}
            </div>
            <div class="transcript-actions">
                <button class="view-btn" data-id="${transcript.id}">View</button>
                <button class="edit-btn" data-id="${transcript.id}">Edit</button>
                <button class="delete-btn" data-id="${transcript.id}">Delete</button>
            </div>
        `;
        
        // Add to list
        listEl.appendChild(item);
        
        // Add event listeners
        item.querySelector('.view-btn').addEventListener('click', () => viewTranscript(transcript.id));
        item.querySelector('.edit-btn').addEventListener('click', () => editTranscript(transcript.id));
        item.querySelector('.delete-btn').addEventListener('click', () => confirmDeleteTranscript(transcript.id, transcript.title));
    });
}

/**
 * Update pagination controls
 * 
 * @param {Object} pagination Pagination information
 */
function updatePaginationControls(pagination) {
    const paginationEl = document.getElementById('pagination-controls');
    const paginationInfoEl = document.getElementById('pagination-info');
    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');
    
    if (!paginationEl) return;
    
    // Update page information
    if (paginationInfoEl) {
        paginationInfoEl.textContent = `Page ${pagination.page} of ${pagination.pages}`;
    }
    
    // Update button states
    if (prevBtn) {
        prevBtn.disabled = pagination.page <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = pagination.page >= pagination.pages;
    }
    
    // Show/hide pagination controls
    paginationEl.style.display = pagination.total > pagination.limit ? 'flex' : 'none';
}

/**
 * View a specific transcript
 * 
 * @param {string} transcriptId ID of the transcript to view
 */
async function viewTranscript(transcriptId) {
    const modalEl = document.getElementById('transcript-modal');
    const modalContentEl = document.getElementById('transcript-modal-content');
    const modalTitleEl = document.getElementById('transcript-modal-title');
    const modalBodyEl = document.getElementById('transcript-modal-body');
    const modalErrorEl = document.getElementById('transcript-modal-error');
    const modalLoadingEl = document.getElementById('transcript-modal-loading');
    
    if (!modalEl || !modalContentEl) return;
    
    // Reset and show modal
    if (modalTitleEl) modalTitleEl.textContent = 'Loading Transcript...';
    if (modalBodyEl) modalBodyEl.innerHTML = '';
    if (modalErrorEl) modalErrorEl.style.display = 'none';
    if (modalLoadingEl) modalLoadingEl.style.display = 'block';
    
    modalEl.style.display = 'flex';
    
    try {
        // Get the current token for authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('No authenticated session found');
        }
        
        // Fetch transcript
        const response = await fetch(`/api/transcripts/${transcriptId}`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load transcript');
        }
        
        const transcript = await response.json();
        currentTranscript = transcript;
        
        // Update modal
        if (modalTitleEl) modalTitleEl.textContent = transcript.title;
        
        if (modalBodyEl) {
            // Display transcript based on format
            if (transcript.format === 'md') {
                // For Markdown, use a Markdown renderer if available, or just format with some basic styling
                // Here we're using a simple approach for demonstration
                modalBodyEl.innerHTML = `
                    <div class="transcript-content markdown">
                        ${transcript.content.replace(/\n/g, '<br>')}
                    </div>
                `;
            } else if (transcript.format === 'json') {
                // For JSON, display a formatted JSON view
                try {
                    const jsonObj = JSON.parse(transcript.content);
                    modalBodyEl.innerHTML = `
                        <pre class="transcript-content json">${JSON.stringify(jsonObj, null, 2)}</pre>
                    `;
                } catch (e) {
                    modalBodyEl.innerHTML = `
                        <pre class="transcript-content json">${transcript.content}</pre>
                    `;
                }
            } else {
                // For other formats, just display as pre-formatted text
                modalBodyEl.innerHTML = `
                    <pre class="transcript-content plain">${transcript.content}</pre>
                `;
            }
            
            // Add download button
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-btn';
            downloadBtn.textContent = 'Download Transcript';
            downloadBtn.addEventListener('click', () => downloadTranscript(transcript));
            modalBodyEl.appendChild(downloadBtn);
        }
    } catch (error) {
        console.error('Error loading transcript:', error);
        if (modalErrorEl) {
            modalErrorEl.textContent = `Error: ${error.message}`;
            modalErrorEl.style.display = 'block';
        }
    } finally {
        if (modalLoadingEl) modalLoadingEl.style.display = 'none';
    }
}

/**
 * Download a transcript file
 * 
 * @param {Object} transcript The transcript object to download
 */
function downloadTranscript(transcript) {
    if (!transcript || !transcript.content) return;
    
    // Determine file extension based on format
    const fileExtension = transcript.format || 'txt';
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `transcript_${transcript.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${timestamp}.${fileExtension}`;
    
    // Create a blob with the content
    let mimeType = 'text/plain';
    switch(fileExtension) {
        case 'json':
            mimeType = 'application/json';
            break;
        case 'md':
            mimeType = 'text/markdown';
            break;
    }
    
    const blob = new Blob([transcript.content], { type: mimeType });
    
    // Create a temporary URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Edit a specific transcript
 * 
 * @param {string} transcriptId ID of the transcript to edit
 */
async function editTranscript(transcriptId) {
    const modalEl = document.getElementById('edit-modal');
    const modalTitleInput = document.getElementById('edit-transcript-title');
    const modalContentTextarea = document.getElementById('edit-transcript-content');
    const modalSaveBtn = document.getElementById('edit-save-btn');
    const modalErrorEl = document.getElementById('edit-modal-error');
    const modalLoadingEl = document.getElementById('edit-modal-loading');
    
    if (!modalEl) return;
    
    // Reset and show modal
    if (modalTitleInput) modalTitleInput.value = '';
    if (modalContentTextarea) modalContentTextarea.value = '';
    if (modalErrorEl) modalErrorEl.style.display = 'none';
    if (modalLoadingEl) modalLoadingEl.style.display = 'block';
    if (modalSaveBtn) modalSaveBtn.disabled = true;
    
    modalEl.style.display = 'flex';
    
    try {
        // Get the current token for authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('No authenticated session found');
        }
        
        // Fetch transcript
        const response = await fetch(`/api/transcripts/${transcriptId}`, {
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load transcript');
        }
        
        const transcript = await response.json();
        currentTranscript = transcript;
        
        // Update modal
        if (modalTitleInput) modalTitleInput.value = transcript.title;
        if (modalContentTextarea) modalContentTextarea.value = transcript.content;
        if (modalSaveBtn) {
            modalSaveBtn.disabled = false;
            
            // Set up save action
            modalSaveBtn.onclick = async () => {
                await saveTranscriptChanges(transcriptId);
            };
        }
    } catch (error) {
        console.error('Error loading transcript for editing:', error);
        if (modalErrorEl) {
            modalErrorEl.textContent = `Error: ${error.message}`;
            modalErrorEl.style.display = 'block';
        }
    } finally {
        if (modalLoadingEl) modalLoadingEl.style.display = 'none';
    }
}

/**
 * Save changes to a transcript
 * 
 * @param {string} transcriptId ID of the transcript to save
 */
async function saveTranscriptChanges(transcriptId) {
    const modalErrorEl = document.getElementById('edit-modal-error');
    const modalLoadingEl = document.getElementById('edit-modal-loading');
    const modalTitleInput = document.getElementById('edit-transcript-title');
    const modalContentTextarea = document.getElementById('edit-transcript-content');
    const modalSaveBtn = document.getElementById('edit-save-btn');
    
    if (!modalTitleInput || !modalContentTextarea) return;
    
    // Validate
    const title = modalTitleInput.value.trim();
    const content = modalContentTextarea.value;
    
    if (!title) {
        if (modalErrorEl) {
            modalErrorEl.textContent = 'Title is required';
            modalErrorEl.style.display = 'block';
        }
        return;
    }
    
    // Show loading state
    if (modalErrorEl) modalErrorEl.style.display = 'none';
    if (modalLoadingEl) modalLoadingEl.style.display = 'block';
    if (modalSaveBtn) modalSaveBtn.disabled = true;
    
    try {
        // Get the current token for authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('No authenticated session found');
        }
        
        // Prepare data
        const updateData = {
            title: title,
            content: content
        };
        
        // Update transcript
        const response = await fetch(`/api/transcripts/${transcriptId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update transcript');
        }
        
        // Close modal and refresh
        document.getElementById('edit-modal').style.display = 'none';
        await loadTranscripts();
        
        // Show a success message
        const messageEl = document.getElementById('message-container');
        if (messageEl) {
            messageEl.textContent = 'Transcript updated successfully';
            messageEl.className = 'message success';
            messageEl.style.display = 'block';
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error('Error updating transcript:', error);
        if (modalErrorEl) {
            modalErrorEl.textContent = `Error: ${error.message}`;
            modalErrorEl.style.display = 'block';
        }
    } finally {
        if (modalLoadingEl) modalLoadingEl.style.display = 'none';
        if (modalSaveBtn) modalSaveBtn.disabled = false;
    }
}

/**
 * Show confirmation dialog before deleting a transcript
 * 
 * @param {string} transcriptId ID of the transcript to delete
 * @param {string} transcriptTitle Title of the transcript for confirmation
 */
function confirmDeleteTranscript(transcriptId, transcriptTitle) {
    const confirmEl = document.getElementById('confirm-modal');
    const confirmMessageEl = document.getElementById('confirm-message');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmNoBtn = document.getElementById('confirm-no-btn');
    
    if (!confirmEl || !confirmMessageEl || !confirmYesBtn) return;
    
    // Set up the confirmation message
    confirmMessageEl.textContent = `Are you sure you want to delete "${transcriptTitle}"? This action cannot be undone.`;
    
    // Set up the Yes button
    confirmYesBtn.onclick = async () => {
        await deleteTranscript(transcriptId);
        confirmEl.style.display = 'none';
    };
    
    // Set up the No button
    if (confirmNoBtn) {
        confirmNoBtn.onclick = () => {
            confirmEl.style.display = 'none';
        };
    }
    
    // Show the confirmation dialog
    confirmEl.style.display = 'flex';
}

/**
 * Delete a transcript
 * 
 * @param {string} transcriptId ID of the transcript to delete
 */
async function deleteTranscript(transcriptId) {
    try {
        // Get the current token for authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('No authenticated session found');
        }
        
        // Delete transcript
        const response = await fetch(`/api/transcripts/${transcriptId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${session.access_token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to delete transcript');
        }
        
        // Refresh the list
        await loadTranscripts();
        
        // Show a success message
        const messageEl = document.getElementById('message-container');
        if (messageEl) {
            messageEl.textContent = 'Transcript deleted successfully';
            messageEl.className = 'message success';
            messageEl.style.display = 'block';
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 3000);
        }
    } catch (error) {
        console.error('Error deleting transcript:', error);
        
        // Show an error message
        const messageEl = document.getElementById('message-container');
        if (messageEl) {
            messageEl.textContent = `Error: ${error.message}`;
            messageEl.className = 'message error';
            messageEl.style.display = 'block';
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        }
    }
}

/**
 * Show the upload modal for creating a new transcript
 */
function showUploadModal() {
    // Simply show the existing file upload interface
    // We're assuming the upload form is already part of the page
    const uploadContainer = document.getElementById('upload-container');
    if (uploadContainer) {
        // Scroll to upload container
        uploadContainer.scrollIntoView({ behavior: 'smooth' });
    }
}

// Modal close functionality
document.addEventListener('DOMContentLoaded', () => {
    // Set up close buttons for all modals
    const closeButtons = document.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    
    // Close modals when clicking outside the content
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
});