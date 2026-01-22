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
  getDoc,
  writeBatch,     // ✅ ADD THIS
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
// Send text message (updates lastMessage + updatedAt)
export async function sendMessage({ chatId, senderId, text, otherUid }) {
  await addDoc(collection(db, "chats", chatId, "messages"), {
    senderId,
    text,
    type: "text",
    createdAt: serverTimestamp(),
  });

  const updates = {
    lastMessage: text,
    lastMessageSenderId: senderId,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // ✅ Unhide chat for sender (so it reappears in their list)
  updates[`hiddenFor.${senderId}`] = deleteField();

  // ✅ Unhide chat for receiver (so it reappears when they receive a message)
  if (otherUid) updates[`hiddenFor.${otherUid}`] = deleteField();

  await updateDoc(doc(db, "chats", chatId), updates);
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





// Update display name in Firebase Auth + Firestore users doc
export async function updateMyDisplayName(newName) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  await updateProfile(u, { displayName: newName });

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

// Save phone number to Firestore users doc (example field)
export async function updateMyPhone(phone) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  await updateDoc(doc(db, "users", u.uid), {
    phone: phone ? phone : null,
  });
}


export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}


export function listenUserDoc(uid, cb) {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  });
}

export async function updateMyNameEverywhere(newName) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const uid = u.uid;

  // 1) Update Auth + users doc
  await updateProfile(u, { displayName: newName });
  await updateDoc(doc(db, "users", uid), { displayName: newName });

  // 2) Update all chats where I'm a member:
  // Replace my name inside memberNames[] at my index
  const q = query(collection(db, "chats"), where("members", "array-contains", uid));
  const snap = await getDocs(q);

  const batch = writeBatch(db);

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const members = data.members || [];
    const names = data.memberNames || [];

    const idx = members.indexOf(uid);
    if (idx === -1) return;

    const newNames = [...names];
    newNames[idx] = newName;

    batch.update(doc(db, "chats", docSnap.id), {
      memberNames: newNames,
    });
  });

  await batch.commit();
}


// -------------------------
// Message edit / delete
// -------------------------

export async function editMessage(chatId, messageId, newText) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const t = String(newText || "").trim();
  if (!t) throw new Error("Message cannot be empty.");

  const ref = doc(db, "chats", chatId, "messages", messageId);

  await updateDoc(ref, {
    text: t,
    editedAt: serverTimestamp(),
  });
}

// Delete for ME only (hide message for this user)
export async function deleteMessageForMe(chatId, messageId, uid) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const targetUid = uid || u.uid;
  const ref = doc(db, "chats", chatId, "messages", messageId);

  await updateDoc(ref, {
    [`deletedFor.${targetUid}`]: true,
  });
}

// Delete for EVERYONE (soft delete)
export async function deleteMessageForEveryone(chatId, messageId) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const ref = doc(db, "chats", chatId, "messages", messageId);

  await updateDoc(ref, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    text: "",
  });
}

// Update sidebar preview (lastMessage) safely from UI actions
export async function updateChatPreview(chatId, previewText, senderId) {
  await updateDoc(doc(db, "chats", chatId), {
    lastMessage: previewText,
    lastMessageSenderId: senderId,
    updatedAt: serverTimestamp(),
  });
}

// Delete chat for ME only (hide from my list + clear history for me)
export async function deleteChatForMe(chatId, uid) {
  const u = auth.currentUser;
  if (!u) throw new Error("Not signed in");

  const my = uid || u.uid;

  await updateDoc(doc(db, "chats", chatId), {
    [`hiddenFor.${my}`]: true,                 // hide chat from my list
    [`clearedAt.${my}`]: serverTimestamp(),    // hide old messages for me
    [`unread.${my}`]: 0,                       // optional: reset unread
    [`lastReadAt.${my}`]: serverTimestamp(),   // optional: set read time
  });
}
