import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { login } from '../services/api';

const Login = () => {
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username.trim()) {
            setError('Please enter a username');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const data = await login(username.trim());
            localStorage.setItem('user', JSON.stringify(data));
            navigate('/dashboard');
        } catch (error) {
            console.error('Login failed:', error);
            setError('Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-black selection:bg-purple-500/30">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-md p-8 mx-4 border bg-white/5 backdrop-blur-xl border-white/10 rounded-2xl shadow-2xl"
            >
                <div className="flex flex-col items-center mb-8">
                    <div className="p-3 mb-4 rounded-full bg-purple-500/10 ring-1 ring-purple-500/20">
                        <Sparkles className="w-8 h-8 text-purple-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                        Welcome to Aura AI
                    </h1>
                    <p className="mt-2 text-sm text-center text-zinc-400">
                        Your personal AI fashion assistant
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block mb-2 text-xs font-medium tracking-wider text-zinc-500 uppercase">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 text-white transition-all duration-200 border outline-none bg-white/5 border-white/10 rounded-xl focus:border-purple-500/50 focus:bg-white/10 placeholder:text-zinc-600"
                            placeholder="Enter your username"
                        />
                    </div>

                    {error && (
                        <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="group relative w-full flex items-center justify-center gap-2 px-4 py-3 font-medium text-white transition-all duration-200 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span>{loading ? 'Logging in...' : 'Get Started'}</span>
                        {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
                    </button>
                </form>
            </motion.div>
        </div>
    );
};

export default Login;
