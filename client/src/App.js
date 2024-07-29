import React from 'react';
import Login from './components/Login';
import { Route, Routes } from 'react-router-dom';
import Form from './components/Form';
import Video from './components/Video';
import Redirect from './components/Redirect';
import { AuthProvider } from './components/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const App = () => {
  return (
    <AuthProvider>
    <div className='w-full h-screen bg-slate-400'>
      <Routes>
        <Route path="/" element={<Redirect />} /> 
        <Route path="/login" element={<Login />} />
        <Route 
            path="/form" 
            element={
              <ProtectedRoute>
                <Form />
              </ProtectedRoute>
            } 
        />
        <Route path="/video/:id" element={<Video/>} />
      </Routes>
    </div>
    </AuthProvider>
  )
}

export default App