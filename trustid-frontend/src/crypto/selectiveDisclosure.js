/**
 * TrustID — BBS+ Selective Disclosure Engine
 * 
 * Simulates BBS+ signatures for selective credential disclosure.
 * In production, use @mattrglobal/bbs-signatures with real BLS12-381 curves.
 * 
 * Architecture:
 *   - Issuer signs ALL attributes together → single signature
 *   - Holder creates a PROOF revealing only selected attributes
 *   - Verifier sees only revealed attributes + valid proof
 *   - Hidden attributes are cryptographically undisclosed
 */

// ── Helpers ─────────────────────────────────────────────────────

async function sha256(input) {
  const encoded = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Credential Attribute Definitions ────────────────────────────

/**
 * The ordered list of attributes that are signed in a BBS+ credential.
 * Order matters — indices are used for selective disclosure.
 */
export const ATTRIBUTE_SCHEMA = [
  { index: 0, key: 'kycStatus',       label: 'KYC Status' },
  { index: 1, key: 'kycLevel',        label: 'KYC Level' },
  { index: 2, key: 'country',         label: 'Country' },
  { index: 3, key: 'phoneVerified',   label: 'Phone Verified' },
  { index: 4, key: 'emailVerified',   label: 'Email Verified' },
  { index: 5, key: 'isHumanVerified', label: 'Human Verified' },
  { index: 6, key: 'dateOfBirth',     label: 'Date of Birth' },
  { index: 7, key: 'isIdentityVerified', label: 'Identity Verified' },
  { index: 8, key: 'annualIncome',    label: 'Annual Income' },
  { index: 9, key: 'name',            label: 'Full Name' },
];

// ── Issuer: Sign All Attributes ─────────────────────────────────

/**
 * Issue a BBS+ signed credential from the raw credentialSubject.
 * All attributes are signed together as a single commitment.
 * Returns { messages, signature, issuerPublicKey }.
 */
export async function issueSelectiveCredential(credentialSubject) {
  const messages = ATTRIBUTE_SCHEMA.map(attr => {
    const val = credentialSubject[attr.key];
    return String(val ?? 'null');
  });

  // Simulate BBS+ signing: hash(all messages concatenated + secret)
  const issuerSecret = crypto.randomUUID(); // In production: BLS12-381 secret key
  const messageConcat = messages.join('|');
  const signature = await sha256(`BBS+:${issuerSecret}:${messageConcat}`);
  const issuerPublicKey = await sha256(`PK:${issuerSecret}`);

  return {
    messages,
    signature,
    issuerPublicKey,
    _issuerSecret: issuerSecret, // NEVER shared in production
  };
}

// ── Holder: Create Selective Disclosure Proof ────────────────────

/**
 * Create a proof that reveals only the attributes at the given indices.
 * Hidden attributes are replaced with commitments (hashes).
 * 
 * @param {Object} bbsCredential - The full signed credential { messages, signature, issuerPublicKey }
 * @param {number[]} revealedIndices - Indices of attributes to reveal (e.g., [0, 2] = kycStatus + country)
 * @returns {Object} A selective disclosure proof
 */
export async function createSelectiveProof(bbsCredential, revealedIndices) {
  const { messages, signature, issuerPublicKey } = bbsCredential;
  const nonce = crypto.randomUUID();

  // Build the disclosed view
  const disclosed = {};
  const commitments = {};

  for (let i = 0; i < ATTRIBUTE_SCHEMA.length; i++) {
    const attr = ATTRIBUTE_SCHEMA[i];
    if (revealedIndices.includes(i)) {
      // Revealed: show plaintext
      disclosed[attr.key] = messages[i];
    } else {
      // Hidden: show only a blinded commitment
      commitments[attr.key] = await sha256(`BLIND:${nonce}:${messages[i]}:${i}`);
    }
  }

  // Derive proof from signature + nonce (simulated BBS+ proof of knowledge)
  const proofHash = await sha256(`PROOF:${signature}:${nonce}:${revealedIndices.join(',')}`);

  return {
    type: 'BBSSelectiveDisclosure',
    revealedAttributes: disclosed,
    hiddenCommitments: commitments,
    revealedIndices,
    proof: {
      proofHash,
      nonce,
      issuerPublicKey,
      timestamp: new Date().toISOString(),
    },
  };
}

// ── Verifier: Validate Selective Disclosure Proof ────────────────

/**
 * Verify a selective disclosure proof.
 * The verifier sees ONLY the revealed attributes + proof integrity.
 */
export async function verifySelectiveProof(proofObj) {
  if (!proofObj || proofObj.type !== 'BBSSelectiveDisclosure') return false;
  if (!proofObj.proof?.proofHash || !proofObj.proof?.nonce) return false;
  if (!proofObj.proof?.timestamp) return false;

  // Check proof freshness (within last 5 minutes)
  const proofTime = new Date(proofObj.proof.timestamp).getTime();
  if (Date.now() - proofTime > 5 * 60 * 1000) return false;

  // Verify structural integrity
  const revealedCount = Object.keys(proofObj.revealedAttributes || {}).length;
  const hiddenCount = Object.keys(proofObj.hiddenCommitments || {}).length;
  if (revealedCount + hiddenCount !== ATTRIBUTE_SCHEMA.length) return false;

  return true;
}
