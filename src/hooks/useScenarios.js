import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../constants';
import { calculateBasePlan, runSimulation } from '../utils';

/**
 * Custom hook for managing scenario CRUD operations
 * @param {object} params - Hook parameters
 * @param {object} params.currentUser - Current authenticated user
 * @param {string} params.userRole - Current user role (client/advisor/master)
 * @param {string} params.planFilter - Plan filter mode ('mine', 'team', 'all')
 * @param {string[]} params.teamMemberEmails - Array of team member email addresses
 * @returns {object} Scenario state and handlers
 */
export const useScenarios = ({ currentUser, userRole, planFilter = 'mine', teamMemberEmails = [] }) => {
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  // Fetch scenarios when user/role/filter changes
  useEffect(() => {
    if (!currentUser || !db || userRole === 'anonymous') return;

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

        // For registered clients, only show plans assigned to them
        if (userRole === 'registeredClient') {
          scenarios = scenarios.filter(s =>
            s.assignedClientEmail?.toLowerCase() === currentUser.email?.toLowerCase()
          );
        }
        // Master can see all or filter by team
        else if (userRole === 'master') {
          if (planFilter === 'mine') {
            scenarios = scenarios.filter(s =>
              s.advisorId === currentUser.uid ||
              s.advisorEmail?.toLowerCase() === currentUser.email?.toLowerCase()
            );
          } else if (planFilter === 'team' && teamMemberEmails.length > 0) {
            scenarios = scenarios.filter(s =>
              teamMemberEmails.includes(s.advisorEmail?.toLowerCase())
            );
          }
          // planFilter === 'all' shows everything for master
        }
        // Regular advisors: filter by mine or team
        else {
          if (planFilter === 'team' && teamMemberEmails.length > 0) {
            // Show all team members' plans (including own)
            scenarios = scenarios.filter(s =>
              teamMemberEmails.includes(s.advisorEmail?.toLowerCase())
            );
          } else {
            // Default to 'mine' - show only own plans
            scenarios = scenarios.filter(s =>
              s.advisorId === currentUser.uid ||
              s.advisorEmail?.toLowerCase() === currentUser.email?.toLowerCase() ||
              s.advisorId?.toLowerCase() === currentUser.email?.toLowerCase()
            );
          }
        }

        // Backfill computed fields for plans saved before they existed
        scenarios.forEach(s => {
          if (s.inputs && s.assumptions && s.clientInfo) {
            // Backfill legacyBalance by running the projection
            if (s.legacyBalance == null) {
              try {
                const basePlan = calculateBasePlan(s.inputs, s.assumptions, s.clientInfo);
                const projection = runSimulation(basePlan, s.assumptions, s.inputs, s.rebalanceFreq || 3);
                const legacyYear = Math.min(95 - (s.clientInfo.retirementAge || 65), projection.length) - 1;
                s.legacyBalance = projection[Math.max(0, legacyYear)]?.total || 0;
              } catch (e) {
                // Leave as null if computation fails
              }
            }
            // Backfill monthlySpending from currentSpending adjusted for inflation
            if (!s.inputs.monthlySpending && s.clientInfo.currentSpending) {
              const yearsToRetire = Math.max(0, (s.clientInfo.retirementAge || 65) - (s.clientInfo.currentAge || 55));
              const inflationRate = (s.inputs.personalInflationRate || 2.5) / 100;
              s.inputs.monthlySpending = Math.round(s.clientInfo.currentSpending * Math.pow(1 + inflationRate, yearsToRetire));
            }
          }
        });

        scenarios.sort((a, b) => b.updatedAt - a.updatedAt);
        setSavedScenarios(scenarios);
      } catch (error) {
        console.error("Error loading scenarios:", error);
      } finally {
        setIsLoadingScenarios(false);
      }
    };

    fetchScenarios();
  }, [currentUser, userRole, planFilter, teamMemberEmails]);

  /**
   * Save a scenario (for advisors)
   * @param {object} scenarioState - Current scenario state to save
   * @returns {Promise<boolean>} Success status
   */
  const saveScenario = useCallback(async (scenarioState) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance } = scenarioState;

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
      vaEnabled: vaEnabled || false,
      vaInputs: vaInputs || null,
      legacyBalance: legacyBalance || 0,
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
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance } = scenarioState;

    if (!currentUser || !db) {
      console.log("Database not connected - progress not saved.");
      return false;
    }

    const isClient = role === 'client';
    const docId = isClient
      ? `progress_${clientInfo.name || clientInfo.email || 'client'}`
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
      vaEnabled: vaEnabled || false,
      vaInputs: vaInputs || null,
      legacyBalance: legacyBalance || 0,
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
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance } = scenarioState;

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
      vaEnabled: vaEnabled || false,
      vaInputs: vaInputs || null,
      legacyBalance: legacyBalance || 0,
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
   * @param {boolean} skipConfirm - Skip confirmation dialog (for bulk operations)
   * @returns {Promise<boolean>} Success status
   */
  const deleteScenario = useCallback(async (e, id, skipConfirm = false) => {
    e.stopPropagation();
    if (!skipConfirm) {
      if (!confirm("Are you sure you want to delete this saved client?")) return false;
    }

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

  /**
   * Reassign a scenario to a different advisor (master only)
   * @param {string} scenarioId - Scenario ID to reassign
   * @param {string} newAdvisorId - New advisor ID (can be email if no UID known)
   * @param {string} newAdvisorEmail - New advisor email (optional, defaults to ID)
   * @returns {Promise<boolean>} Success status
   */
  const reassignScenario = useCallback(async (scenarioId, newAdvisorId, newAdvisorEmail = null) => {
    if (!db) return false;

    try {
      // If email provided, use it; otherwise try to find from existing scenarios
      let advisorEmail = newAdvisorEmail;
      let advisorId = newAdvisorId;

      if (!advisorEmail) {
        const advisorScenario = savedScenarios.find(s => s.advisorId === newAdvisorId);
        advisorEmail = advisorScenario?.advisorEmail || newAdvisorId;
      }

      // If the ID looks like an email (contains @), use it as both ID and email
      // This allows assigning to advisors who haven't created plans yet
      if (advisorId.includes('@')) {
        advisorEmail = advisorId;
        // Keep email as the ID for now - when advisor logs in, their UID will be used
      }

      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', scenarioId),
        {
          advisorId: advisorId,
          advisorEmail: advisorEmail,
          updatedAt: Date.now()
        }
      );

      // Update local state
      setSavedScenarios(prev =>
        prev.map(s =>
          s.id === scenarioId
            ? { ...s, advisorId: advisorId, advisorEmail: advisorEmail, updatedAt: Date.now() }
            : s
        )
      );

      return true;
    } catch (error) {
      console.error("Error reassigning scenario:", error);
      return false;
    }
  }, [savedScenarios]);

  /**
   * Refresh scenarios from the database
   */
  const refreshScenarios = useCallback(async () => {
    if (!currentUser || !db) return;

    setIsLoadingScenarios(true);
    try {
      const querySnapshot = await getDocs(
        collection(db, 'artifacts', appId, 'public', 'data', 'scenarios')
      );
      let scenarios = [];
      querySnapshot.forEach((doc) => {
        scenarios.push({ id: doc.id, ...doc.data() });
      });

      // For registered clients, only show plans assigned to them
      if (userRole === 'registeredClient') {
        scenarios = scenarios.filter(s =>
          s.assignedClientEmail?.toLowerCase() === currentUser.email?.toLowerCase()
        );
      }
      // Master can see all or filter by team
      else if (userRole === 'master') {
        if (planFilter === 'mine') {
          scenarios = scenarios.filter(s =>
            s.advisorId === currentUser.uid ||
            s.advisorEmail?.toLowerCase() === currentUser.email?.toLowerCase()
          );
        } else if (planFilter === 'team' && teamMemberEmails.length > 0) {
          scenarios = scenarios.filter(s =>
            teamMemberEmails.includes(s.advisorEmail?.toLowerCase())
          );
        }
      }
      // Regular advisors: filter by mine or team
      else {
        if (planFilter === 'team' && teamMemberEmails.length > 0) {
          scenarios = scenarios.filter(s =>
            teamMemberEmails.includes(s.advisorEmail?.toLowerCase())
          );
        } else {
          scenarios = scenarios.filter(s =>
            s.advisorId === currentUser.uid ||
            s.advisorEmail?.toLowerCase() === currentUser.email?.toLowerCase() ||
            s.advisorId?.toLowerCase() === currentUser.email?.toLowerCase()
          );
        }
      }

      scenarios.sort((a, b) => b.updatedAt - a.updatedAt);
      setSavedScenarios(scenarios);
    } catch (error) {
      console.error("Error refreshing scenarios:", error);
    } finally {
      setIsLoadingScenarios(false);
    }
  }, [currentUser, userRole, planFilter, teamMemberEmails]);

  /**
   * Assign a plan to a client by email
   * @param {string} scenarioId - Scenario ID to assign
   * @param {string} clientEmail - Client email address
   * @returns {Promise<{success: boolean, message: string, clientEmail: string}>} Result
   */
  const assignPlanToClient = useCallback(async (scenarioId, clientEmail) => {
    if (!db) {
      return { success: false, message: 'Database not connected' };
    }

    const email = clientEmail.toLowerCase().trim();

    try {
      // Update the scenario with client assignment
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', scenarioId),
        {
          assignedClientEmail: email,
          clientAssignedAt: Date.now(),
          updatedAt: Date.now()
        }
      );

      // Update local state
      setSavedScenarios(prev =>
        prev.map(s =>
          s.id === scenarioId
            ? { ...s, assignedClientEmail: email, clientAssignedAt: Date.now(), updatedAt: Date.now() }
            : s
        )
      );

      return {
        success: true,
        message: `Plan assigned to ${email}. Please notify your client to sign up.`,
        clientEmail: email
      };
    } catch (error) {
      console.error('Error assigning plan to client:', error);
      return { success: false, message: error.message };
    }
  }, []);

  /**
   * Remove client assignment from a plan
   * @param {string} scenarioId - Scenario ID to remove assignment from
   * @returns {Promise<boolean>} Success status
   */
  const removeClientAssignment = useCallback(async (scenarioId) => {
    if (!db) return false;

    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', scenarioId),
        {
          assignedClientEmail: null,
          assignedClientUid: null,
          clientAssignedAt: null,
          updatedAt: Date.now()
        }
      );

      // Update local state
      setSavedScenarios(prev =>
        prev.map(s =>
          s.id === scenarioId
            ? { ...s, assignedClientEmail: null, assignedClientUid: null, clientAssignedAt: null, updatedAt: Date.now() }
            : s
        )
      );

      return true;
    } catch (error) {
      console.error('Error removing client assignment:', error);
      return false;
    }
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
    clearScenarios,
    reassignScenario,
    refreshScenarios,
    assignPlanToClient,
    removeClientAssignment
  };
};

export default useScenarios;
