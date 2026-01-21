// src/firebase/chatApi.js
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteField,
  increment,
} from "firebase/firestore";

import { db } from "./firebase";

// add these imports at the top with your others
import { updateProfile, updatePassword } from "firebase/auth";

// and import auth from your firebase file
import { auth } from "./firebase";


// Stable chat id: same for both users
export const makeChatId = (uidA, uidB) => [uidA, uidB].sort().join("_");

// Create/Update user profile document
export async function createUserDoc({ uid, email, displayName }) {
  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    displayName,
    photoURL: null,
    createdAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
  });
}

// Fetch all users (for starting new chats)
export async function fetchAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => d.data());
}

// Ensure a chat exists (merge-safe)
export async function ensureChat(me, other) {
  const chatId = makeChatId(me.uid, other.uid);
  const ref = doc(db, "chats", chatId);

  await setDoc(
    ref,
    {
      members: [me.uid, other.uid],
      memberNames: [me.displayName, other.displayName],
      memberEmails: [me.email, other.email],
      lastMessage: "",
      updatedAt: serverTimestamp(),
      unread: { [me.uid]: 0, [other.uid]: 0 },
    },
    { merge: true }
  );

  return chatId;
}

// Listen my chats (ordered query first; fallback if index missing)
export function listenMyChats(uid, cb) {
  const q1 = query(
    collection(db, "chats"),
    where("members", "array-contains", uid),
    orderBy("updatedAt", "desc"),
    limit(50)
  );

  const unsub1 = onSnapshot(
    q1,
    (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cb(data);
    },
    (err) => {
      console.error("listenMyChats ordered query failed:", err);

      const q2 = query(
        collection(db, "chats"),
        where("members", "array-contains", uid),
        limit(50)
      );

      const unsub2 = onSnapshot(
        q2,
        (snap) => {
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          cb(data);
        },
        (err2) => console.error("listenMyChats fallback failed:", err2)
      );

      return () => unsub2();
    }
  );

  return () => unsub1();
}

// Listen a single chat doc (for header name, typing, unread)
export function listenChat(chatId, cb) {
  return onSnapshot(doc(db, "chats", chatId), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

// Listen messages inside a chat (realtime)
export function listenMessages(chatId, cb) {
  const q = query(
    collection(db, "chats", chatId, "messages"),
    orderBy("createdAt", "asc"),
    limit(300)
  );

  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

// Send text message (updates lastMessage + updatedAt)
export async function sendMessage({ chatId, senderId, text }) {
  await addDoc(collection(db, "chats", chatId, "messages"), {
    senderId,
    text,
    type: "text",
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: text,
    lastMessageSenderId: senderId,
    lastMessageAt: serverTimestamp(),   // ✅ add this
    updatedAt: serverTimestamp(),
  });


}

/* ------------------------
   Typing indicator
------------------------ */
export async function setTyping(chatId, uid, isTyping) {
  const ref = doc(db, "chats", chatId);

  if (isTyping) {
    await updateDoc(ref, { [`typing.${uid}`]: serverTimestamp() });
  } else {
    await updateDoc(ref, { [`typing.${uid}`]: deleteField() });
  }
}

/* ------------------------
   Unread counters
------------------------ */
export async function bumpUnread(chatId, targetUid) {
  await updateDoc(doc(db, "chats", chatId), {
    [`unread.${targetUid}`]: increment(1),
  });
}

export async function markRead(chatId, uid) {
  await updateDoc(doc(db, "chats", chatId), {
    [`unread.${uid}`]: 0,
    [`lastReadAt.${uid}`]: serverTimestamp(),
  });
}


// --- Presence (online / last seen) ---
export async function setUserPresence(uid, isOnline) {
  await updateDoc(doc(db, "users", uid), {
    isOnline,
    lastSeen: serverTimestamp(),
  });
}

export function listenUser(uid, cb) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}


// Update display name in Firebase Auth + Firestore user doc
export async function updateMyDisplayName(newName) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  await updateProfile(u, { displayName: newName });

  // keep Firestore user profile in sync
  await updateDoc(doc(db, "users", u.uid), {
    displayName: newName,
  });
}

// Update password (may require recent login)
export async function updateMyPassword(newPassword) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");
  await updatePassword(u, newPassword);
}
