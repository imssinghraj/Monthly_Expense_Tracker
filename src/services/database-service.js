import { getFirebaseApp } from "../firebase/app.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const TRACKER_COLLECTION = "expenseTrackers";

export function getDbClient() {
  return getFirestore(getFirebaseApp());
}

export async function loadTrackerData(uid) {
  if (!uid) return null;
  const snapshot = await getDoc(doc(getDbClient(), TRACKER_COLLECTION, uid));
  return snapshot.exists() ? snapshot.data() : null;
}

export function saveTrackerData(uid, data) {
  if (!uid) return Promise.resolve();
  return setDoc(
    doc(getDbClient(), TRACKER_COLLECTION, uid),
    {
      ...data,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export function createTenantContext(user, organizationId = "personal") {
  return {
    uid: user?.uid || null,
    role: user?.role || "owner",
    organizationId
  };
}
