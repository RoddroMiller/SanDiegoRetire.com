import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const PasswordApp = () => {
  const PASSWORD = import.meta.env.VITE_GATE_PASSWORD || '4428';
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [input, setInput] = useState('');

  if (isAuthenticated) return <App />;

  return (
    <div className="h-screen flex items-center justify-center bg-slate-100 font-sans">
      <div className="p-8 bg-white rounded-xl shadow-lg border border-slate-200 w-80">
        <h2 className="text-xl font-bold mb-4 text-slate-800 text-center">Protected Access</h2>
        <input 
          type="password" 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          className="border border-slate-300 p-2 rounded-lg w-full mb-4 focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="Enter Password"
          onKeyDown={(e) => e.key === 'Enter' && (input === PASSWORD ? setIsAuthenticated(true) : alert('Incorrect Password'))}
        />
        <button 
          onClick={() => input === PASSWORD ? setIsAuthenticated(true) : alert('Incorrect Password')}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold transition-all"
        >
          Unlock
        </button>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PasswordApp />
  </React.StrictMode>,
)
