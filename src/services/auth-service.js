import { getFirebaseApp } from "../firebase/app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export function getAuthClient() {
  return getAuth(getFirebaseApp());
}

export function watchAuthState(callback) {
  return onAuthStateChanged(getAuthClient(), callback);
}

export async function registerWithEmail({ email, password, name }) {
  const credential = await createUserWithEmailAndPassword(getAuthClient(), email, password);
  if (name) await updateProfile(credential.user, { displayName: name });
  return credential;
}

export function loginWithEmail({ email, password }) {
  return signInWithEmailAndPassword(getAuthClient(), email, password);
}

export function loginWithProvider(providerName) {
  const provider = providerName === "google" ? new GoogleAuthProvider() : new GithubAuthProvider();
  return signInWithPopup(getAuthClient(), provider);
}

export function resetPassword(email) {
  return sendPasswordResetEmail(getAuthClient(), email);
}

export function logout() {
  return signOut(getAuthClient());
}

export function toSessionUser(user) {
  if (!user) return null;
  return {
    email: user.email,
    name: user.displayName || user.email.split("@")[0],
    loggedIn: true,
    uid: user.uid
  };
}
