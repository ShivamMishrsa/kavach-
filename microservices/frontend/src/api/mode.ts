/** Which kind of site this build is. Kept apart from the client so any screen can ask cheaply. */
export const apiUrl = import.meta.env.VITE_API_URL as string | undefined;

/** True when no backend is set: the in-browser demo, whose results are simulated. */
export const isMockApi = !apiUrl;

/**
 * False when the site is built with VITE_SIGN_IN=off (a guest-only demo whose server sends no
 * email): the log in and sign up options are then not shown. The in-browser demo always has them.
 */
export const signInAvailable = isMockApi || import.meta.env.VITE_SIGN_IN !== 'off';
