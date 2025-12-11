import React, { useState, useEffect, useRef } from 'react';

const ChatRoom = ({ username, room, onLeave }) => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const ws = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        // Connect to WebSocket
        // Note: In production, use an environment variable for the backend URL
        // WebSocket not used - using REST API instead
        // ws.current = new WebSocket(`wss://aura-ai-997596012968.us-central1.run.app/ws/${room}/${username}`);

        ws.current.onopen = () => {
            console.log('Connected to WebSocket');
        };

        ws.current.onmessage = (event) => {
            setMessages((prev) => [...prev, event.data]);
        };

        ws.current.onclose = () => {
            console.log('Disconnected from WebSocket');
        };

        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, [username, room]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (inputMessage && ws.current) {
            ws.current.send(inputMessage);
            setInputMessage('');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
                <div>
                    <h1 className="text-xl font-bold text-gray-800">Room: {room}</h1>
                    <p className="text-sm text-gray-500">Logged in as: {username}</p>
                </div>
                <button
                    onClick={onLeave}
                    className="px-4 py-2 text-sm text-red-600 border border-red-600 rounded-md hover:bg-red-50"
                >
                    Leave Room
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto">
                <div className="space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className="p-3 bg-white rounded-lg shadow-sm w-fit max-w-[80%]">
                            <p className="text-gray-800">{msg}</p>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t">
                <form onSubmit={sendMessage} className="flex gap-4">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Type a message..."
                    />
                    <button
                        type="submit"
                        className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        Send
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatRoom;
