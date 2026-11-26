import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type { Language, Product } from '../types';

export interface SavedProfile {
  displayName: string;
  email: string;
  phone: string;
  savedAddress: string;
  preferredLang: Language;
}

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  idToken: string | null;
  wishlistIds: string[];
  savedProfile: SavedProfile | null;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  getFreshToken: (forceRefresh?: boolean) => Promise<string | null>;
  toggleWishlist: (product: Product) => Promise<void>;
  saveCheckoutContact: (phone: string, savedAddress: string, preferredLang: Language) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [savedProfile, setSavedProfile] = useState<SavedProfile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          setIdToken(token);
          await fetch('/api/me/sync', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch {
          // Non-fatal sync retry on next action
        }
      } else {
        setIdToken(null);
        setWishlistIds([]);
        setSavedProfile(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    const wishlistPath = `users/${user.uid}/wishlist`;
    const wishlistQuery = query(
      collection(db, wishlistPath),
      where('uid', '==', user.uid)
    );

    const unsubWishlist = onSnapshot(
      wishlistQuery,
      (snapshot) => {
        setWishlistIds(snapshot.docs.map((d) => d.id));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, wishlistPath);
      }
    );

    const profilePath = `users/${user.uid}/private/info`;
    const unsubProfile = onSnapshot(
      doc(db, profilePath),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SavedProfile>;
          setSavedProfile({
            displayName: typeof data.displayName === 'string' ? data.displayName : user.displayName || 'MARAYA Guest',
            email: typeof data.email === 'string' ? data.email : user.email || '',
            phone: typeof data.phone === 'string' ? data.phone : '',
            savedAddress: typeof data.savedAddress === 'string' ? data.savedAddress : '',
            preferredLang: data.preferredLang === 'en' ? 'en' : 'ar',
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, profilePath);
      }
    );

    return () => {
      unsubWishlist();
      unsubProfile();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const token = await cred.user.getIdToken();
      setIdToken(token);

      try {
        await fetch('/api/me/sync', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Non-fatal sync retry on next API call
      }

      const infoPath = `users/${cred.user.uid}/private/info`;
      const displayName = (cred.user.displayName || 'MARAYA Guest').slice(0, 120);
      const email = (cred.user.email || `${cred.user.uid}@maraya.local`).slice(0, 160);
      try {
        await updateDoc(doc(db, infoPath), {
          displayName,
          email,
          updatedAt: serverTimestamp(),
        });
      } catch {
        await setDoc(doc(db, infoPath), {
          uid: cred.user.uid,
          displayName,
          email,
          phone: '',
          savedAddress: '',
          preferredLang: 'ar',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Google Sign-In failed.';
      setAuthError(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setIdToken(null);
    setWishlistIds([]);
    setSavedProfile(null);
  }, []);

  const getFreshToken = useCallback(async (forceRefresh = false) => {
    if (!auth.currentUser) return null;
    const token = await auth.currentUser.getIdToken(forceRefresh);
    setIdToken(token);
    return token;
  }, []);

  const toggleWishlist = useCallback(
    async (product: Product) => {
      if (!user) {
        await signInWithGoogle();
        return;
      }
      const docPath = `users/${user.uid}/wishlist/${product.id}`;
      const isSaved = wishlistIds.includes(product.id);
      try {
        if (isSaved) {
          await deleteDoc(doc(db, docPath));
        } else {
          await setDoc(doc(db, docPath), {
            uid: user.uid,
            productId: product.id.slice(0, 128),
            titleAr: product.title.ar.slice(0, 140),
            titleEn: product.title.en.slice(0, 140),
            createdAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, isSaved ? OperationType.DELETE : OperationType.CREATE, docPath);
      }
    },
    [user, wishlistIds, signInWithGoogle]
  );

  const saveCheckoutContact = useCallback(
    async (phone: string, savedAddress: string, preferredLang: Language) => {
      if (!user) return;
      const infoPath = `users/${user.uid}/private/info`;
      const cleanPhone = phone.trim().slice(0, 32);
      const cleanAddress = savedAddress.trim().slice(0, 300);
      const displayName = (user.displayName || 'MARAYA Guest').slice(0, 120);
      const email = (user.email || `${user.uid}@maraya.local`).slice(0, 160);

      try {
        if (savedProfile) {
          await updateDoc(doc(db, infoPath), {
            displayName,
            email,
            phone: cleanPhone,
            savedAddress: cleanAddress,
            preferredLang,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, infoPath), {
            uid: user.uid,
            displayName,
            email,
            phone: cleanPhone,
            savedAddress: cleanAddress,
            preferredLang,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, infoPath);
      }
    },
    [user, savedProfile]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        idToken,
        wishlistIds,
        savedProfile,
        authError,
        signInWithGoogle,
        logout,
        getFreshToken,
        toggleWishlist,
        saveCheckoutContact,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
