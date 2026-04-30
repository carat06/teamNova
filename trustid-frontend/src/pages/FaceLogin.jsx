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
        setError('Failed to load face detection models. Are they in the public/models directory?');
      }
    };
    
    loadModels();

    return () => {
      // Cleanup video stream on unmount
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);

  const startVideo = () => {
    setLoadingMsg('Starting camera...');
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Camera error:", err);
        setError("Camera access denied or unavailable.");
      });
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
          new faceapi.TinyFaceDetectorOptions()
        ).withFaceLandmarks().withFaceDescriptors();

        if (canvasRef.current && detections.length > 0) {
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          canvasRef.current.getContext('2d').clearRect(0, 0, 400, 300);
          faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedDetections);
          
          // Compare with registered face descriptor if available
          if (detections[0].detection.score > 0.85) {
            const currentDescriptor = detections[0].descriptor;
            
            if (state.user && state.user.faceDescriptor) {
              const storedDescriptor = new Float32Array(state.user.faceDescriptor);
              const distance = faceapi.euclideanDistance(storedDescriptor, currentDescriptor);
              
              if (distance < 0.6) {
                clearInterval(interval);
                setLoadingMsg('Face match successful! Logging in...');
                setTimeout(() => {
                  if (videoRef.current && videoRef.current.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach(t => t.stop());
                  }
                  dispatch({ type: 'SET_USER', payload: { ...state.user, isAuthenticated: true } });
                  navigate('/wallet');
                }, 1500);
              } else {
                setLoadingMsg('Face does not match registered profile.');
              }
            } else {
              clearInterval(interval);
              setError('No registered face found. Please register first.');
            }
          }
        }
      }, 500);
    }
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
          <video 
            ref={videoRef} 
            autoPlay 
            muted 
            onPlay={handleVideoPlay}
            style={{ position: 'absolute', top: 0, left: 0, width: '400px', height: '300px', objectFit: 'cover' }} 
          />
          <canvas 
            ref={canvasRef} 
            style={{ position: 'absolute', top: 0, left: 0, width: '400px', height: '300px' }} 
          />
        </div>
        
        <div style={{ marginTop: '2rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
