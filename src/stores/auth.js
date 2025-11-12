import { writable } from 'svelte/store';
import { auth, db } from '../lib/services/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
const SESSION_KEY = 'fineer_session_expiry';

function createAuthStore() {
  const { subscribe, set, update } = writable({
    user: null,
    userData: null,
    loading: true,
    sessionExpiry: null
  });

  let sessionCheckInterval = null;

  // Check if session is expired
  function isSessionExpired() {
    const expiry = localStorage.getItem(SESSION_KEY);
    if (!expiry) return true;
    return Date.now() > parseInt(expiry);
  }

  // Set new session expiry
  function setSessionExpiry() {
    const expiry = Date.now() + SESSION_DURATION;
    localStorage.setItem(SESSION_KEY, expiry.toString());
    return expiry;
  }

  // Clear session
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
      sessionCheckInterval = null;
    }
  }

  // Start session monitoring
  function startSessionMonitoring() {
    // Clear any existing interval
    if (sessionCheckInterval) {
      clearInterval(sessionCheckInterval);
    }

    // Check every minute
    sessionCheckInterval = setInterval(async () => {
      if (isSessionExpired()) {
        console.log('Session expired, logging out...');
        await handleSignOut();
        alert('Your session has expired. Please log in again.');
      }
    }, 60000); // Check every minute
  }

  // Handle sign out
  async function handleSignOut() {
    try {
      await signOut(auth);
      clearSession();
      set({
        user: null,
        userData: null,
        loading: false,
        sessionExpiry: null
      });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  // Initialize auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Check if session is expired
      if (isSessionExpired()) {
        console.log('Session expired on auth state change');
        await handleSignOut();
        return;
      }

      try {
        // Fetch user data from Firestore (pegawai collection)
        const q = query(collection(db, 'pegawai'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          
          // Set new session expiry
          const expiry = setSessionExpiry();
          
          // Start monitoring session
          startSessionMonitoring();

          set({
            user,
            userData,
            loading: false,
            sessionExpiry: expiry
          });
        } else {
          console.error('User document not found in pegawai collection');
          await handleSignOut();
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        set({
          user: null,
          userData: null,
          loading: false,
          sessionExpiry: null
        });
      }
    } else {
      clearSession();
      set({
        user: null,
        userData: null,
        loading: false,
        sessionExpiry: null
      });
    }
  });

  return {
    subscribe,
    signOut: handleSignOut,
    refreshSession: () => {
      const expiry = setSessionExpiry();
      update(state => ({ ...state, sessionExpiry: expiry }));
    }
  };
}

export const authStore = createAuthStore();