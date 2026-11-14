import type { RiskLevel } from '@/components/ui/risk';

/**
 * API contract between the website and the backend (Step 4 implements the real one).
 * The mock in ./mock follows exactly these shapes, so switching to the real API
 * should not change any screen.
 */

export type ScanKind = 'notice' | 'link' | 'voice';
export type StageId = 'received' | 'read' | 'signals' | 'report';
export type StageStatus = 'done' | 'current' | 'waiting';
export type ScanStatus = 'processing' | 'done' | 'failed';

export type ReasonCode =
  | 'digital_arrest'
  | 'payment_demand'
  | 'safe_account'
  | 'secrecy'
  | 'urgency'
  | 'outdated_section'
  | 'lookalike_domain'
  | 'insecure_link';

export type EntityType = 'utr' | 'upi' | 'phone' | 'amount' | 'datetime' | 'link';

export interface Entity {
  type: EntityType;
  value: string;
}

/** Hash of the original evidence, computed before the file is deleted. */
export interface EvidenceHash {
  name: string;
  sha256: string;
  capturedAt: string; // ISO 8601, UTC
}

export interface StageProgress {
  id: StageId;
  status: StageStatus;
}

/** An old law section named in the notice, and the section that replaced it on 1 July 2024. */
export interface Statute {
  cited: string;
  current: string;
}

export interface ScanResult {
  riskLevel: RiskLevel;
  reasonCodes: ReasonCode[];
  entities: Entity[];
  statutes: Statute[];
}

export interface Scan {
  id: string;
  kind: ScanKind;
  status: ScanStatus;
  stages: StageProgress[];
  result: ScanResult | null;
  /** Details the user checked and corrected; null until they confirm. */
  confirmedEntities: Entity[] | null;
  evidence: EvidenceHash[];
  createdAt: string;
  /** Files and details are deleted at this time (15 minutes after creation). */
  expiresAt: string;
  /** True while the result is produced by the mock, not by real detection. */
  simulated: boolean;
}

/** What stays after the 15 minutes: only metadata, never the file or the details. */
export interface ScanSummary {
  id: string;
  kind: ScanKind;
  riskLevel: RiskLevel | null;
  createdAt: string;
}

export type SampleId =
  'fake_notice' | 'courier_link' | 'medium_message' | 'unclear_photo' | 'bank_alert';

export type ScanInput =
  | { kind: 'notice'; file?: File; text?: string; sampleId?: SampleId }
  | { kind: 'link'; url: string };

export type FeedbackType = 'false_alarm' | 'missed_scam' | 'wrong_wording' | 'other';

export interface FeedbackInput {
  scanId: string;
  type: FeedbackType;
  note?: string;
}

/** The words of the evidence summary PDF. The backend lays them out; the details and the
 * fingerprints in it come from the backend's own record of the scan. */
export interface DossierText {
  title: string;
  disclaimer: string;
  summaryTitle: string;
  summary: string;
  detailsTitle: string;
  detailLabels: Record<EntityType, string>;
  evidenceTitle: string;
  evidenceHint: string;
  /** Contains "{time}", which the backend replaces with the time it recorded. */
  capturedAt: string;
  keepOriginals: string;
  scriptTitle: string;
  script: string;
}

export interface DossierFile {
  /** Short-lived signed link to the PDF. */
  url: string;
  /** SHA-256 of the PDF exactly as it downloads. */
  sha256: string;
  generatedAt: string;
}

export type ApiErrorCode =
  | 'not_found'
  | 'expired'
  | 'invalid_input'
  | 'rate_limited'
  | 'unauthorized'
  | 'forbidden'
  | 'busy'
  | 'network';

/** The signed-in person, as the server knows them. */
export interface Account {
  id: string;
  email: string;
  /** The language they chose, or null before they chose one. */
  language: string | null;
  /** True when the type, risk level and time of each check are also kept in the account. */
  syncHistory: boolean;
}

/** One place the account is signed in. The id is not a secret. */
export interface SignIn {
  id: string;
  createdAt: string;
  expiresAt: string;
  /** True for the browser that is asking. */
  current: boolean;
}

export type AccountPatch = Partial<Pick<Account, 'language' | 'syncHistory'>>;

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export interface ApiClient {
  createScan(input: ScanInput): Promise<Scan>;
  getScan(id: string): Promise<Scan>;
  confirmEntities(id: string, entities: Entity[]): Promise<Scan>;
  listHistory(): Promise<ScanSummary[]>;
  deleteScan(id: string): Promise<void>;
  deleteAllScans(): Promise<void>;
  sendFeedback(input: FeedbackInput): Promise<void>;
  /** Makes the evidence summary PDF from the confirmed details. Not available in the demo. */
  createDossier(id: string, text: DossierText): Promise<DossierFile>;
  /** Tells the backend which consent text was agreed to or withdrawn. */
  recordConsent(version: string, granted: boolean): Promise<void>;

  /** Emails a one-time sign-in link. The answer is the same whether or not the address has an account. */
  requestSignInLink(email: string, language: string): Promise<void>;
  /** Uses the secret from the link. Rejects with `unauthorized` when it is wrong, used or expired. */
  verifySignIn(token: string): Promise<Account>;
  /** The account behind the session cookie, or null when nobody is signed in. */
  getAccount(): Promise<Account | null>;
  updateAccount(patch: AccountPatch): Promise<Account>;
  signOut(everywhere: boolean): Promise<void>;
  /** Sends a confirmation link to the NEW address; the address changes when it is opened. */
  requestEmailChange(email: string, language: string): Promise<void>;
  confirmEmailChange(token: string): Promise<Account>;
  listSignIns(): Promise<SignIn[]>;
  endSignIn(id: string): Promise<void>;
  /** Everything the server holds about the account, as a file. */
  exportAccount(): Promise<Blob>;
  deleteAccount(): Promise<void>;
  /** Puts the checks remembered on this device into the account (only after sync is on). */
  uploadHistory(): Promise<void>;
}
