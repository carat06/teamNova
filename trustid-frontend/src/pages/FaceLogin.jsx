import React, { useRef, useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import * as faceapi from 'face-api.js';
import { AppContext } from '../context/AppContext';
import { Camera, AlertTriangle } from 'lucide-react';

export default function FaceLogin() {
  const videoRef = useRef();
  const canvasRef = useRef();
  const { state, dispatch } = useContext(AppContext);
  const navigate = useNavigate();
  
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Loading face detection models...');
  const [error, setError] = useState('');

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        startVideo();
      } catch (err) {
        console.error('Failed to load models', err);
        setError('Failed to load face detection models.');
      }
    };
    loadModels();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startVideo = () => {
    setLoadingMsg('Starting camera...');
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError("Camera access denied."));
  };

  const handleVideoPlay = () => {
    setLoadingMsg('Scanning face... Please look directly at the camera.');
    const displaySize = { width: 400, height: 300 };
    
    if (canvasRef.current && videoRef.current) {
      faceapi.matchDimensions(canvasRef.current, displaySize);
      
      const interval = setInterval(async () => {
        if (!videoRef.current) {
          clearInterval(interval);
          return;
        }
        
        const detections = await faceapi.detectAllFaces(
          videoRef.current, 
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.2 })
        ).withFaceLandmarks().withFaceDescriptors();

        if (canvasRef.current && detections.length > 0) {
          const resized = faceapi.resizeResults(detections, displaySize);
          const ctx = canvasRef.current.getContext('2d');
          ctx.clearRect(0, 0, 400, 300);
          faceapi.draw.drawDetections(canvasRef.current, resized);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resized);
          
          if (detections[0].detection.score > 0.8) {
            const descriptor = Array.from(detections[0].descriptor);
            
            try {
              const res = await fetch('http://localhost:8080/api/auth/search-face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ descriptor })
              });

              if (res.ok) {
                const data = await res.json();
                clearInterval(interval);
                handleSuccess(data);
              } else {
                setLoadingMsg('Face detected. Matching identity...');
              }
            } catch (e) {
              console.error('Match error:', e);
            }
          }
        }
      }, 500);
    }
  };

  const handleSuccess = (data) => {
    setLoadingMsg(`Welcome back, ${data.user.name}! Identity verified.`);
    
    // Parse JSON strings from backend if necessary
    if (typeof data.user.credential === 'string') {
      data.user.credential = JSON.parse(data.user.credential);
    }
    if (typeof data.user.bbsCredential === 'string') {
      data.user.bbsCredential = JSON.parse(data.user.bbsCredential);
    }

    setTimeout(() => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
      dispatch({ type: 'SET_USER', payload: data });
      navigate('/wallet');
    }, 1500);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }} className="animate-fade-in">
      <div className="glass-panel">
        <h2><Camera style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} /> Face Login</h2>
        
        {error ? (
          <div style={{ color: 'var(--error)', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '0.5rem', marginBottom: '1rem' }}>
            <AlertTriangle size={24} style={{ marginBottom: '0.5rem' }} />
            <p>{error}</p>
          </div>
        ) : (
          <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{loadingMsg}</p>
        )}

        <div style={{ position: 'relative', width: '400px', height: '300px', margin: '0 auto', background: '#000', borderRadius: '1rem', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
          <video ref={videoRef} autoPlay muted onPlay={handleVideoPlay}
            style={{ position: 'absolute', top: 0, left: 0, width: '400px', height: '300px', objectFit: 'cover' }} 
          />
          <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '400px', height: '300px' }} />
        </div>
        
        <div style={{ marginTop: '2rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
