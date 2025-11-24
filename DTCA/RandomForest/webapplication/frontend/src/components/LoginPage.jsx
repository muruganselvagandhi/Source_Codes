import React, { useState } from 'react';
import { Wind, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { authAPI, setAuthToken, setUserData } from '../utils/api';

const LoginPage = ({ onLogin, onShowSignup }) => {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [load, setLoad] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const submit = async () => {
    setLoad(true);
    setErr('');
    
    try {
      // Call backend API
      const response = await authAPI.login(u, p);
      
      if (response.success) {
        // Store token and user data
        setAuthToken(response.token);
        setUserData(response.user);
        
        // Call parent onLogin with user data
        onLogin(response.user);
      } else {
        setErr(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setErr(error.message || 'Unable to connect to server. Please ensure backend is running on port 5000.');
    } finally {
      setLoad(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1s'}} />
      </div>
      <div className="relative w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-2xl mb-4 shadow-lg">
              <Wind className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Wind Farm Monitor</h1>
            <p className="text-gray-400">Digital Twin Control Center</p>
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <input
                type="text"
                value={u}
                onChange={(e) => setU(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            {err && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm">
                {err}
              </div>
            )}
            <button
              onClick={submit}
              disabled={load}
              className="w-full py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all transform hover:scale-105 disabled:opacity-50 shadow-lg"
            >
              {load ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
          <div className="mt-6 space-y-3">
            <div className="text-center">
              <p className="text-sm text-gray-400">
                Don't have an account?{' '}
                <button
                  onClick={onShowSignup}
                  className="text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  Sign Up
                </button>
              </p>
            </div>
            
            {/* <div className="pt-3 border-t border-white/10">
              <p className="text-center text-gray-500 text-xs mb-2">Demo Credentials:</p>
              <div className="bg-white/5 rounded-lg p-3 text-xs text-gray-400 space-y-1">
                <p>👨‍💼 Admin: <span className="text-cyan-400">admin</span> / <span className="text-cyan-400">password</span></p>
                <p>👤 User: <span className="text-purple-400">user</span> / <span className="text-purple-400">user123</span></p>
              </div>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
