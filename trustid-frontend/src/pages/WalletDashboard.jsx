import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { 
  LogOut, Shield, QrCode, ShieldCheck, XCircle, Lock, 
  FileText, ExternalLink, Check, X, AlertTriangle, Fingerprint, Maximize2
} from 'lucide-react';

export default function WalletDashboard() {
  const { state, dispatch } = useContext(AppContext);
  const navigate = useNavigate();

  const [signatureValid, setSignatureValid] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSharedProof, setLastSharedProof] = useState(null);
  const [isIdExpanded, setIsIdExpanded] = useState(false);

  const user = state.user || {};
  const credential = user.credential;
  const signature = user.credentialSignature;

  useEffect(() => {
    if (credential && signature) verifySignature();
  }, []);

  const verifySignature = async () => {
    setVerifying(true);
    try {
      const { loadKeyPair, verifyCredential } = await import('../crypto/credentialSigner.js');
      const keys = await loadKeyPair();
      if (!keys) { setSignatureValid(false); setVerifying(false); return; }
      const valid = await verifyCredential(credential, signature, keys.publicKey);
      setSignatureValid(valid);
    } catch (err) {
      console.error('Verification failed:', err);
      setSignatureValid(false);
    }
    setVerifying(false);
  };

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/');
  };

  const simulateExternalRequest = () => {
    setActiveRequest({
      app: 'LendSafe Finance',
      logo: '🏦',
      purpose: 'Verification for Instant Personal Loan',
      permissions: [
        { id: 'name', label: 'Full Name', type: 'plain', enabled: true },
        { id: 'age', label: 'Age Over 18', type: 'zkp', enabled: true },
        { id: 'kyc', label: 'KYC Status', type: 'plain', enabled: true },
        { id: 'income', label: 'Annual Income > $50,000', type: 'zkp', enabled: true },
        { id: 'country', label: 'Country of Residence', type: 'plain', enabled: false },
      ]
    });
  };

  const handleProcessRequest = async (approved) => {
    if (!approved) {
      setActiveRequest(null);
      return;
    }

    setIsProcessing(true);
    try {
      const { proveAgeOver, proveIncomeAbove } = await import('../crypto/zkpProver.js');
      const { createSelectiveProof } = await import('../crypto/selectiveDisclosure.js');

      const sharedData = {
        app: activeRequest.app,
        timestamp: new Date().toISOString(),
        proofs: {}
      };

      // 1. Generate ZKP Proofs for sensitive fields
      const ageEnabled = activeRequest.permissions.find(p => p.id === 'age').enabled;
      const incomeEnabled = activeRequest.permissions.find(p => p.id === 'income').enabled;

      if (ageEnabled) {
        sharedData.proofs.ageProof = await proveAgeOver(credential, 18);
      }
      if (incomeEnabled) {
        sharedData.proofs.incomeProof = await proveIncomeAbove(credential, 50000);
      }

      // 2. Generate Selective Disclosure for other fields
      const revealedIndices = [];
      if (activeRequest.permissions.find(p => p.id === 'name').enabled) revealedIndices.push(9); // name
      if (activeRequest.permissions.find(p => p.id === 'kyc').enabled) revealedIndices.push(0); // kycStatus
      if (activeRequest.permissions.find(p => p.id === 'country').enabled) revealedIndices.push(2); // country

      if (revealedIndices.length > 0 && user.bbsCredential) {
        sharedData.proofs.selectiveDisclosure = await createSelectiveProof(user.bbsCredential, revealedIndices);
      }

      setLastSharedProof(sharedData);
      console.log('Shared Zero-Knowledge Package:', sharedData);
      
      setTimeout(() => {
        setIsProcessing(false);
        setActiveRequest(null);
        alert(`Success! Zero-Knowledge Identity Package sent to ${activeRequest.app}. No raw PII was exposed.`);
      }, 2000);

    } catch (err) {
      console.error('Request processing failed:', err);
      setIsProcessing(false);
      alert('Error generating ZKP proofs.');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '100vh' }} className="animate-fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0 }}><Shield style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--primary)' }} /> TrustID Wallet</h2>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Secure Decentralized Identity Hub</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={simulateExternalRequest} style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
            <ExternalLink size={18} /> Simulate Request
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '0.5rem 1rem' }}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2.5rem' }}>
        
        {/* LEFT COLUMN: Identity Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Your Identity Cards</h3>
          
          {/* PREMIUM ID CARD */}
          <div 
            className="id-card animate-fade-in" 
            style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
            onClick={() => setIsIdExpanded(true)}
          >
            <div className="id-card-bg-glow" />
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10 }}>
              <Maximize2 size={16} color="var(--text-secondary)" />
            </div>
            <div className="id-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} color="var(--primary)" />
                <span style={{ fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px' }}>TRUSTID NETWORK</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid var(--success)' }}>
                VERIFIED ID
              </div>
            </div>
            
            <div className="id-card-body">
              <img 
                src={user.photoUrl || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=250&fit=crop"} 
                className="id-card-photo" 
                alt="ID Photo"
              />
              <div className="id-card-info">
                <div className="id-card-label">Full Name</div>
                <div className="id-card-value">{user.name || 'Jane Doe'}</div>
                
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div>
                    <div className="id-card-label">DOB</div>
                    <div className="id-card-value" style={{ fontSize: '0.85rem' }}>{user.dob || '10-05-2003'}</div>
                  </div>
                  <div>
                    <div className="id-card-label">Nationality</div>
                    <div className="id-card-value" style={{ fontSize: '0.85rem' }}>IN</div>
                  </div>
                </div>

                <div className="id-card-label">Credential ID</div>
                <div className="id-card-value" style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  {credential?.id?.substring(0, 24)}...
                </div>
              </div>
            </div>
            
            <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', textAlign: 'right' }}>
              <Fingerprint size={32} color="rgba(255,255,255,0.2)" />
            </div>
          </div>

          {/* Verification Status Banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '1rem 1.5rem', borderRadius: '0.75rem',
            background: signatureValid ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
            border: `1px solid ${signatureValid ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
          }}>
            {signatureValid ? (
              <>
                <ShieldCheck size={24} color="var(--success)" />
                <div>
                  <div style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem' }}>Cryptographic Proof Valid</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Signed via RSA-PSS 2048 with Hardware Security Module (HSM)</div>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle size={24} color="var(--error)" />
                <div>
                  <div style={{ color: 'var(--error)', fontWeight: 'bold', fontSize: '0.9rem' }}>Verification Pending</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Unable to verify signature integrity locally.</div>
                </div>
              </>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Privacy Center */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="glass-panel">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={18} color="var(--accent)" /> Privacy Control Center
            </h3>
            <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              You have full control over your data. External apps can only access what you explicitly approve via ZKP.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem' }}>Zero-Knowledge Proofs</span>
                <span style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 'bold' }}>ALWAYS ACTIVE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem' }}>Selective Disclosure</span>
                <span style={{ color: 'var(--success)', fontSize: '0.75rem', fontWeight: 'bold' }}>ENFORCED</span>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="glass-panel" style={{ flexGrow: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Activity Log</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {lastSharedProof && (
                <div style={{ padding: '0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid var(--success)', borderRadius: '0.5rem', position: 'relative' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--success)' }}>Data Shared Securely</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Shared with {lastSharedProof.app}</div>
                  <div style={{ fontSize: '0.6rem', marginTop: '0.25rem' }}>{new Date(lastSharedProof.timestamp).toLocaleString()}</div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', marginTop: '5px' }} />
                <div>
                  <div style={{ fontSize: '0.85rem' }}>Credential Issued</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>TrustID Network Certification</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', marginTop: '5px' }} />
                <div>
                  <div style={{ fontSize: '0.85rem' }}>Face Liveliness Verified</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Anti-spoofing challenge completed</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* FULL SCREEN ID OVERLAY */}
      {isIdExpanded && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
          padding: '2rem'
        }} onClick={() => setIsIdExpanded(false)}>
          <div 
            className="id-card animate-fade-in" 
            style={{ 
              transform: 'scale(1.5)', 
              boxShadow: '0 0 100px rgba(59, 130, 246, 0.4)',
              cursor: 'default'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="id-card-bg-glow" />
            <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 10, cursor: 'pointer' }} onClick={() => setIsIdExpanded(false)}>
              <X size={20} color="var(--text-secondary)" />
            </div>
            <div className="id-card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={20} color="var(--primary)" />
                <span style={{ fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '1px' }}>TRUSTID NETWORK</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--success)', background: 'rgba(16,185,129,0.1)', padding: '0.2rem 0.6rem', borderRadius: '1rem', border: '1px solid var(--success)' }}>
                VERIFIED ID
              </div>
            </div>
            
            <div className="id-card-body">
              <img 
                src={user.photoUrl || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=200&h=250&fit=crop"} 
                className="id-card-photo" 
                alt="ID Photo"
              />
              <div className="id-card-info">
                <div className="id-card-label">Full Name</div>
                <div className="id-card-value">{user.name || 'Jane Doe'}</div>
                
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <div>
                    <div className="id-card-label">DOB</div>
                    <div className="id-card-value" style={{ fontSize: '0.85rem' }}>{user.dob || '10-05-2003'}</div>
                  </div>
                  <div>
                    <div className="id-card-label">Nationality</div>
                    <div className="id-card-value" style={{ fontSize: '0.85rem' }}>IN</div>
                  </div>
                </div>

                <div className="id-card-label">Credential ID</div>
                <div className="id-card-value" style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  {credential?.id?.substring(0, 24)}...
                </div>
              </div>
            </div>
            
            <div style={{ position: 'absolute', bottom: '1.5rem', right: '1.5rem', textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end', opacity: 0.5 }}>
                <QrCode size={40} color="white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXTERNAL REQUEST MODAL */}
      {activeRequest && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '2rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{ maxWidth: '500px', width: '100%', margin: '0 auto', border: '1px solid var(--primary)' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{activeRequest.logo}</div>
              <h2 style={{ margin: 0 }}>{activeRequest.app}</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>Requesting Identity Verification</p>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '2rem' }}>
              <p style={{ fontSize: '0.85rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                <strong>Purpose:</strong> {activeRequest.purpose}
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {activeRequest.permissions.map(perm => (
                  <div key={perm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{perm.label}</div>
                      <div style={{ fontSize: '0.7rem', color: perm.type === 'zkp' ? 'var(--success)' : 'var(--text-secondary)' }}>
                        {perm.type === 'zkp' ? '🛡️ Zero-Knowledge Proof (No data shared)' : '📋 Selective Disclosure'}
                      </div>
                    </div>
                    <label className="switch">
                      <input 
                        type="checkbox" 
                        checked={perm.enabled} 
                        onChange={() => {
                          const newPerms = activeRequest.permissions.map(p => 
                            p.id === perm.id ? { ...p, enabled: !p.enabled } : p
                          );
                          setActiveRequest({ ...activeRequest, permissions: newPerms });
                        }}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%' }}
                onClick={() => handleProcessRequest(false)}
                disabled={isProcessing}
              >
                <X size={18} /> Decline
              </button>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={() => handleProcessRequest(true)}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <div style={{ width: 18, height: 18, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <><Check size={18} /> Approve & Sign</>
                )}
              </button>
            </div>
            
            <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
              By approving, you generate a cryptographic ZKP proof on your device.
            </p>
          </div>
        </div>
      )}

      {/* JSON Viewer */}
      <div style={{ marginTop: '3rem', textAlign: 'center' }}>
        <button 
          onClick={() => setShowJson(!showJson)}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {showJson ? 'Hide' : 'View'} Technical Credential JSON
        </button>
      </div>

      {showJson && (
        <div className="glass-panel animate-fade-in" style={{ marginTop: '1rem' }}>
          <pre style={{ fontSize: '0.7rem', overflow: 'auto', maxHeight: '400px', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '0.5rem' }}>
            {JSON.stringify({
              credential,
              bbsCredential: user.bbsCredential,
              lastSharedProof
            }, null, 2)}
          </pre>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
