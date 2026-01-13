import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { db, appId } from '../constants';

/**
 * Custom hook for managing scenario CRUD operations
 * @param {object} params - Hook parameters
 * @param {object} params.currentUser - Current authenticated user
 * @param {string} params.userRole - Current user role (client/advisor/master)
 * @returns {object} Scenario state and handlers
 */
export const useScenarios = ({ currentUser, userRole }) => {
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  // Fetch scenarios when user/role changes
  useEffect(() => {
    if (!currentUser || !db || userRole === 'client') return;

    const fetchScenarios = async () => {
      setIsLoadingScenarios(true);
      try {
        const querySnapshot = await getDocs(
          collection(db, 'artifacts', appId, 'public', 'data', 'scenarios')
        );
        let scenarios = [];
        querySnapshot.forEach((doc) => {
          scenarios.push({ id: doc.id, ...doc.data() });
        });

        // Filter by advisor if not master
        if (userRole !== 'master') {
          scenarios = scenarios.filter(s => s.advisorId === currentUser.uid);
        }

        scenarios.sort((a, b) => b.updatedAt - a.updatedAt);
        setSavedScenarios(scenarios);
      } catch (error) {
        console.error("Error loading scenarios:", error);
      } finally {
        setIsLoadingScenarios(false);
      }
    };

    fetchScenarios();
  }, [currentUser, userRole]);

  /**
   * Save a scenario (for advisors)
   * @param {object} scenarioState - Current scenario state to save
   * @returns {Promise<boolean>} Success status
   */
  const saveScenario = useCallback(async (scenarioState) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq } = scenarioState;

    if (!currentUser || !db) {
      alert("Database not connected.");
      return false;
    }

    setSaveStatus('saving');

    const docId = clientInfo.email || clientInfo.name || `scenario_${Date.now()}`;
    const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');

    const scenarioData = {
      advisorId: currentUser.uid,
      advisorEmail: currentUser.email || 'anonymous',
      clientInfo,
      inputs,
      assumptions,
      targetMaxPortfolioAge,
      rebalanceFreq,
      updatedAt: Date.now()
    };

    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', safeDocId),
        scenarioData
      );
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);

      // Update local state
      setSavedScenarios(prev => {
        const filtered = prev.filter(s => s.id !== safeDocId);
        return [{ id: safeDocId, ...scenarioData }, ...filtered];
      });

      return true;
    } catch (error) {
      console.error("Error saving:", error);
      setSaveStatus('error');
      return false;
    }
  }, [currentUser]);

  /**
   * Save progress silently (for both clients and advisors)
   * @param {object} scenarioState - Current scenario state to save
   * @param {string} role - User role (client/advisor/master)
   * @returns {Promise<boolean>} Success status
   */
  const saveProgress = useCallback(async (scenarioState, role) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq } = scenarioState;

    if (!currentUser || !db) {
      console.log("Database not connected - progress not saved.");
      return false;
    }

    const isClient = role === 'client';
    const docId = isClient
      ? `progress_${clientInfo.name || clientInfo.email || 'client'}_${Date.now()}`
      : (clientInfo.email || clientInfo.name || `scenario_${Date.now()}`);
    const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');

    const scenarioData = {
      advisorId: isClient ? 'CLIENT_PROGRESS' : currentUser.uid,
      advisorEmail: isClient ? 'Client Progress' : (currentUser.email || 'anonymous'),
      isClientSubmission: false,
      clientInfo,
      inputs,
      assumptions,
      targetMaxPortfolioAge,
      rebalanceFreq,
      updatedAt: Date.now()
    };

    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', safeDocId),
        scenarioData
      );

      // Update local state for advisors
      if (!isClient) {
        setSavedScenarios(prev => {
          const filtered = prev.filter(s => s.id !== safeDocId);
          return [{ id: safeDocId, ...scenarioData }, ...filtered];
        });
      }

      return true;
    } catch (error) {
      console.error("Error saving progress:", error);
      return false;
    }
  }, [currentUser]);

  /**
   * Submit a scenario (for clients)
   * @param {object} scenarioState - Current scenario state to submit
   * @returns {Promise<boolean>} Success status
   */
  const submitClientScenario = useCallback(async (scenarioState) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq } = scenarioState;

    if (!currentUser || !db) {
      alert("Connection error. Please ensure you are online.");
      return false;
    }

    // Open scheduling link immediately to bypass popup blockers
    window.open("https://oncehub.com/RoddMiller-30", "_blank");

    setSaveStatus('saving');

    const docId = `submission_${clientInfo.name || 'client'}_${Date.now()}`;
    const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');

    const scenarioData = {
      advisorId: 'CLIENT_SUBMISSION',
      advisorEmail: 'Client Submission',
      isClientSubmission: true,
      clientInfo,
      inputs,
      assumptions,
      targetMaxPortfolioAge,
      rebalanceFreq,
      updatedAt: Date.now()
    };

    try {
      await setDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', safeDocId),
        scenarioData
      );
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return true;
    } catch (error) {
      if (error.code === 'permission-denied') {
        alert("Error: Database permissions denied. \n\nPlease update Firestore Rules in the Firebase Console to allow write access for submissions.");
      } else {
        console.error("Error submitting:", error);
      }
      setSaveStatus('error');
      return false;
    }
  }, [currentUser]);

  /**
   * Load a scenario into the app state
   * @param {object} scenario - Scenario to load
   * @param {function} onLoad - Callback with scenario data
   * @returns {boolean} Whether the load was confirmed
   */
  const loadScenario = useCallback((scenario, onLoad) => {
    if (confirm(`Load data for ${scenario.clientInfo.name || 'Client'}? Unsaved changes will be lost.`)) {
      onLoad(scenario);
      return true;
    }
    return false;
  }, []);

  /**
   * Delete a saved scenario
   * @param {Event} e - Click event
   * @param {string} id - Scenario ID to delete
   * @returns {Promise<boolean>} Success status
   */
  const deleteScenario = useCallback(async (e, id) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this saved client?")) return false;

    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', id));
      setSavedScenarios(prev => prev.filter(s => s.id !== id));
      return true;
    } catch (error) {
      console.error("Error deleting:", error);
      return false;
    }
  }, []);

  /**
   * Clear all scenarios (used on logout)
   */
  const clearScenarios = useCallback(() => {
    setSavedScenarios([]);
  }, []);

  return {
    // State
    savedScenarios,
    isLoadingScenarios,
    saveStatus,

    // Actions
    saveScenario,
    saveProgress,
    submitClientScenario,
    loadScenario,
    deleteScenario,
    clearScenarios
  };
};

export default useScenarios;
