import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UserCheck, Lock } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <header style={{ textAlign: 'center', marginBottom: '4rem' }} className="animate-fade-in">
        <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>TrustID</h1>
        <p style={{ fontSize: '1.25rem', maxWidth: '600px', margin: '0 auto' }}>
          User-Controlled Financial Identity Verification. Secure, Instant, and Private.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }} className="animate-fade-in">
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <ShieldCheck size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h3>Deepfake Protection</h3>
          <p>Advanced real-time detection of AI-generated faces and spoofing attempts.</p>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <Lock size={48} color="var(--accent)" style={{ marginBottom: '1rem' }} />
          <h3>Zero-Knowledge</h3>
          <p>Prove your identity without exposing your raw Personally Identifiable Information.</p>
        </div>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <UserCheck size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
          <h3>One-Time KYC</h3>
          <p>Register once and instantly share your verified status with any institution.</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }} className="animate-fade-in">
        <button className="btn btn-primary" onClick={() => navigate('/register')} style={{ padding: '1rem 2.5rem', fontSize: '1.125rem' }}>
          Get Started
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/login')} style={{ padding: '1rem 2.5rem', fontSize: '1.125rem' }}>
          Login
        </button>
      </div>
    </div>
  );
}
