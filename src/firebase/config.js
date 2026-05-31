export const firebaseConfig = {
  apiKey: "AIzaSyBgXYDJ0pVzTv1BwTiO21JYr3OVqNEHGrk",
  authDomain: "monthly-expense-tracker-18959.firebaseapp.com",
  projectId: "monthly-expense-tracker-18959",
  storageBucket: "monthly-expense-tracker-18959.firebasestorage.app",
  messagingSenderId: "242437385267",
  appId: "1:242437385267:web:ee951fc32eb80b9fb18746"
};

export const firebaseCdnVersion = "10.12.0";

export function firebaseCdnUrl(packageName) {
  return `https://www.gstatic.com/firebasejs/${firebaseCdnVersion}/${packageName}.js`;
}
