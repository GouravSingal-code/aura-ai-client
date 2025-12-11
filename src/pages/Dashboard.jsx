import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Database, MessageSquare, LogOut, Settings, Heart, Upload, X, Image as ImageIcon } from 'lucide-react';
import { updateUser, uploadImageViaProxy, getImageProxyUrl, deletePhoto, extractS3KeyFromUrl } from '../services/api';

const Dashboard = () => {
    const [user, setUser] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editFields, setEditFields] = useState({});
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [userPhotos, setUserPhotos] = useState([]);
    const navigate = useNavigate();

    // Profile fields to show (username + these 5)
    const profileFieldsToShow = ['username', 'upper_body_size', 'lower_body_size', 'region', 'gender', 'age_group'];
    
    // Dropdown options matching Google Shopping API expectations
    const dropdownOptions = {
        upper_body_size: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
        lower_body_size: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
        region: [
            { value: 'in', label: 'India' },
            { value: 'us', label: 'United States' },
            { value: 'uk', label: 'United Kingdom' },
            { value: 'ca', label: 'Canada' },
            { value: 'au', label: 'Australia' },
            { value: 'de', label: 'Germany' },
            { value: 'fr', label: 'France' },
            { value: 'it', label: 'Italy' },
            { value: 'es', label: 'Spain' },
            { value: 'jp', label: 'Japan' },
            { value: 'cn', label: 'China' },
            { value: 'br', label: 'Brazil' },
            { value: 'mx', label: 'Mexico' },
            { value: 'sg', label: 'Singapore' },
            { value: 'ae', label: 'UAE' },
        ],
        gender: ['male', 'female', 'men', 'women', 'unisex', 'boys', 'girls'],
        age_group: ['adult', 'teen', 'kids', 'children', 'toddler', 'infant', 'senior'],
    };

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            navigate('/login');
            return;
        }
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Set edit fields with only the fields we want to show
        const filteredProfile = {};
        profileFieldsToShow.forEach(field => {
            // Get value from profile or top-level user object (for username)
            const value = parsedUser.profile?.[field] ?? parsedUser[field];
            if (value !== undefined) {
                filteredProfile[field] = value;
            }
        });
        setEditFields(filteredProfile);
        
        // Load user photos
        if (parsedUser.profile?.photo_urls && Array.isArray(parsedUser.profile.photo_urls)) {
            setUserPhotos(parsedUser.profile.photo_urls);
        }
    }, [navigate]);

    const handleFieldUpdate = (key, value) => {
        setEditFields(prev => ({ ...prev, [key]: value }));
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        // Check file size (e.g., max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            setError('File size must be less than 10MB');
            return;
        }

        setUploading(true);
        setError('');

        try {
            // Upload through backend proxy (avoids CORS issues)
            const updatedUser = await uploadImageViaProxy(user.username, file);
            setUser(updatedUser);
            
            // Update edit fields
            const filteredProfile = {};
            profileFieldsToShow.forEach(field => {
                const value = updatedUser.profile?.[field] ?? updatedUser[field];
                if (value !== undefined) {
                    filteredProfile[field] = value;
                }
            });
            setEditFields(filteredProfile);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Update user photos (ensure it's always an array)
            const photoUrls = updatedUser.profile?.photo_urls;
            if (Array.isArray(photoUrls)) {
                setUserPhotos(photoUrls);
            } else if (photoUrls) {
                // Handle case where photo_urls might be a single string or other format
                setUserPhotos([photoUrls]);
            } else {
                // Ensure empty array if no photos
                setUserPhotos([]);
            }

        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.message || 'Failed to upload image. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeletePhoto = async (photoUrl, index) => {
        if (!confirm('Are you sure you want to delete this photo?')) {
            return;
        }

        try {
            // Extract s3_key from photo URL
            const s3Key = extractS3KeyFromUrl(photoUrl);
            
            if (!s3Key) {
                throw new Error('Could not extract S3 key from photo URL');
            }

            // Delete photo from S3 and update user profile
            const result = await deletePhoto(user.username, s3Key);
            
            // Update local state
            const updatedPhotos = result.photo_urls || [];
            setUserPhotos(updatedPhotos);
            
            // Update user object
            const updatedUser = {
                ...user,
                profile: {
                    ...user.profile,
                    photo_urls: updatedPhotos
                }
            };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
        } catch (err) {
            console.error('Delete failed:', err);
            setError(err.message || 'Failed to delete photo. Please try again.');
        }
    };

    const handleSaveProfile = async () => {
        setUploading(true);
        setError('');

        try {
            const updatedUser = await updateUser(user.username, editFields);
            setUser(updatedUser);
            
            // Update edit fields with only the fields we want to show
            const filteredProfile = {};
            profileFieldsToShow.forEach(field => {
                // Get value from profile or top-level user object (for username)
                const value = updatedUser.profile?.[field] ?? updatedUser[field];
                if (value !== undefined) {
                    filteredProfile[field] = value;
                }
            });
            setEditFields(filteredProfile);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setIsEditing(false);
        } catch (err) {
            console.error('Update failed:', err);
            setError('Failed to update profile. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    const handleCancelEdit = () => {
        const filteredProfile = {};
        profileFieldsToShow.forEach(field => {
            // Get value from profile or top-level user object (for username)
            const value = user.profile?.[field] ?? user[field];
            if (value !== undefined) {
                filteredProfile[field] = value;
            }
        });
        setEditFields(filteredProfile);
        setIsEditing(false);
        setError('');
    };

    if (!user) return null;

    return (
        <div className="min-h-screen bg-black text-zinc-100">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
                <div className="flex items-center justify-between px-6 py-4 mx-auto max-w-7xl">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-pink-500" />
                        <span className="text-xl font-bold tracking-tight">Aura AI</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/chat')}
                            className="px-4 py-2 text-sm font-medium transition-colors rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
                        >
                            Go to Chat
                        </button>
                        <button
                            onClick={() => {
                                localStorage.removeItem('user');
                                navigate('/login');
                            }}
                            className="p-2 transition-colors rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="px-6 py-12 mx-auto max-w-7xl">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">

                    {/* User Profile Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 border lg:col-span-1 bg-zinc-900/50 border-white/10 rounded-2xl"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">Profile</h2>
                                    <p className="text-sm text-zinc-500">{user.profile?.username || user.username || 'Personal Information'}</p>
                                </div>
                            </div>
                            {!isEditing && (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition-colors"
                                >
                                    Edit
                                </button>
                            )}
                        </div>

                        {error && (
                            <div className="mb-4 p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl">
                                {error}
                            </div>
                        )}

                        {/* Profile Fields - Only show specified fields */}
                        <div className="space-y-4">
                            {profileFieldsToShow.map((field) => {
                                // Get value from editFields (if editing), profile, or top-level user object (for username)
                                const value = isEditing 
                                    ? editFields[field] 
                                    : (user.profile?.[field] ?? user[field] ?? null);
                                const options = dropdownOptions[field];
                                const isDropdown = options && options.length > 0;
                                
                                return (
                                    <div key={field} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                                        <span className="text-sm capitalize text-zinc-400">{field.replace('_', ' ')}</span>
                                        {isEditing ? (
                                            field === 'username' ? (
                                                // Username is read-only (cannot be edited)
                                                <span className="flex-1 ml-4 text-sm font-medium text-zinc-500">
                                                    {value || 'Not set'} (read-only)
                                                </span>
                                            ) : isDropdown ? (
                                                <select
                                                    value={value || ''}
                                                    onChange={(e) => handleFieldUpdate(field, e.target.value)}
                                                    className="flex-1 ml-4 px-2 py-1 text-sm text-white bg-white/5 border border-white/10 rounded focus:outline-none focus:border-purple-500/50"
                                                >
                                                    <option value="">Select {field.replace('_', ' ')}</option>
                                                    {options.map((option) => {
                                                        const optionValue = typeof option === 'object' ? option.value : option;
                                                        const optionLabel = typeof option === 'object' ? option.label : option;
                                                        return (
                                                            <option key={optionValue} value={optionValue}>
                                                                {optionLabel}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                            ) : (
                                        <input
                                            type="text"
                                                    value={value || ''}
                                                    onChange={(e) => handleFieldUpdate(field, e.target.value)}
                                                    placeholder={`Enter ${field.replace('_', ' ')}`}
                                            className="flex-1 ml-4 px-2 py-1 text-sm text-white bg-white/5 border border-white/10 rounded focus:outline-none focus:border-purple-500/50"
                                        />
                                            )
                                    ) : (
                                        <span className="text-sm font-medium text-white">
                                                {value || 'Not set'}
                                        </span>
                                    )}
                                </div>
                                );
                            })}
                        </div>

                        {isEditing && (
                            <div className="flex gap-2 mt-6">
                                <button
                                    onClick={handleSaveProfile}
                                    disabled={uploading}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {uploading ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    disabled={uploading}
                                    className="px-4 py-2 text-sm font-medium text-zinc-400 border border-white/10 rounded-lg hover:bg-white/5 disabled:opacity-50 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </motion.div>

                    {/* User Photos Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="p-6 border lg:col-span-2 bg-zinc-900/50 border-white/10 rounded-2xl"
                    >
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
                                <ImageIcon className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">User Photos</h2>
                                <p className="text-sm text-zinc-500">Upload and manage your photos</p>
                            </div>
                        </div>

                        {/* Image Upload */}
                        <div className="mb-6">
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    disabled={uploading}
                                    className="hidden"
                                    id="image-upload"
                                />
                                <label
                                    htmlFor="image-upload"
                                    className={`flex items-center justify-center gap-2 px-4 py-3 border border-dashed rounded-xl cursor-pointer transition-all ${
                                        uploading
                                            ? 'border-zinc-600 bg-zinc-800/50 cursor-not-allowed'
                                            : 'border-white/20 hover:border-purple-500/50 hover:bg-white/5'
                                    }`}
                                >
                                    <Upload className={`w-4 h-4 ${uploading ? 'text-zinc-600' : 'text-zinc-400'}`} />
                                    <span className={`text-sm ${uploading ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                        {uploading ? 'Uploading...' : 'Upload Photo'}
                                        </span>
                                </label>
                            </div>
                                    </div>

                        {/* Display User Photos */}
                        {userPhotos.length > 0 ? (
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                                {userPhotos.map((photoUrl, idx) => (
                                    <div key={idx} className="relative group">
                                        <img
                                            src={getImageProxyUrl(photoUrl, user.username)}
                                            alt={`User photo ${idx + 1}`}
                                            className="w-full h-48 object-cover rounded-xl border border-white/10"
                                            onError={(e) => {
                                                // Fallback to original URL if proxy fails
                                                if (e.target.src !== photoUrl) {
                                                    e.target.src = photoUrl;
                                                }
                                            }}
                                        />
                                        {/* Delete button at top right corner */}
                                        <button
                                            onClick={() => handleDeletePhoto(photoUrl, idx)}
                                            className="absolute top-2 right-2 p-1.5 bg-red-500/90 hover:bg-red-500 rounded-full transition-all opacity-0 group-hover:opacity-100 shadow-lg z-10"
                                            title="Delete photo"
                                        >
                                            <X className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                ))}
                        </div>
                        ) : (
                            <div className="text-center py-12 text-zinc-500">
                                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No photos uploaded yet</p>
                            </div>
                        )}
                    </motion.div>

                    {/* Liked Items Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="p-6 border lg:col-span-3 bg-zinc-900/50 border-white/10 rounded-2xl"
                    >
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-3 rounded-xl bg-red-500/10 text-red-400">
                                <Heart className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">Liked Items</h2>
                                <p className="text-sm text-zinc-500">Products you've liked (ProductWithEmbedding IDs)</p>
                            </div>
                        </div>

                        {user.profile?.liked_items && user.profile.liked_items.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                                {user.profile.liked_items.map((itemId, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 border rounded-xl bg-black/40 border-white/5 text-center"
                                    >
                                        <Heart className="w-8 h-8 mx-auto mb-2 text-red-400" />
                                        <p className="text-xs text-zinc-400 font-mono truncate" title={itemId}>
                                            {itemId}
                                        </p>
                                    </div>
                            ))}
                        </div>
                        ) : (
                            <div className="text-center py-12 text-zinc-500">
                                <Heart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>No liked items yet</p>
                            </div>
                        )}
                    </motion.div>

                </div>
            </main>
        </div>
    );
};

export default Dashboard;
