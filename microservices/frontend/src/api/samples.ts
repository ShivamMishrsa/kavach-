import type { SampleId } from './types';

/**
 * The demo samples, as plain messages. Against the real backend they are sent like anything a
 * person pastes, so the result comes from the real detection. They contain no real data.
 */
export const SAMPLE_TEXT: Record<SampleId, string> = {
  fake_notice:
    'NOTICE: You are under digital arrest. Stay on the video call and do not tell anyone. ' +
    'Transfer ₹50,000 immediately to the safe account. ' +
    'UPI: safe.verification@upi, UTR 400000000001. Call +91 90000 00000. Section 420 IPC.',
  courier_link:
    'Your parcel is on hold. Update your address within 2 hours: http://sbi-kyc-update.example/verify',
  medium_message: 'Please pay your pending bill immediately to avoid disconnection.',
  unclear_photo: '#### ~~ ?? .. ## ~',
  bank_alert:
    'Rs 1,200 debited from your account on 12/11/2026. ' +
    'If this was not you, contact your bank branch. Do not share your OTP with anyone.',
};
