/* ========== APP CONFIG SERVICE ========== */
/* Reads from the app_config collection. Used today for the settings_password
 * gate that protects sensitive operations (e.g. inventory adjustments).
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Compare a user-typed value against the settings password stored at
 * app_config/settings_password.password.
 *
 * Returns:
 *   { success: true, ok: true }   — password matched
 *   { success: true, ok: false }  — password did not match
 *   { success: false, error }     — could not check (network / missing config)
 */
export const verifySettingsPassword = async (input) => {
  try {
    const ref = doc(db, 'app_config', 'settings_password');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return {
        success: false,
        error: 'Settings password is not configured. Contact an administrator.'
      };
    }
    const stored = snap.data().password;
    if (typeof stored !== 'string' || stored.length === 0) {
      return {
        success: false,
        error: 'Settings password is empty in Firestore. Contact an administrator.'
      };
    }
    const ok = String(input || '') === stored;
    return { success: true, ok };
  } catch (error) {
    console.error('Error verifying settings password:', error);
    return { success: false, error: error.message };
  }
};

export default { verifySettingsPassword };
