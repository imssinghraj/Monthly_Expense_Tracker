/**
 * Firebase Service
 * Handles Firebase initialization and Firestore operations
 */

import { FIREBASE_CONFIG } from '../config/constants.js';

class FirebaseService {
  constructor() {
    this.db = null;
    this.uid = null;
    this.initialized = false;
  }

  /**
   * Initialize Firebase
   */
  async init() {
    if (this.initialized) return;

    try {
      const { initializeApp, getApps } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
      );
      const { getFirestore } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
      );
      const { getAuth, onAuthStateChanged } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
      );

      const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
      this.db = getFirestore(app);
      const auth = getAuth(app);

      // Get current user
      await new Promise(resolve => {
        const unsub = onAuthStateChanged(auth, user => {
          if (user) {
            this.uid = user.uid;
          }
          unsub();
          resolve();
        });
      });

      this.initialized = true;
    } catch (e) {
      console.warn('Firebase initialization failed:', e);
    }
  }

  /**
   * Load data from Firestore
   */
  async loadFromFirestore() {
    if (!this.db || !this.uid) return null;

    try {
      const { doc, getDoc } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
      );
      
      const snap = await getDoc(doc(this.db, 'users', this.uid));
      
      if (snap.exists()) {
        return snap.data();
      }
      
      return null;
    } catch (e) {
      console.warn('Firestore load failed:', e);
      return null;
    }
  }

  /**
   * Save data to Firestore
   */
  async saveToFirestore(data) {
    if (!this.db || !this.uid) return;

    try {
      const { doc, setDoc } = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
      );
      
      await setDoc(doc(this.db, 'users', this.uid), data);
    } catch (e) {
      console.warn('Firestore save failed:', e);
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.uid !== null;
  }
}

// Export singleton instance
export const firebaseService = new FirebaseService();
