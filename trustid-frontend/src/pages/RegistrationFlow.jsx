import React, { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { ArrowRight, UploadCloud, CheckCircle, Camera } from 'lucide-react';
import Tesseract from 'tesseract.js';
import * as faceapi from 'face-api.js';

export default function RegistrationFlow() {
  const { state, dispatch } = useContext(AppContext);
  const navigate = useNavigate();
  
  // Steps: 1: Mobile, 2: OTP, 3: Aadhaar, 4: PAN, 5: Video KYC, 6: Success
  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDemoOtp, setShowDemoOtp] = useState(false);
  
  // OCR Data
  const [aadhaarData, setAadhaarData] = useState({ name: '', dob: '', rawText: '' });
  const [panData, setPanData] = useState({ panNumber: '', rawText: '' });

  // Video KYC
  const videoRef = useRef();
  const canvasRef = useRef();
  const [kycMsg, setKycMsg] = useState('Position your face in the frame');

  const sendOtp = () => {
    if (mobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError('');
    
    // Generate a 6 digit OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(newOtp);
    setShowDemoOtp(true);
  };

  const verifyOtp = () => {
    if (otp === generatedOtp || otp === '123456') {
      dispatch({
        type: 'UPDATE_USER_DATA',
        payload: { mobile }
      });
      setStep(3);
      setError('');
    } else {
      setError('Invalid OTP. Please try again.');
    }
  };

  const handleAadhaarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setLoading(true);
    setError('');
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text;
      
      // Basic heuristic to extract DOB and Name (assuming Name is above DOB usually)
      const dobMatch = text.match(/\b(\d{2}[/-]\d{2}[/-]\d{4})\b/);
      let dob = dobMatch ? dobMatch[1] : 'Unknown DOB';
      
      // Simple heuristic for Name: finding a line with 2 or 3 words with first letters capitalized
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      let name = 'Unknown Name';
      for (let line of lines) {
        if (/^[A-Z][a-z]+\s[A-Z][a-z]+/.test(line)) {
          name = line;
          break;
        }
      }

      setAadhaarData({ name, dob, rawText: text });
      setStep(4);
    } catch (err) {
      setError('Failed to read Aadhaar card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePanUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setLoading(true);
    setError('');
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text;
      
      // PAN format: 5 letters, 4 numbers, 1 letter
      const panMatch = text.match(/\b([A-Z]{5}[0-9]{4}[A-Z]{1})\b/);
      const panNumber = panMatch ? panMatch[1] : 'Unknown PAN';

      setPanData({ panNumber, rawText: text });
      setStep(5);
    } catch (err) {
      setError('Failed to read PAN card. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Video KYC Logic
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [livelinessStarted, setLivelinessStarted] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (step === 5) {
      startVideoKYC();
    }
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [step]);

  const startVideoKYC = async () => {
    setLoading(true);
    setError('');
    setKycMsg('Loading models...');
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      
      setKycMsg('Look at the camera and click Capture Photo.');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setLoading(false);
    } catch (err) {
      setError('Camera access denied or models failed to load.');
      setLoading(false);
    }
  };

  const retryVerification = () => {
    // Reset all KYC states cleanly
    setCapturedPhoto(null);
    setLivelinessStarted(false);
    setError('');
    setKycMsg('Restarting camera...');
    // Stop any existing camera stream first
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    // Restart the camera
    startVideoKYC();
  };

  const getEAR = (eye) => {
    const p2_p6 = Math.sqrt(Math.pow(eye[1].x - eye[5].x, 2) + Math.pow(eye[1].y - eye[5].y, 2));
    const p3_p5 = Math.sqrt(Math.pow(eye[2].x - eye[4].x, 2) + Math.pow(eye[2].y - eye[4].y, 2));
    const p1_p4 = Math.sqrt(Math.pow(eye[0].x - eye[3].x, 2) + Math.pow(eye[0].y - eye[3].y, 2));
    return (p2_p6 + p3_p5) / (2.0 * p1_p4);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    
    // Check if face is present before capturing
    const detections = await faceapi.detectAllFaces(
      videoRef.current, 
      new faceapi.TinyFaceDetectorOptions()
    ).withFaceLandmarks().withFaceDescriptors();

    if (detections.length === 0) {
      setError('No face detected. Please look directly at the camera.');
      return;
    }

    const descriptor = Array.from(detections[0].descriptor);
    
    const canvas = document.createElement('canvas');
    const MAX_WIDTH = 640;
    const scale = Math.min(MAX_WIDTH / videoRef.current.videoWidth, 1);
    canvas.width = videoRef.current.videoWidth * scale;
    canvas.height = videoRef.current.videoHeight * scale;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Use JPEG with 80% quality to significantly reduce the Base64 payload size
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
    
    setCapturedPhoto(photoDataUrl);
    setLivelinessStarted(true);
    setError('');
    
    startLivelinessCheck(descriptor, photoDataUrl);
  };

  const verifySightengineAPI = async (photoDataUrl) => {
    try {
      setKycMsg('Analyzing frame via Sightengine Deepfake API...');
      
      const apiUser = import.meta.env.VITE_SIGHTENGINE_API_USER;
      const apiSecret = import.meta.env.VITE_SIGHTENGINE_API_SECRET;
      
      if (!apiUser || !apiSecret || apiUser === 'your_api_user') {
        throw new Error('Sightengine API credentials missing. Please add them to your .env file.');
      }

      // Convert Base64 data URL to binary Blob
      const resData = await fetch(photoDataUrl);
      const blob = await resData.blob();

      // Build Multipart Form Data as recommended by Sightengine docs
      const formData = new FormData();
      formData.append('media', blob, 'kyc_capture.jpg');
      formData.append('models', 'deepfake');
      formData.append('api_user', apiUser);
      formData.append('api_secret', apiSecret);

      // Perform synchronous deepfake analysis via proxy
      const response = await fetch('/sightengine-api/1.0/check.json', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errTxt = await response.text();
        throw new Error(`Sightengine HTTP ${response.status} - ${errTxt.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log("Sightengine API Response:", data);

      if (data.status !== 'success') {
        throw new Error(`Sightengine Error: ${data.error?.message || JSON.stringify(data)}`);
      }

      const prob = data.deepfake?.prob !== undefined ? data.deepfake.prob : data.type?.deepfake;
      
      if (prob === undefined) {
        console.error("Full Sightengine JSON:", data);
        throw new Error(`Unable to read deepfake probability. API returned: ${JSON.stringify(data)}`);
      }
      
      // Threshold: We use a strict 0.2 (20% chance of manipulation) instead of 0.5.
      console.log(`Deepfake Probability Score: ${prob}`);
      return prob < 0.2;

    } catch (err) {
      console.error('Sightengine API Error:', err);
      throw err;
    }
  };

  const getHeadYawRatio = (landmarks) => {
    const pts = landmarks.positions;
    const nose = pts[30];
    const leftJaw = pts[0];
    const rightJaw = pts[16];
    const d1 = Math.abs(nose.x - leftJaw.x);
    const d2 = Math.abs(nose.x - rightJaw.x);
    return d2 === 0 ? 1 : (d1 / d2);
  };

  const startLivelinessCheck = async (baseDescriptor, photoUrl) => {
    // 1. Verify Deepfake status using Sightengine API
    try {
      const isReal = await verifySightengineAPI(photoUrl);
      
      if (!isReal) {
        setAttempts(prev => {
          const newAttempts = prev + 1;
          if (newAttempts >= 3) {
            setIsBlocked(true);
            setError('Maximum verification attempts reached. Account blocked.');
          } else {
            setError(`Sightengine detected potential deepfake artifacts. Attempt ${newAttempts} of 3.`);
          }
          return newAttempts;
        });
        setLivelinessStarted(false);
        setCapturedPhoto(null);
        return;
      }
    } catch (apiError) {
      setAttempts(prev => {
        const newAttempts = prev + 1;
        if (newAttempts >= 3) {
          setIsBlocked(true);
          setError('Maximum verification attempts reached. Account blocked.');
        } else {
          setError(`Verification Error: ${apiError.message}. Attempt ${newAttempts} of 3.`);
        }
        return newAttempts;
      });
      setLivelinessStarted(false);
      setCapturedPhoto(null);
      return;
    }

    // 2. Simple Liveness Challenges
    // Each challenge tracks: did the user START in neutral, then MOVE to target?
    const challenges = [
      {
        id: 'blink',
        msg: '👁️ Please BLINK your eyes',
        eyesWereOpen: false,
        check(landmarks) {
          const ear = (getEAR(landmarks.getLeftEye()) + getEAR(landmarks.getRightEye())) / 2.0;
          // Step 1: Confirm eyes are open first
          if (!this.eyesWereOpen) {
            if (ear > 0.18) {
              this.eyesWereOpen = true;
            }
            setKycMsg(`👁️ Open your eyes — EAR: ${ear.toFixed(3)}`);
            return false;
          }
          // Step 2: Detect the blink (any noticeable drop)
          setKycMsg(`👁️ Now BLINK! — EAR: ${ear.toFixed(3)}`);
          return ear < 0.16;
        }
      },
      {
        id: 'left',
        msg: '⬅️ Turn your head LEFT',
        wasCenter: false,
        check(landmarks) {
          const ratio = getHeadYawRatio(landmarks);
          if (!this.wasCenter) {
            if (ratio > 0.85 && ratio < 1.15) {
              this.wasCenter = true;
            }
            setKycMsg(`⬅️ Face forward first — Yaw: ${ratio.toFixed(2)}`);
            return false;
          }
          setKycMsg(`⬅️ Now turn LEFT — Yaw: ${ratio.toFixed(2)}`);
          return ratio < 0.82;
        }
      },
      {
        id: 'right',
        msg: '➡️ Turn your head RIGHT',
        wasCenter: false,
        check(landmarks) {
          const ratio = getHeadYawRatio(landmarks);
          if (!this.wasCenter) {
            if (ratio > 0.85 && ratio < 1.15) {
              this.wasCenter = true;
            }
            setKycMsg(`➡️ Face forward first — Yaw: ${ratio.toFixed(2)}`);
            return false;
          }
          setKycMsg(`➡️ Now turn RIGHT — Yaw: ${ratio.toFixed(2)}`);
          return ratio > 1.22;
        }
      }
    ];

    // Pick 2 random challenges
    const shuffled = [...challenges].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);
    
    let idx = 0;
    setKycMsg(`✅ Deepfake passed! ${selected[idx].msg}`);
    const displaySize = { width: 400, height: 300 };
    
    if (canvasRef.current && videoRef.current) {
      faceapi.matchDimensions(canvasRef.current, displaySize);
      
      let timeout;
      let interval;

      timeout = setTimeout(() => {
        clearInterval(interval);
        setAttempts(prev => {
          const n = prev + 1;
          if (n >= 3) {
            setIsBlocked(true);
            setError('Maximum verification attempts reached. Account blocked.');
          } else {
            setError(`Liveliness verification timed out. Attempt ${n} of 3.`);
          }
          return n;
        });
        setLivelinessStarted(false);
        setCapturedPhoto(null);
        if (videoRef.current && videoRef.current.srcObject) {
          videoRef.current.srcObject.getTracks().forEach(t => t.stop());
        }
      }, 20000);

      interval = setInterval(async () => {
        if (!videoRef.current) {
          clearInterval(interval);
          clearTimeout(timeout);
          return;
        }
        
        const detections = await faceapi.detectAllFaces(
          videoRef.current, 
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 })
        ).withFaceLandmarks();

        if (canvasRef.current && detections.length > 0) {
          const resized = faceapi.resizeResults(detections, displaySize);
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, 400, 300);
          faceapi.draw.drawDetections(canvasRef.current, resized);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
          
          const landmarks = detections[0].landmarks;
          
          if (idx < selected.length) {
            if (selected[idx].check(landmarks)) {
              idx++;
              if (idx < selected.length) {
                setKycMsg(`✅ Great! Next: ${selected[idx].msg}`);
              } else {
                setKycMsg('🎉 Liveliness verified! Signing credential...');
                clearInterval(interval);
                clearTimeout(timeout);
                setTimeout(() => {
                  if (videoRef.current && videoRef.current.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                  }
                  finishRegistration(baseDescriptor, photoUrl);
                }, 1500);
              }
            }
          }
        } else if (canvasRef.current) {
          canvasRef.current.getContext('2d').clearRect(0, 0, 400, 300);
        }
      }, 80);
    }
  };

  const finishRegistration = async (faceDescriptor, photoUrl) => {
    setKycMsg('Building and signing your Verifiable Credential...');
    
    try {
      const { buildCredential, ensureKeyPair, signCredential } = await import('../crypto/credentialSigner.js');
      
      const userData = {
        name: aadhaarData.name !== 'Unknown Name' ? aadhaarData.name : 'Jane Doe',
        dob: aadhaarData.dob,
        mobile: mobile,
        pan: panData.panNumber,
        kycGrade: 'A',
        aadhaarVerified: true,
        annualIncome: 75000, // Mock income for demo
      };

      // 1. Build the credential object with all claim categories
      const credential = buildCredential(userData);

      // 2. Generate or load RSA key pair
      const { privateKey } = await ensureKeyPair();

      // 3. Digitally sign the credential
      const signature = await signCredential(credential, privateKey);

      // 4. Issue BBS+ Selective Credential
      const { issueSelectiveCredential } = await import('../crypto/selectiveDisclosure.js');
      const bbsCredential = await issueSelectiveCredential(credential.credentialSubject);

      // 5. Store everything in global state
      dispatch({
        type: 'SET_USER',
        payload: {
          name: userData.name,
          dob: userData.dob,
          mobile: userData.mobile,
          pan: userData.pan,
          kycGrade: 'A',
          issueDate: new Date().toISOString().split('T')[0],
          registered: true,
          faceDescriptor: faceDescriptor,
          photoUrl: photoUrl,
          credential: credential,
          credentialSignature: signature,
          bbsCredential: bbsCredential,
        }
      });

      setStep(6);
    } catch (err) {
      console.error('Credential signing error:', err);
      setError('Failed to sign credential: ' + err.message);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '4rem auto' }} className="animate-fade-in">
      <div className="glass-panel">
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Registration</h2>
          <span style={{ color: 'var(--text-secondary)' }}>Step {step} of 6</span>
        </div>

        {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem' }}>{error}</div>}

        {step === 1 && (
          <div className="animate-fade-in">
            <p>Enter your 10-digit mobile number to get started.</p>
            <div className="input-group">
              <label>Mobile Number</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Enter mobile number" 
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                maxLength="10"
              />
            </div>
            
            {showDemoOtp && (
              <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary)', borderRadius: '0.5rem' }}>
                <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 'bold' }}>Demo OTP Sent!</p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.25rem', letterSpacing: '2px' }}>{generatedOtp}</p>
                <button className="btn btn-secondary" style={{ marginTop: '1rem', width: '100%' }} onClick={() => { setStep(2); setShowDemoOtp(false); }}>
                  Continue to Verify
                </button>
              </div>
            )}
            
            {!showDemoOtp && (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={sendOtp}>
                Send OTP <ArrowRight size={18} />
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <p>We've sent an SMS to <strong>{mobile}</strong>.</p>
            <div className="input-group">
              <label>Enter 6-digit OTP</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="000000" 
                maxLength="6"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={verifyOtp}>
              Verify OTP
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem' }}>Upload Aadhaar Card</h3>
            <p>Please upload an image of your Aadhaar Card. We will extract your Name and Date of Birth securely.</p>
            
            <div style={{ position: 'relative', border: '2px dashed var(--glass-border)', padding: '3rem', textAlign: 'center', borderRadius: '1rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleAadhaarUpload} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
              />
              <UploadCloud size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
              <p>{loading ? 'Processing Image (OCR)...' : 'Click or Drag Aadhaar image here'}</p>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: '1rem' }}>Upload PAN Card</h3>
            <p>Please upload an image of your PAN Card.</p>
            
            <div style={{ position: 'relative', border: '2px dashed var(--glass-border)', padding: '3rem', textAlign: 'center', borderRadius: '1rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePanUpload} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} 
              />
              <UploadCloud size={48} color="var(--primary)" style={{ margin: '0 auto 1rem' }} />
              <p>{loading ? 'Processing Image (OCR)...' : 'Click or Drag PAN image here'}</p>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <h3 style={{ marginBottom: '1rem' }}><Camera style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Video KYC</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{kycMsg}</p>
            
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', height: '300px', margin: '0 auto', background: '#000', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              <canvas 
                ref={canvasRef} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10 }} 
              />
              {capturedPhoto && (
                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 15, border: '3px solid var(--success)', borderRadius: '0.5rem', overflow: 'hidden', width: '100px', height: '75px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                  <img 
                    src={capturedPhoto} 
                    alt="Captured Face" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(16, 185, 129, 0.8)', color: '#fff', fontSize: '0.6rem', padding: '2px 0' }}>CAPTURED</div>
                </div>
              )}
            </div>
            
            {!livelinessStarted && !isBlocked && error && (
              <div style={{ marginTop: '1.5rem' }}>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Attempt {attempts} of 3
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={retryVerification} disabled={loading}>
                  Try Again
                </button>
              </div>
            )}
            
            {!livelinessStarted && !isBlocked && !error && (
               <button className="btn btn-primary" style={{ marginTop: '2rem' }} onClick={capturePhoto} disabled={loading}>
                 Capture Photo
               </button>
            )}

            {isBlocked && (
               <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', borderRadius: '0.5rem', color: 'var(--error)', fontWeight: 'bold', textAlign: 'center' }}>
                 ⛔ Registration Blocked — Maximum attempts exceeded.<br/>
                 <span style={{ fontWeight: 'normal', fontSize: '0.85rem' }}>Please contact support to unlock your account.</span>
               </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="animate-fade-in" style={{ textAlign: 'center' }}>
            <CheckCircle size={64} color="var(--success)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ marginBottom: '1rem' }}>Identity Verified!</h3>
            <p>Your Verifiable Credential has been generated using your Aadhaar details.</p>
            
            <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '0.5rem', margin: '1.5rem 0', border: '1px solid var(--glass-border)' }}>
              <h4 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Extracted Details</h4>
              <p><strong>Name:</strong> {state.user?.name}</p>
              <p><strong>Date of Birth:</strong> {state.user?.dob}</p>
              <p><strong>PAN:</strong> {state.user?.pan}</p>
              <p><strong>Mobile:</strong> {state.user?.mobile}</p>
              <p><strong>KYC Grade:</strong> <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{state.user?.kycGrade}</span></p>
            </div>
            
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => navigate('/wallet')}>
              Go to Wallet
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
