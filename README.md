# TrustID

TrustID is an AI-powered financial identity verification system that helps users verify once and reuse their identity securely across platforms.

## What is this?

TrustID enables users to verify Aadhaar, PAN, and video KYC, then generate a reusable digital identity credential. The system focuses on privacy-preserving sharing, deepfake resistance, and reduced repeated KYC friction.

## Why we built this

Current KYC systems are repetitive, slow, and expose sensitive personal data multiple times. TrustID solves this by creating a portable, tamper-resistant identity credential that users can selectively share with banks, fintech platforms, and regulated institutions.

## Key Features

- Aadhaar and PAN OCR extraction
- Face detection and blink-based liveness check
- Deepfake detection API integration
- Digital identity credential generation
- SHA-256 hashing for sensitive data
- Privacy-preserving selective disclosure
- Consent-based identity sharing simulation

## Tech Stack

### Frontend
- React.js
- Vite
- WebRTC
- face-api.js
- Tesseract.js

### Backend
- Node.js
- Express.js
- Sightengine API

### Security
- SHA-256 hashing
- Environment variable-based API key handling
- Local prototype credential storage

## Repository Structure

```txt
teamNova/
├── trustid-frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/                 
│   │   ├── context/                
│   │   ├── crypto/                 
│   │   │   ├── credentialSigner.js
│   │   │   ├── selectiveDisclosure.js
│   │   │   └── zkpProver.js
│   │   ├── pages/                 
│   │   │   ├── LandingPage.jsx
│   │   │   ├── RegistrationFlow.jsx
│   │   │   ├── FaceLogin.jsx
│   │   │   └── WalletDashboard.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── App.css
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
│
├── server/                         
│   └── app.js
│
├── .env                            
├── README.md
└── package.json
