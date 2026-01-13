import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../constants';

/**
 * Custom hook for managing advisors collection
 * @returns {object} Advisors state and handlers
 */
export const useAdvisors = () => {
  const [advisors, setAdvisors] = useState([]);
  const [isLoadingAdvisors, setIsLoadingAdvisors] = useState(false);

  // Fetch all advisors
  useEffect(() => {
    if (!db) return;

    const fetchAdvisors = async () => {
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
        console.error("Error loading advisors:", error);
      } finally {
        setIsLoadingAdvisors(false);
      }
    };

    fetchAdvisors();
  }, []);

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
