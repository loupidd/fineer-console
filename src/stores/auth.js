
import { writable } from 'svelte/store';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/services/firebase';

function createAuthStore() {
  const { subscribe, set } = writable({
    user: null,
    userData: null,
    loading: true
  });

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const q = query(collection(db, 'pegawai'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          set({ user, userData, loading: false });
        } else {
          set({ user: null, userData: null, loading: false });
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        set({ user: null, userData: null, loading: false });
      }
    } else {
      set({ user: null, userData: null, loading: false });
    }
  });

  return { subscribe };
}

export const authStore = createAuthStore();