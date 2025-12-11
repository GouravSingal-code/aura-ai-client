import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Send, Plus, MessageSquare, MoreVertical, User, Bot, ArrowLeft, Heart } from 'lucide-react';
import { createChat, getChats, sendChatMessage, likeImage } from '../services/api';

const Chat = () => {
    const [user, setUser] = useState(null);
    const [chats, setChats] = useState([]);
    const [activeChat, setActiveChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isSending, setIsSending] = useState(false);

    const messagesEndRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            navigate('/login');
            return;
        }
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Check if user has photos before allowing chat
        const photoUrls = parsedUser.profile?.photo_urls;
        if (!photoUrls || (Array.isArray(photoUrls) && photoUrls.length === 0)) {
            // Redirect to dashboard if no photos
            console.warn('⚠️ User has no photos. Redirecting to dashboard.');
            navigate('/dashboard');
            return;
        }
        
        // Fetch chats immediately with the parsed user (don't wait for state update)
        if (parsedUser?.user_id) {
            const userId = parsedUser.user_id || `user_${parsedUser.username}`;
            fetchChatsWithUserId(userId);
        }
    }, [navigate]);

    // Also fetch chats when user state is updated (as a backup)
    useEffect(() => {
        if (user?.username) {
            fetchChats();
        }
    }, [user?.username]);

    // No WebSocket connection needed - using REST API

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchChatsWithUserId = async (user_id) => {
        if (!user_id) {
            console.warn('⚠️ No user_id provided to fetchChatsWithUserId');
            return;
        }
        try {
            console.log('📨 Fetching chats for user_id:', user_id);
            const data = await getChats(user_id);
            console.log('📨 Fetched chats from UserChat table:', data);
            console.log(`📊 Total chats received: ${Array.isArray(data) ? data.length : 'not an array'}`);
            
            if (!Array.isArray(data)) {
                console.error('❌ Invalid response format - expected array, got:', typeof data, data);
                setChats([]);
                return;
            }
            
            setChats(data);
            console.log(`✅ Set ${data.length} chats to state`);
            
            if (data.length > 0 && !activeChat) {
                const firstChat = data[0];
                setActiveChat(firstChat);
                // Get messages from agent_state (already included in chat object)
                const chatMessages = firstChat.messages || [];
                console.log('💬 Loading chat history from AgentState:', chatMessages.length, 'messages');
                setMessages(chatMessages);
            } else if (data.length === 0) {
                // No chats - clear active chat and messages
                console.log('ℹ️ No chats found for user');
                setActiveChat(null);
                setMessages([]);
            }
        } catch (err) {
            console.error('❌ Failed to fetch chats:', err);
            console.error('Error details:', {
                message: err.message,
                stack: err.stack,
                name: err.name
            });
            // Set empty array on error to show "No chats" state
            setChats([]);
        }
    };

    const fetchChats = async () => {
        if (!user?.user_id) return;
        const userId = user.user_id || `user_${user.username}`;
        await fetchChatsWithUserId(userId);
    };

    const createNewChat = async () => {
        if (!user?.user_id) return;
        try {
            // Use user_id directly (no username needed)
            const userId = user.user_id || `user_${user.username}`;
            const newChat = await createChat({
                user_id: userId,
                session_name: `Chat ${chats.length + 1}`
            });
            setChats([...chats, newChat]);
            setActiveChat(newChat);
            setMessages([]);
        } catch (err) {
            console.error('Failed to create chat:', err);
        }
    };

    // No WebSocket connection function needed - using REST API

    const sendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || isSending) {
            return;
        }

        if (!user?.username || !activeChat) {
            console.error('Cannot send message: Missing user or active chat');
            return;
        }

        const messageText = input.trim();
        console.log('📤 Sending message:', messageText);
        
        // Add user message to UI immediately
        const newMsg = { role: 'user', content: messageText };
        setMessages(prev => [...prev, newMsg]);
        setInput('');
        setIsSending(true);

        try {
            // Get user_id and thread_id
            const userId = user.user_id || `user_${user.username}`;
            const threadId = activeChat.chat_room_id || activeChat.id || activeChat.chat_id;

            // Send message via REST API
            const response = await sendChatMessage(messageText, userId, threadId);
            console.log('📨 Received response:', response);

            // Add assistant response to messages with ranked_products (or styled_products as fallback)
            if (response.response) {
                // Prioritize ranked_products, fallback to styled_products for backward compatibility
                const products = response.ranked_products || response.styled_products || null;
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: response.response,
                    ranked_products: response.ranked_products || null,
                    styled_products: response.styled_products || null,  // Keep for backward compatibility
                    products: products,  // Unified products field (ranked_products prioritized)
                    merged_images: response.merged_images || null
                }]);
            }

            // Refresh chats to get updated messages
            if (user?.user_id) {
                const userId = user.user_id || `user_${user.username}`;
                await fetchChatsWithUserId(userId);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            
            // Handle photo requirement error
            if (error.message && error.message.includes('upload at least one photo')) {
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: `Please upload at least one photo in your dashboard before starting a chat. This helps us personalize product recommendations for you.` 
                }]);
                // Optionally redirect to dashboard after a delay
                setTimeout(() => {
                    navigate('/dashboard');
                }, 3000);
            } else {
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: `Error: ${error.message || 'Failed to send message. Please try again.'}` 
                }]);
            }
        } finally {
            setIsSending(false);
        }
    };

    const handleLikeImage = async (imageId) => {
        if (!user?.username) return;
        try {
            await likeImage(user.username, imageId);
            console.log('Image liked successfully');
        } catch (err) {
            console.error('Failed to like image:', err);
        }
    };

    if (!user) return null;

    return (
        <div className="flex h-screen bg-black text-zinc-100 overflow-hidden">
            {/* Sidebar */}
            <div className="w-80 border-r border-white/10 bg-zinc-900/30 flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
                        <ArrowLeft className="w-5 h-5 text-zinc-400 hover:text-white" />
                        <span className="font-semibold">Back to Dashboard</span>
                    </div>
                </div>

                <div className="p-4">
                    <button
                        onClick={createNewChat}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white transition-all bg-purple-600 rounded-xl hover:bg-purple-700 active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        New Chat
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-1">
                    {chats.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
                            <MessageSquare className="w-8 h-8 text-zinc-600 mb-2 opacity-50" />
                            <p className="text-sm text-zinc-500">No chats yet</p>
                            <p className="text-xs text-zinc-600 mt-1">Create a new chat to get started</p>
                        </div>
                    ) : (
                        chats.map(chat => (
                            <button
                                key={chat.id || chat.chat_id}
                                onClick={() => {
                                    setActiveChat(chat);
                                    // Load messages from agent_state
                                    const chatMessages = chat.messages || [];
                                    console.log('💬 Loading chat history:', chatMessages.length, 'messages');
                                    setMessages(chatMessages);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl transition-all ${(activeChat?.id === chat.id || activeChat?.chat_id === chat.chat_id)
                                    ? 'bg-white/10 text-white'
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                                    }`}
                            >
                                <MessageSquare className="w-4 h-4" />
                                <span className="truncate">{chat.session_name || chat.name || `Chat ${chat.id || chat.chat_id}`}</span>
                            </button>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                            {user.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.username || 'User'}</p>
                            <p className="text-xs text-zinc-500">Pro Plan</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-black relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/10 via-black to-black pointer-events-none" />

                {/* Header */}
                <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/50 backdrop-blur-xl z-10">
                    <div className="flex items-center gap-3">
                        <span className="font-medium">{activeChat?.session_name || activeChat?.name || 'Select a chat'}</span>
                        {isSending && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                                <span className="text-xs text-yellow-400">Sending...</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-2 text-zinc-400 hover:text-white transition-colors">
                            <MoreVertical className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.length === 0 && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center text-zinc-500">
                                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p className="text-lg font-medium mb-2">Start your conversation</p>
                                <p className="text-sm text-zinc-600">Ask me anything about fashion, styling, or products!</p>
                            </div>
                        </div>
                    )}
                    {messages.map((msg, idx) => (
                        msg.type === 'progress' ? (
                            // Progress message (agent started/completed)
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={idx}
                                className="flex justify-center my-2"
                            >
                                <div className="px-4 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-full text-xs text-zinc-400">
                                    {msg.content}
                                </div>
                            </motion.div>
                        ) : (
                            // Regular chat message
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={idx}
                            className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                    <Bot className="w-4 h-4 text-purple-400" />
                                </div>
                            )}

                            <div
                                className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                                    ? 'bg-purple-600 text-white rounded-tr-sm'
                                    : 'bg-zinc-900 border border-white/10 text-zinc-100 rounded-tl-sm'
                                    }`}
                            >
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                    
                                    {/* Display ranked_products (prioritized) or styled_products (fallback) */}
                                    {((msg.ranked_products && msg.ranked_products.length > 0) || 
                                      (msg.styled_products && msg.styled_products.length > 0) ||
                                      (msg.products && msg.products.length > 0)) && (
                                        <div className="mt-4 space-y-4">
                                            {(msg.ranked_products || msg.products || msg.styled_products).map((product, productIdx) => (
                                                <div 
                                                    key={product.id || productIdx}
                                                    className="bg-zinc-800/50 border border-white/10 rounded-xl p-4 hover:border-purple-500/50 transition-all"
                                                >
                                                    <div className="flex gap-4">
                                                        {/* Merged Image */}
                                                        {product.merged_image_url && (
                                                            <div className="flex-shrink-0">
                                                                <img 
                                                                    src={product.merged_image_url}
                                                                    alt={product.title || 'Product'}
                                                                    className="w-32 h-32 object-cover rounded-lg border border-white/10"
                                                                    onError={(e) => {
                                                                        // Fallback to product image if merged image fails
                                                                        if (product.image && e.target.src !== product.image) {
                                                                            e.target.src = product.image;
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        )}
                                                        
                                                        {/* Product Details */}
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-semibold text-white mb-2 line-clamp-2">
                                                                {product.title || 'Product'}
                                                            </h3>
                                                            
                                                            <div className="flex items-center gap-4 mb-2">
                                                                {product.price && (
                                                                    <span className="text-lg font-bold text-purple-400">
                                                                        {product.price}
                                                                    </span>
                                                                )}
                                                                {product.rating && (
                                                                    <span className="text-sm text-zinc-400">
                                                                        ⭐ {product.rating}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            {product.source && (
                                                                <p className="text-xs text-zinc-500 mb-2">
                                                                    From {product.source}
                                                                </p>
                                                            )}
                                                            
                                                            {product.link && (
                                                                <a
                                                                    href={product.link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
                                                                >
                                                                    View Product
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                    </svg>
                                                                </a>
                                                            )}
                                                            
                                                            {/* Like button */}
                                                            {product.id && (
                                                                <button
                                                                    onClick={() => handleLikeImage(product.id)}
                                                                    className="mt-2 p-2 text-zinc-400 hover:text-red-500 transition-colors"
                                                                    title="Like this product"
                                                                >
                                                                    <Heart className="w-5 h-5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                            </div>

                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-white/10">
                                    <User className="w-4 h-4 text-zinc-400" />
                                </div>
                            )}
                        </motion.div>
                        )
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-6 bg-black/50 backdrop-blur-xl border-t border-white/10 z-10">
                    <form onSubmit={sendMessage} className="relative max-w-4xl mx-auto flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={isSending ? "Sending message..." : "Ask anything..."}
                                disabled={isSending}
                                className="w-full pl-6 pr-14 py-4 bg-zinc-900/50 border border-white/10 rounded-2xl focus:outline-none focus:border-purple-500/50 focus:bg-zinc-900 transition-all text-white placeholder:text-zinc-600 disabled:opacity-50"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!input.trim() || isSending}
                            className="p-4 bg-purple-600 rounded-2xl text-white hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-all"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Chat;
