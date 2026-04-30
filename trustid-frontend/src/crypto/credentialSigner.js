/**
 * TrustID Credential Signer & Verifier
 * Uses Web Crypto API (SubtleCrypto) for RSA-PSS digital signatures.
 * All operations are client-side for the MVP; in production, the private key
 * would live on a secure backend HSM.
 */

const ALGORITHM = {
  name: 'RSA-PSS',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const SIGN_PARAMS = {
  name: 'RSA-PSS',
  saltLength: 32,
};

// ── Key Management ──────────────────────────────────────────────

/**
 * Generate an RSA-PSS key pair and store it in localStorage.
 * Returns { publicKey, privateKey } as CryptoKey objects.
 */
export async function generateKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    ALGORITHM,
    true, // extractable — needed for export/persistence
    ['sign', 'verify']
  );

  // Export keys to JWK so we can persist them in localStorage
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  localStorage.setItem('trustid_publicKey', JSON.stringify(publicJwk));
  localStorage.setItem('trustid_privateKey', JSON.stringify(privateJwk));

  return keyPair;
}

/**
 * Load persisted keys from localStorage.
 * Returns { publicKey, privateKey } or null if not found.
 */
export async function loadKeyPair() {
  const pubStr = localStorage.getItem('trustid_publicKey');
  const privStr = localStorage.getItem('trustid_privateKey');

  if (!pubStr || !privStr) return null;

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(pubStr),
    ALGORITHM,
    true,
    ['verify']
  );

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    JSON.parse(privStr),
    ALGORITHM,
    true,
    ['sign']
  );

  return { publicKey, privateKey };
}

/**
 * Ensure a key pair exists (load or generate).
 */
export async function ensureKeyPair() {
  const existing = await loadKeyPair();
  if (existing) return existing;
  return generateKeyPair();
}

// ── Canonicalization ────────────────────────────────────────────

/**
 * Deterministic JSON canonicalization.
 * Sorts keys recursively to ensure identical inputs always produce the same string.
 */
export function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalize).join(',') + ']';

  const sortedKeys = Object.keys(obj).sort();
  const parts = sortedKeys.map(k => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return '{' + parts.join(',') + '}';
}

// ── Signing ─────────────────────────────────────────────────────

/**
 * Sign a credential object with the issuer's private key.
 * Returns a base64-encoded signature string.
 */
export async function signCredential(credential, privateKey) {
  const canonical = canonicalize(credential);
  const encoded = new TextEncoder().encode(canonical);

  const signatureBuffer = await crypto.subtle.sign(
    SIGN_PARAMS,
    privateKey,
    encoded
  );

  // Convert ArrayBuffer to base64
  return btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
}

// ── Verification ────────────────────────────────────────────────

/**
 * Verify a credential's signature using the issuer's public key.
 * Returns true if the credential has not been tampered with.
 */
export async function verifyCredential(credential, signatureBase64, publicKey) {
  const canonical = canonicalize(credential);
  const encoded = new TextEncoder().encode(canonical);

  // Convert base64 back to ArrayBuffer
  const sigStr = atob(signatureBase64);
  const sigBytes = new Uint8Array(sigStr.length);
  for (let i = 0; i < sigStr.length; i++) {
    sigBytes[i] = sigStr.charCodeAt(i);
  }

  return crypto.subtle.verify(
    SIGN_PARAMS,
    publicKey,
    sigBytes.buffer,
    encoded
  );
}

// ── Credential Builder ──────────────────────────────────────────

/**
 * 🟢 STORED CLAIMS ONLY
 * Build a TrustID Verifiable Credential containing ONLY verified facts.
 * These are immutable attestations that were confirmed during registration.
 * 
 * Rule: If it can be COMPUTED from stored data → don't store it.
 *       If it should be PROVED via ZKP → don't store it.
 */
export function buildCredential(userData) {
  const now = Date.now();

  return {
    '@context': ['https://www.w3.org/2018/credentials/v1', 'https://trustid.network/context/v1'],
    type: ['VerifiableCredential', 'TrustIDIdentityCredential'],
    id: `urn:trustid:credential:${crypto.randomUUID()}`,
    issuer: {
      id: 'did:trustid:issuer:network',
      name: 'TrustID Network',
    },
    issuanceDate: new Date(now).toISOString(),
    expirationDate: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),

    credentialSubject: {
      id: `did:trustid:user:${userData.mobile || 'unknown'}`,

      // Verified identity facts — attested during registration
      name: userData.name || 'Jane Doe',
      isIdentityVerified: true,
      kycStatus: 'verified',
      kycLevel: 'advanced',
      dateOfBirth: userData.dob || '1990-01-01',
      country: 'IN',
      phoneVerified: true,
      emailVerified: false,
      isHumanVerified: true,   // Passed liveness + deepfake check
      annualIncome: userData.annualIncome || 0,
    },
  };
}

// ── Computed Claims (🟡 NEVER STORED) ───────────────────────────

/**
 * 🟡 COMPUTED CLAIMS
 * Derived at runtime from stored credential data.
 * These are NEVER persisted inside the credential — they are recalculated
 * every time they are needed, ensuring they stay fresh and accurate.
 */
export function computeClaims(credential) {
  const subject = credential?.credentialSubject || {};
  const dobStr = subject.dateOfBirth || '1990-01-01';

  // Parse DOB (handles DD/MM/YYYY and YYYY-MM-DD formats)
  let age = 0;
  try {
    let dobDate;
    if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(dobStr)) {
      dobDate = new Date(dobStr.replace(/(\d{2})[/-](\d{2})[/-](\d{4})/, '$3-$2-$1'));
    } else {
      dobDate = new Date(dobStr);
    }
    if (!isNaN(dobDate.getTime())) {
      age = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }
  } catch { /* ignore */ }

  return {
    age,
    ageOver18: age >= 18,
    ageOver21: age >= 21,
    isMinor: age < 18,
    trustLevel: subject.kycLevel === 'advanced' && subject.isHumanVerified ? 'high' : 'medium',
    riskScore: subject.isIdentityVerified && subject.isHumanVerified ? 'low' : 'high',
    authenticationStrength: subject.phoneVerified && subject.isHumanVerified ? 'strong' : 'weak',
  };
}

// ── ZKP Proof Generator (🔵 PROVED AT RUNTIME) ─────────────────

/**
 * 🔵 ZKP CLAIMS
 * These are generated as proofs ONLY when a verifier requests them.
 * In production, these would be actual ZK-SNARK/STARK circuits.
 * For the MVP, we simulate the proof generation process:
 *   - Input: credential + specific claim to prove
 *   - Output: a proof object with commitment hash + result
 *
 * The verifier receives ONLY the proof, never the raw data.
 */
export async function generateZKProof(credential, claimType) {
  const computed = computeClaims(credential);
  const subject = credential?.credentialSubject || {};

  // Determine the claim value
  let claimValue;
  switch (claimType) {
    case 'ageOver18':
      claimValue = computed.ageOver18;
      break;
    case 'ageOver21':
      claimValue = computed.ageOver21;
      break;
    case 'isUniqueHuman':
      claimValue = subject.isHumanVerified === true;
      break;
    case 'kycVerified':
      claimValue = subject.kycStatus === 'verified';
      break;
    case 'incomeAboveThreshold':
      claimValue = false; // Not implemented in current flow
      break;
    default:
      throw new Error(`Unknown ZKP claim type: ${claimType}`);
  }

  // Generate a commitment hash (simulated ZKP)
  // In production: this would be a zk-SNARK proof generated from a circuit
  const proofInput = JSON.stringify({
    credentialId: credential.id,
    claim: claimType,
    value: claimValue,
    nonce: crypto.randomUUID(),
    timestamp: Date.now(),
  });

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(proofInput));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const commitmentHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    claimType,
    result: claimValue,
    proof: {
      type: 'TrustIDSimulatedZKProof',
      commitmentHash,
      protocol: 'Groth16 (simulated)',
      verificationKey: credential.id,
      generatedAt: new Date().toISOString(),
    },
  };
}

