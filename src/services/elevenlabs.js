/**
 * ElevenLabs API Service
 * Handles speech-to-text (STT) using Web Speech API and text-to-speech (TTS) using ElevenLabs
 */

// Get API key from environment variable (works with both local .env and Amplify env variables)
// Vite requires VITE_ prefix for environment variables to be accessible in the browser
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';

if (!ELEVENLABS_API_KEY) {
    console.warn('⚠️ VITE_ELEVENLABS_API_KEY is not set. Please set it in your .env file or Amplify environment variables.');
}

const ELEVENLABS_TTS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';

/**
 * Convert audio blob to text using Web Speech API (built-in browser API)
 * Note: ElevenLabs doesn't have STT API, so we use Web Speech API
 * @param {Blob} audioBlob - Audio recording as Blob
 * @returns {Promise<string>} Transcribed text
 */
export const speechToText = async (audioBlob) => {
    return new Promise((resolve, reject) => {
        // Check if Web Speech API is available
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            reject(new Error('Speech recognition not supported in this browser. Please use Chrome or Edge.'));
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                }
            }
        };

        recognition.onend = () => {
            resolve(finalTranscript.trim());
        };

        recognition.onerror = (event) => {
            reject(new Error(`Speech recognition error: ${event.error}`));
        };

        // Start recognition
        recognition.start();
    });
};

/**
 * Alternative: Convert audio blob to text using Web Audio API + Web Speech API
 * This is a fallback if direct recognition doesn't work
 */
export const speechToTextFromBlob = async (audioBlob) => {
    return new Promise((resolve, reject) => {
        // Check if Web Speech API is available
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            reject(new Error('Speech recognition not supported in this browser. Please use Chrome or Edge.'));
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                }
            }
        };

        recognition.onend = () => {
            resolve(finalTranscript.trim());
        };

        recognition.onerror = (event) => {
            reject(new Error(`Speech recognition error: ${event.error}`));
        };

        // Play audio and start recognition simultaneously
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.oncanplaythrough = () => {
            recognition.start();
            audio.play().catch(() => {
                // Audio play failed, but recognition can still work
            });
        };

        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
        };
    });
};

/**
 * Convert text to audio using ElevenLabs Text-to-Speech
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - Voice ID (default: '21m00Tcm4TlvDq8ikWAM' - Rachel)
 * @returns {Promise<Blob>} Audio blob
 */
export const textToSpeech = async (text, voiceId = '21m00Tcm4TlvDq8ikWAM') => {
    try {
        const response = await fetch(`${ELEVENLABS_TTS_API_URL}/${voiceId}`, {
            method: 'POST',
            headers: {
                'Accept': 'audio/mpeg',
                'Content-Type': 'application/json',
                'xi-api-key': ELEVENLABS_API_KEY,
            },
            body: JSON.stringify({
                text: text,
                model_id: 'eleven_multilingual_v2',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75,
                },
            }),
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Text-to-speech failed: ${response.statusText} - ${errorData}`);
        }

        const audioBlob = await response.blob();
        return audioBlob;
    } catch (error) {
        console.error('Text-to-speech error:', error);
        throw error;
    }
};

/**
 * Play audio blob
 * @param {Blob} audioBlob - Audio blob to play
 * @returns {Promise<void>}
 */
export const playAudio = (audioBlob) => {
    return new Promise((resolve, reject) => {
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
        };
        
        audio.onerror = (error) => {
            URL.revokeObjectURL(audioUrl);
            reject(error);
        };
        
        audio.play().catch(reject);
    });
};

