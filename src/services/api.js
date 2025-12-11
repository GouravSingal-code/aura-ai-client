/**
 * ============================================================================
 * API DOCUMENTATION
 * ============================================================================
 * 
 * This file contains all API endpoints used by the frontend application.
 * Base URL: Configure via VITE_API_BASE_URL environment variable (default: http://localhost:8000)
 * 
 * REST API ENDPOINTS:
 * ===================
 * 
 * 1. POST /api/login
 *    Description: Login or create a new user
 *    Request Body: { username: string }
 *    Response: User object with profile
 *    Usage: login(username)
 * 
 * 2. GET /api/upload-url/{username}
 *    Description: Get presigned URL for uploading file to S3 (also returns image URL)
 *    Path Params: username (string)
 *    Query Params: file_name (string), file_type (string)
 *    Response: { upload_url: string, image_url: string, s3_key: string, expires_in: number }
 *    Usage: getUploadUrl(username, fileName, fileType)
 * 
 * 3. GET /api/image-url/{username}
 *    Description: Get presigned URL for viewing/downloading image from S3 (for refreshing expired URLs)
 *    Path Params: username (string)
 *    Query Params: s3_key (optional string)
 *    Response: { image_url: string, s3_key: string, expires_in: number }
 *    Usage: getImageUrl(username, s3Key?) - Only needed for refreshing expired URLs
 * 
 * 4. PUT /api/update/{username}
 *    Description: Update user credentials/profile (stores S3 key after upload, returns image_url)
 *    Path Params: username (string)
 *    Request Body: FormData with s3_key (string)
 *    Response: Updated user object with image_url field
 *    Usage: updateUser(username, { s3_key: string })
 * 
 * 3. POST /api/like/{username}/{image_id}
 *    Description: Like an image (updates user embeddings internally)
 *    Path Params: username (string), image_id (string)
 *    Request Body: None
 *    Response: Success response object
 *    Usage: likeImage(username, imageId)
 * 
 * 4. POST /api/createChat/
 *    Description: Create a new chat session
 *    Request Body: { username: string, session_name?: string, ... }
 *    Response: Created chat session object
 *    Usage: createChat(chatData)
 * 
 * 5. GET /api/chats/{username}
 *    Description: Get all chat sessions for a user
 *    Path Params: username (string)
 *    Response: Array of chat session objects
 *    Usage: getChats(username)
 * 
 * 6. POST /chat
 *    Description: Send a chat message and get AI response
 *    Request Body: { message: string, user_id: string, thread_id?: string }
 *    Response: { response: string, thread_id: string, user_id: string, ... }
 *    Usage: sendChatMessage(message, userId, threadId?)
 * 
 * ============================================================================
 */

// API Base URL - Production endpoint
const API_BASE_URL = 'https://aura-ai-997596012968.us-central1.run.app';

/**
 * Convert S3 URL to backend proxy URL (avoids CORS issues)
 * @param {string} s3Url - S3 presigned URL
 * @param {string} username - Username
 * @returns {string} Backend proxy URL
 */
export const getImageProxyUrl = (s3Url, username) => {
    if (!s3Url || !username) return s3Url;
    
    // Extract s3_key from S3 URL
    // Format: https://s3.ap-south-1.amazonaws.com/bucket-name/users/username/profile/filename.jpg?...
    try {
        const url = new URL(s3Url);
        // Remove query parameters and get the path
        const pathParts = url.pathname.split('/');
        // Path format: /bucket-name/users/username/profile/filename.jpg
        // We need: users/username/profile/filename.jpg
        const bucketIndex = pathParts.findIndex(part => part === 'aura-ai-users');
        if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            const s3Key = pathParts.slice(bucketIndex + 1).join('/');
            // Pass both s3_key and image_url (presigned URL) to backend
            // Backend will use image_url if available, otherwise generate new presigned URL
            return `${API_BASE_URL}/api/image-proxy/${username}?s3_key=${encodeURIComponent(s3Key)}&image_url=${encodeURIComponent(s3Url)}`;
        }
    } catch (e) {
        console.warn('Failed to parse S3 URL:', e);
    }
    
    // Fallback: return original URL
    return s3Url;
};

/**
 * Extract S3 key from a photo URL (presigned URL or proxy URL)
 * @param {string} photoUrl - Photo URL (presigned URL or proxy URL)
 * @returns {string|null} S3 key or null if extraction fails
 */
export const extractS3KeyFromUrl = (photoUrl) => {
    if (!photoUrl) return null;
    
    try {
        const url = new URL(photoUrl);
        
        // Check if it's a proxy URL (has s3_key query param)
        const s3KeyParam = url.searchParams.get('s3_key');
        if (s3KeyParam) {
            return decodeURIComponent(s3KeyParam);
        }
        
        // Otherwise, extract from pathname (presigned URL)
        const pathParts = url.pathname.split('/');
        const bucketIndex = pathParts.findIndex(part => part === 'aura-ai-users');
        if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
            return pathParts.slice(bucketIndex + 1).join('/');
        }
    } catch (e) {
        console.warn('Failed to extract S3 key from URL:', e);
    }
    
    return null;
};

/**
 * Login user
 * @param {string} username - Username for login
 * @returns {Promise<Object>} User data
 */
export const login = async (username) => {
    if (!username || !username.trim()) {
        throw new Error('Username is required');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username: username.trim() }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Login failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to connect to server');
    }
};

/**
 * Get presigned URL for uploading file to S3 (also returns image URL for immediate use)
 * @param {string} username - Username
 * @param {string} fileName - Name of the file
 * @param {string} fileType - MIME type of the file (e.g., 'image/jpeg')
 * @returns {Promise<Object>} { upload_url: string, image_url: string, s3_key: string, expires_in: number }
 */
export const getUploadUrl = async (username, fileName, fileType) => {
    if (!username || !username.trim()) {
        throw new Error('Username is required');
    }

    if (!fileName || !fileName.trim()) {
        throw new Error('File name is required');
    }

    if (!fileType || !fileType.trim()) {
        throw new Error('File type is required');
    }

    try {
        const params = new URLSearchParams({
            file_name: fileName,
            file_type: fileType
        });

        const response = await fetch(`${API_BASE_URL}/api/upload-url/${username}?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || `Failed to get upload URL: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to connect to server');
    }
};

/**
 * Get presigned URL for viewing/downloading image from S3
 * @param {string} username - Username
 * @param {string} s3Key - Optional S3 key. If not provided, returns user's profile image
 * @returns {Promise<Object>} { image_url: string, s3_key: string, expires_in: number }
 */
export const getImageUrl = async (username, s3Key = null) => {
    if (!username || !username.trim()) {
        throw new Error('Username is required');
    }

    try {
        const params = new URLSearchParams();
        if (s3Key) {
            params.append('s3_key', s3Key);
        }

        const url = s3Key 
            ? `${API_BASE_URL}/api/image-url/${username}?${params}`
            : `${API_BASE_URL}/api/image-url/${username}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || `Failed to get image URL: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to connect to server');
    }
};

/**
 * Upload file directly to S3 using presigned URL
 * @param {string} uploadUrl - Presigned URL from getUploadUrl
 * @param {File} file - File to upload
 * @returns {Promise<Response>} Fetch response
 */
export const uploadFileToS3 = async (uploadUrl, file) => {
    if (!uploadUrl) {
        throw new Error('Upload URL is required');
    }

    if (!file || !(file instanceof File)) {
        throw new Error('File is required');
    }

    try {
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type,
            },
            body: file,
        });

        if (!response.ok) {
            throw new Error(`Failed to upload file to S3: ${response.statusText}`);
        }

        return response;
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to upload file');
    }
};

/**
 * Upload file through backend proxy (avoids CORS issues)
 * @param {string} username - Username
 * @param {File} file - File to upload
 * @returns {Promise<Object>} Updated user data
 */
export const uploadImageViaProxy = async (username, file) => {
    if (!username || !username.trim()) {
        throw new Error('Username is required');
    }

    if (!file || !(file instanceof File)) {
        throw new Error('File is required');
    }

    try {
        const formData = new FormData();
        formData.append('file', file);

        // Add username to FormData (backend expects it as Form parameter)
        formData.append('username', username);

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || `Upload failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to upload image');
    }
};

/**
 * Update user credentials/profile (stores S3 key after upload)
 * @param {string} username - Username
 * @param {Object} fields - Fields to update (e.g., { s3_key: string, ... })
 * @returns {Promise<Object>} Updated user data
 */
/**
 * Delete a photo from S3 and user profile
 * @param {string} username - Username
 * @param {string} s3Key - S3 key of the photo to delete
 * @returns {Promise<Object>} Updated user data with photo_urls
 */
export const deletePhoto = async (username, s3Key) => {
    if (!username || !username.trim()) {
        throw new Error('Username is required');
    }

    if (!s3Key || !s3Key.trim()) {
        throw new Error('S3 key is required');
    }

    try {
        // Backend endpoint: DELETE /api/image/{username}/{s3_key:path}
        // FastAPI path parameters handle URL encoding automatically
        const response = await fetch(`${API_BASE_URL}/api/image/${username}/${s3Key}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || `Failed to delete photo: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to delete photo');
    }
};

export const updateUser = async (username, fields) => {
    if (!username || !username.trim()) {
        throw new Error('Username is required');
    }

    if (!fields || Object.keys(fields).length === 0) {
        throw new Error('At least one field is required for update');
    }

    try {
        const formData = new FormData();
        
        // Append all fields to FormData
        Object.entries(fields).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
            }
        });

        const response = await fetch(`${API_BASE_URL}/api/update/${username}`, {
            method: 'PUT',
            // Don't set Content-Type header - browser will set it with boundary for FormData
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || `Update failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to connect to server');
    }
};

/**
 * Like an image (updates user embeddings internally)
 * @param {string} username - Username
 * @param {string} imageId - Image ID
 * @returns {Promise<Object>} Response data
 */
export const likeImage = async (username, imageId) => {
    if (!username || !username.trim()) {
        throw new Error('Username is required');
    }

    if (!imageId || !imageId.trim()) {
        throw new Error('Image ID is required');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/like/${username}/${imageId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Like failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to connect to server');
    }
};

/**
 * Create a new chat session
 * @param {Object} chatData - Chat session data (should include username)
 * @returns {Promise<Object>} Created chat session
 */
export const createChat = async (chatData) => {
    if (!chatData || !chatData.user_id) {
        throw new Error('User ID is required to create a chat');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/createChat/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Failed to create chat: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to connect to server');
    }
};

/**
 * Get all chat sessions for a user
 * @param {string} user_id - User ID
 * @returns {Promise<Array>} Array of chat sessions
 */
export const getChats = async (user_id) => {
    if (!user_id || !user_id.trim()) {
        throw new Error('User ID is required');
    }

    try {
        const url = `${API_BASE_URL}/api/chats/${user_id}`;
        console.log('🌐 Fetching chats from:', url);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        console.log('📡 Response status:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ API Error:', errorData);
            throw new Error(errorData.detail || errorData.message || `Failed to fetch chats: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Received chats data:', Array.isArray(data) ? `${data.length} chats` : 'not an array', data);
        return data;
    } catch (error) {
        console.error('❌ getChats error:', error);
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to connect to server');
    }
};

/**
 * Send a chat message via REST API
 * @param {string} message - Message text
 * @param {string} userId - User ID (e.g., "user_username")
 * @param {string} threadId - Optional thread/chat ID
 * @returns {Promise<Object>} Chat response with assistant's reply
 */
export const sendChatMessage = async (message, userId, threadId = null) => {
    if (!message || !message.trim()) {
        throw new Error('Message is required');
    }

    if (!userId) {
        throw new Error('User ID is required');
    }

    try {
        const requestBody = {
            message: message.trim(),
            user_id: userId,
        };

        if (threadId) {
            requestBody.thread_id = threadId;
        }

        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.message || `Failed to send message: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error('Network error: Failed to send message');
    }
};

// WebSocket functions removed - using REST API only

