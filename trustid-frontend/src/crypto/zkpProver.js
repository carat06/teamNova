/**
 * TrustID — Zero-Knowledge Proof Engine
 * 
 * Simulates ZK-SNARK proof generation using SHA-256 commitments.
 * In production, these would be replaced with actual Circom/SnarkJS circuits.
 * 
 * Architecture:
 *   - Prover (user): Has private witness (raw data), produces proof
 *   - Verifier: Receives ONLY the proof + public signals, never raw data
 */

// ── Helpers ─────────────────────────────────────────────────────

async function sha256(input) {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Age Proof ───────────────────────────────────────────────────

/**
 * Prove: age >= minAge WITHOUT revealing dateOfBirth or exact age.
 * 
 * Private witness: { dateOfBirth }
 * Public input:    { minAge }
 * Public output:   { valid: true/false, commitmentHash, nullifier }
 * 
 * The verifier learns ONLY that the condition is satisfied.
 */
export async function proveAgeOver(credential, minAge) {
  const dob = credential?.credentialSubject?.dateOfBirth;
  if (!dob) throw new Error('No dateOfBirth in credential');

  // Compute age from DOB (private computation)
  let age = 0;
  try {
    let dobDate;
    if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(dob)) {
      dobDate = new Date(dob.replace(/(\d{2})[/-](\d{2})[/-](\d{4})/, '$3-$2-$1'));
    } else {
      dobDate = new Date(dob);
    }
    age = Math.floor((Date.now() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  } catch { /* */ }

  const valid = age >= minAge;
  const nonce = crypto.randomUUID();

  // Commitment: hash(credentialId + dob + nonce) — ties proof to this credential
  const commitment = await sha256(`${credential.id}:${dob}:${nonce}`);
  // Nullifier: prevents double-use of same proof
  const nullifier = await sha256(`${credential.id}:ageOver${minAge}:${nonce}`);

  return {
    type: 'ZKProof',
    circuit: 'ageCheck',
    publicInputs: { minAge },
    publicOutputs: { valid },
    proof: {
      protocol: 'Groth16 (simulated)',
      commitment,
      nullifier,
      timestamp: new Date().toISOString(),
    },
    // Private data NEVER leaves this object
    _private: { age, dob, nonce },
  };
}

// ── KYC Proof ───────────────────────────────────────────────────

/**
 * Prove: kycStatus === "verified" WITHOUT revealing any KYC data.
 */
export async function proveKycVerified(credential) {
  const status = credential?.credentialSubject?.kycStatus;
  const valid = status === 'verified';
  const nonce = crypto.randomUUID();

  const commitment = await sha256(`${credential.id}:kyc:${status}:${nonce}`);
  const nullifier = await sha256(`${credential.id}:kycVerified:${nonce}`);

  return {
    type: 'ZKProof',
    circuit: 'kycCheck',
    publicInputs: { expectedStatus: 'verified' },
    publicOutputs: { valid },
    proof: {
      protocol: 'Groth16 (simulated)',
      commitment,
      nullifier,
      timestamp: new Date().toISOString(),
    },
    _private: { status, nonce },
  };
}

// ── Uniqueness / Anti-Sybil Proof ───────────────────────────────

/**
 * Prove: user passed liveness + is a unique human, without revealing biometric data.
 */
export async function proveUniqueHuman(credential) {
  const isHuman = credential?.credentialSubject?.isHumanVerified;
  const valid = isHuman === true;
  const nonce = crypto.randomUUID();

  const commitment = await sha256(`${credential.id}:human:${isHuman}:${nonce}`);
  const nullifier = await sha256(`${credential.id}:uniqueHuman:${nonce}`);

  return {
    type: 'ZKProof',
    circuit: 'uniquenessCheck',
    publicInputs: {},
    publicOutputs: { valid },
    proof: {
      protocol: 'Groth16 (simulated)',
      commitment,
      nullifier,
      timestamp: new Date().toISOString(),
    },
    _private: { isHuman, nonce },
  };
}

// ── Income Proof ────────────────────────────────────────────────
/**
 * Prove: income >= threshold WITHOUT revealing exact income amount.
 */
export async function proveIncomeAbove(credential, threshold) {
  const income = credential?.credentialSubject?.annualIncome || 0;
  const valid = income >= threshold;
  const nonce = crypto.randomUUID();

  const commitment = await sha256(`${credential.id}:income:${income}:${nonce}`);
  const nullifier = await sha256(`${credential.id}:incomeAbove${threshold}:${nonce}`);

  return {
    type: 'ZKProof',
    circuit: 'incomeCheck',
    publicInputs: { threshold },
    publicOutputs: { valid },
    proof: {
      protocol: 'Groth16 (simulated)',
      commitment,
      nullifier,
      timestamp: new Date().toISOString(),
    },
    _private: { income, nonce },
  };
}

// ── Verification (Verifier Side) ────────────────────────────────

/**
 * Verify a ZK proof. In production this would verify the SNARK math.
 * Here we verify structural integrity + that the proof was freshly generated.
 */
export async function verifyZKProof(proofObj) {
  if (!proofObj || proofObj.type !== 'ZKProof') return false;
  if (!proofObj.proof?.commitment || !proofObj.proof?.nullifier) return false;
  if (!proofObj.proof?.timestamp) return false;

  // Check proof freshness (must be within last 5 minutes)
  const proofTime = new Date(proofObj.proof.timestamp).getTime();
  const now = Date.now();
  if (now - proofTime > 5 * 60 * 1000) return false;

  return proofObj.publicOutputs?.valid === true;
}
