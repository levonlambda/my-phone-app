// src/components/AdminSetup.jsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '../context/AuthContext';
import { UserPlus, Mail, Lock, Shield, User, CheckCircle, AlertCircle } from 'lucide-react';

const AdminSetup = () => {
  const { register, currentUser, userRole } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Only allow admins to access this component
  if (!currentUser || userRole !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-red-900 mb-2">Access Denied</h2>
              <p className="text-red-700">Only administrators can create new user accounts.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    // Validation
    if (!formData.email || !formData.password) {
      setMessage({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    if (formData.password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(formData.email, formData.password, formData.role);
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: `User account created successfully! Email: ${formData.email}, Role: ${formData.role}` 
        });
        // Reset form
        setFormData({
          email: '',
          password: '',
          confirmPassword: '',
          role: 'user'
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Failed to create user account.' 
        });
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: 'An unexpected error occurred. Please try again.' 
      });
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader className="bg-[rgb(52,69,157)] text-white">
          <CardTitle className="text-xl flex items-center gap-2">
            <UserPlus className="h-6 w-6" />
            Create New User Account
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Message Display */}
            {message.text && (
              <div className={`p-4 rounded-lg flex items-start gap-2 ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {message.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                )}
                <span className="text-sm">{message.text}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(52,69,157)] focus:border-transparent"
                  placeholder="user@example.com"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password * (minimum 6 characters)
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(52,69,157)] focus:border-transparent"
                  placeholder="Enter password"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(52,69,157)] focus:border-transparent"
                  placeholder="Re-enter password"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium text-gray-700">
                User Role *
              </label>
              <div className="relative">
                {formData.role === 'admin' ? (
                  <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                ) : (
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                )}
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(52,69,157)] focus:border-transparent appearance-none"
                  disabled={isLoading}
                >
                  <option value="user">Regular User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {formData.role === 'admin' 
                  ? 'Administrators have full access to all features including procurement, stock receiving, and price management.'
                  : 'Regular users can access inventory, add phones, and view phone models.'}
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[rgb(52,69,157)] text-white py-2.5 rounded-lg hover:bg-[rgb(52,69,157)]/90 focus:outline-none focus:ring-2 focus:ring-[rgb(52,69,157)] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5" />
                  <span>Create User Account</span>
                </>
              )}
            </button>
          </form>

          {/* Instructions */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Account Creation Guidelines:</h3>
              <ul className="space-y-1 text-xs text-blue-800 list-disc list-inside">
                <li>Use a valid email address for each user account</li>
                <li>Passwords must be at least 6 characters long</li>
                <li>Assign appropriate roles based on user responsibilities</li>
                <li>Users will need their email and password to login</li>
                <li>Store credentials securely and share them privately with users</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetup;