import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../constants';

/**
 * Custom hook for managing advisors collection
 * Auto-seeds directory from existing scenario data on first load
 * @returns {object} Advisors state and handlers
 */
export const useAdvisors = ({ currentUser, userRole } = {}) => {
  const [advisors, setAdvisors] = useState([]);
  const [isLoadingAdvisors, setIsLoadingAdvisors] = useState(true);

  // Fetch advisors and auto-seed from existing scenario data.
  //
  // Gated on currentUser because the directory's read rule requires isAuthenticated().
  // This effect used to run on mount with no auth dependency, racing Firebase Auth's
  // async session restore: win the race and the directory loads, lose it and the read is
  // denied, the handler returns early, and the effect never retries — so the directory
  // looked empty until a reload happened to win. Depending on currentUser means it runs
  // once auth is actually established, and re-runs if the user changes.
  useEffect(() => {
    if (!db || !currentUser) {
      setIsLoadingAdvisors(false);
      return;
    }

    const fetchAdvisors = async () => {
      setIsLoadingAdvisors(true);

      // Step 1: load the directory and populate UI state immediately.
      // Seed failures below must not block this — otherwise a single permission-denied
      // write would leave the directory looking empty even when records exist.
      const existingAdvisors = new Map();
      try {
        const advisorSnapshot = await getDocs(
          collection(db, 'artifacts', appId, 'public', 'data', 'advisors')
        );
        advisorSnapshot.forEach((doc) => {
          existingAdvisors.set(doc.id, { id: doc.id, ...doc.data() });
        });

        const initialList = [...existingAdvisors.values()].sort(
          (a, b) => (a.name || '').localeCompare(b.name || '')
        );
        setAdvisors(initialList);
      } catch (error) {
        console.error("Error loading advisor directory:", error);
        setIsLoadingAdvisors(false);
        return;
      }

      // Step 2: best-effort auto-seed any advisors discovered in scenarios.
      // Each write is isolated so one rule rejection does not abort the rest.
      //
      // Master only: this scans the whole scenarios collection, which the tightened read
      // rules allow for master alone. Non-master advisors would get a permission denial
      // here on every load — noise that could mask a real error — and they could not
      // write other people's directory entries anyway. Their entries get seeded the next
      // time master opens this page.
      if (userRole !== 'master') {
        setIsLoadingAdvisors(false);
        return;
      }
      try {
        const scenarioSnapshot = await getDocs(
          collection(db, 'artifacts', appId, 'public', 'data', 'scenarios')
        );
        const seenEmails = new Set(
          [...existingAdvisors.values()].map(a => a.email?.toLowerCase())
        );

        const toAdd = [];
        scenarioSnapshot.forEach((doc) => {
          const data = doc.data();
          const email = data.advisorEmail?.toLowerCase();
          if (email && !seenEmails.has(email) &&
              email !== 'anonymous' && email !== 'client progress' && email !== 'client submission') {
            seenEmails.add(email);
            const name = data.clientInfo?.advisorName || email.split('@')[0];
            toAdd.push({ email, name });
          }
        });

        const seeded = [];
        for (const advisor of toAdd) {
          const safeId = advisor.email.replace(/[^a-zA-Z0-9_-]/g, '_');
          const advisorData = { name: advisor.name, email: advisor.email, createdAt: Date.now() };
          try {
            await setDoc(
              doc(db, 'artifacts', appId, 'public', 'data', 'advisors', safeId),
              advisorData
            );
            seeded.push({ id: safeId, ...advisorData });
          } catch (seedErr) {
            // Permission-denied for non-master users is expected here; skip and move on.
            console.warn(`Skipped auto-seed for ${advisor.email}:`, seedErr?.code || seedErr?.message);
          }
        }

        if (seeded.length > 0) {
          setAdvisors(prev => {
            const merged = new Map(prev.map(a => [a.id, a]));
            seeded.forEach(a => merged.set(a.id, a));
            return [...merged.values()].sort(
              (a, b) => (a.name || '').localeCompare(b.name || '')
            );
          });
        }
      } catch (error) {
        console.error("Error scanning scenarios for advisor seeding:", error);
      } finally {
        setIsLoadingAdvisors(false);
      }
    };

    fetchAdvisors();
  }, [currentUser, userRole]);

  /**
   * Add a new advisor
   * @param {string} name - Advisor name
   * @param {string} email - Advisor email
   * @returns {Promise<boolean>} Success status
   */
  const addAdvisor = useCallback(async (name, email) => {
    console.log('addAdvisor called:', { name, email, db: !!db, appId });
    if (!db) {
      console.error('Database not initialized');
      return false;
    }
    if (!name || !email) {
      console.error('Missing name or email');
      return false;
    }

    try {
      const safeId = email.replace(/[^a-zA-Z0-9_-]/g, '_');
      const advisorData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        createdAt: Date.now()
      };

      console.log('Attempting to save advisor:', { safeId, advisorData });
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'advisors', safeId),
        advisorData
      );
      console.log('Advisor saved successfully');

      setAdvisors(prev => {
        const filtered = prev.filter(a => a.id !== safeId);
        return [...filtered, { id: safeId, ...advisorData }].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );
      });

      return true;
    } catch (error) {
      console.error("Error adding advisor:", error);
      return false;
    }
  }, []);

  /**
   * Delete an advisor
   * @param {string} id - Advisor ID to delete
   * @returns {Promise<boolean>} Success status
   */
  const deleteAdvisor = useCallback(async (id) => {
    if (!db) return false;

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'advisors', id));
      setAdvisors(prev => prev.filter(a => a.id !== id));
      return true;
    } catch (error) {
      console.error("Error deleting advisor:", error);
      return false;
    }
  }, []);

  /**
   * Refresh advisors from database
   */
  const refreshAdvisors = useCallback(async () => {
    if (!db) return;

    setIsLoadingAdvisors(true);
    try {
      const querySnapshot = await getDocs(
        collection(db, 'artifacts', appId, 'public', 'data', 'advisors')
      );
      const advisorList = [];
      querySnapshot.forEach((doc) => {
        advisorList.push({ id: doc.id, ...doc.data() });
      });
      advisorList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setAdvisors(advisorList);
    } catch (error) {
      console.error("Error refreshing advisors:", error);
    } finally {
      setIsLoadingAdvisors(false);
    }
  }, []);

  return {
    advisors,
    isLoadingAdvisors,
    addAdvisor,
    deleteAdvisor,
    refreshAdvisors
  };
};

export default useAdvisors;
