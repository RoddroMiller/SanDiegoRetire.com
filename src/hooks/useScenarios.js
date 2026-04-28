import { useState, useEffect, useCallback } from 'react';
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../constants';
import { calculateBasePlan, runSimulation } from '../utils';

/**
 * Apply role/team-based visibility rules to a set of scenarios.
 * Dual-path: honors legacy advisorEmail∈teamMemberEmails for unmigrated plans.
 */
const applyPlanVisibility = (scenarios, { currentUser, userRole, planFilter, myTeamIds, teamMemberEmails }) => {
  if (!currentUser) return [];

  const myEmail = currentUser.email?.toLowerCase();
  const myUid = currentUser.uid;
  const isProspective = (s) => s.advisorId === 'CLIENT_PROGRESS' || s.advisorId === 'CLIENT_SUBMISSION';
  const isCreator = (s) =>
    s.advisorId === myUid ||
    s.advisorEmail?.toLowerCase() === myEmail ||
    s.advisorId?.toLowerCase?.() === myEmail;

  if (userRole === 'registeredClient') {
    return scenarios.filter(s => s.assignedClientEmail?.toLowerCase() === myEmail);
  }

  // Specific team filter (applies to both master and advisor)
  if (planFilter) {
    return scenarios.filter(s => s.teamId === planFilter);
  }

  // Default view
  if (userRole === 'master') {
    return scenarios;
  }

  // Advisor default: plans on any of my teams, my personal (teamId=null) plans,
  // prospective plans, and (dual-path) legacy advisor-in-team-members plans.
  return scenarios.filter(s => {
    if (isProspective(s)) return true;
    if (s.teamId && myTeamIds.includes(s.teamId)) return true;
    if (!s.teamId && isCreator(s)) return true;
    // Dual-path legacy visibility for unmigrated plans
    if (!s.teamId && s.advisorEmail && teamMemberEmails.includes(s.advisorEmail.toLowerCase())) return true;
    return false;
  });
};

/**
 * Custom hook for managing scenario CRUD operations
 * @param {object} params - Hook parameters
 * @param {object} params.currentUser - Current authenticated user
 * @param {string} params.userRole - Current user role (client/advisor/master)
 * @param {string} params.planFilter - Either '' (default: all my teams for advisor, all for master) or a specific teamId
 * @param {string[]} params.teamMemberEmails - Legacy: team member emails (used for dual-path visibility of unmigrated plans)
 * @param {string[]} params.myTeamIds - Team IDs the current user belongs to
 * @returns {object} Scenario state and handlers
 */
export const useScenarios = ({ currentUser, userRole, planFilter = '', teamMemberEmails = [], myTeamIds = [] }) => {
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

        scenarios = applyPlanVisibility(scenarios, {
          currentUser,
          userRole,
          planFilter,
          myTeamIds,
          teamMemberEmails,
        });

        // Backfill computed fields for plans saved before they existed
        scenarios.forEach(s => {
          if (s.inputs && s.assumptions && s.clientInfo) {
            // Always compute legacyBalance at age 95 from saved inputs
            try {
              const basePlan = calculateBasePlan(s.inputs, s.assumptions, s.clientInfo);
              const projection = runSimulation(basePlan, s.assumptions, s.inputs, s.rebalanceFreq || 3);
              const legacyEntry = projection.find(p => p.age >= 95) || projection[projection.length - 1];
              s.legacyBalance = legacyEntry?.total || 0;
            } catch (e) {
              // Leave existing value if computation fails
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
  }, [currentUser, userRole, planFilter, teamMemberEmails, myTeamIds]);

  /**
   * Save a scenario (for advisors)
   * @param {object} scenarioState - Current scenario state to save
   * @returns {Promise<boolean>} Success status
   */
  const saveScenario = useCallback(async (scenarioState) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance, teamId, teamName } = scenarioState;

    if (!currentUser || !db) {
      alert("Database not connected.");
      return false;
    }

    setSaveStatus('saving');

    const baseDocId = clientInfo.email || clientInfo.name || `scenario_${Date.now()}`;
    const safeBaseDocId = baseDocId.replace(/[^a-zA-Z0-9_-]/g, '_');

    // Check if this docId is already used by a different client
    const existing = savedScenarios.find(s => s.id === safeBaseDocId);
    const isDuplicate = existing && existing.clientInfo?.name !== clientInfo.name;
    const safeDocId = isDuplicate ? `${safeBaseDocId}_${Date.now()}` : safeBaseDocId;

    // Preserve existing clientStatus if set, otherwise default to 'client' for advisor saves
    const existingScenario = savedScenarios.find(s => s.id === safeDocId);
    const now = Date.now();
    const userEmail = currentUser.email || 'anonymous';
    const scenarioData = {
      advisorId: currentUser.uid,
      advisorEmail: userEmail,
      teamId: teamId ?? existingScenario?.teamId ?? null,
      teamName: teamName ?? existingScenario?.teamName ?? null,
      clientStatus: existingScenario?.clientStatus || 'client',
      clientInfo,
      inputs,
      assumptions,
      targetMaxPortfolioAge,
      rebalanceFreq,
      vaEnabled: vaEnabled || false,
      vaInputs: vaInputs || null,
      legacyBalance: legacyBalance || 0,
      // Creator stamp: set once, preserved on subsequent saves.
      // For legacy plans without createdAt, backfill from existing advisor + updatedAt.
      createdAt: existingScenario?.createdAt ?? existingScenario?.updatedAt ?? now,
      createdBy: existingScenario?.createdBy ?? existingScenario?.advisorId ?? currentUser.uid,
      createdByEmail: existingScenario?.createdByEmail ?? existingScenario?.advisorEmail ?? userEmail,
      // Updater stamp: refreshed on every save.
      updatedBy: currentUser.uid,
      updatedByEmail: userEmail,
      updatedAt: now
    };

    // Flag if this is a new client reusing an existing email
    if (isDuplicate) {
      scenarioData.duplicateEmail = clientInfo.email || null;
    }

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
  }, [currentUser, savedScenarios]);

  /**
   * Save progress silently (for both clients and advisors)
   * @param {object} scenarioState - Current scenario state to save
   * @param {string} role - User role (client/advisor/master)
   * @returns {Promise<boolean>} Success status
   */
  const saveProgress = useCallback(async (scenarioState, role) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance, teamId, teamName } = scenarioState;

    if (!currentUser || !db) {
      console.log("Database not connected - progress not saved.");
      return false;
    }

    const isClient = role === 'client' || role === 'anonymous' || role === 'registeredClient';
    const baseDocId = isClient
      ? `progress_${clientInfo.name || clientInfo.email || 'client'}`
      : (clientInfo.email || clientInfo.name || `scenario_${Date.now()}`);
    const safeBaseDocId = baseDocId.replace(/[^a-zA-Z0-9_-]/g, '_');

    // For advisor path, check if this docId is already used by a different client
    let safeDocId = safeBaseDocId;
    let isDuplicate = false;
    let existingScenario = null;
    if (!isClient) {
      const existing = savedScenarios.find(s => s.id === safeBaseDocId);
      isDuplicate = existing && existing.clientInfo?.name !== clientInfo.name;
      if (isDuplicate) {
        safeDocId = `${safeBaseDocId}_${Date.now()}`;
      }
      existingScenario = savedScenarios.find(s => s.id === safeDocId);
    }

    const now = Date.now();
    const actorId = isClient ? 'CLIENT_PROGRESS' : currentUser.uid;
    const actorEmail = isClient ? 'Client Progress' : (currentUser.email || 'anonymous');
    const scenarioData = {
      advisorId: actorId,
      advisorEmail: actorEmail,
      // Team only applies to advisor saves; client-progress plans stay team-less until claimed
      teamId: isClient ? null : (teamId ?? existingScenario?.teamId ?? null),
      teamName: isClient ? null : (teamName ?? existingScenario?.teamName ?? null),
      isClientSubmission: false,
      clientStatus: 'in_progress',
      clientInfo,
      inputs,
      assumptions,
      targetMaxPortfolioAge,
      rebalanceFreq,
      vaEnabled: vaEnabled || false,
      vaInputs: vaInputs || null,
      legacyBalance: legacyBalance || 0,
      // Creator stamp: set once, preserved on subsequent saves.
      createdAt: existingScenario?.createdAt ?? existingScenario?.updatedAt ?? now,
      createdBy: existingScenario?.createdBy ?? existingScenario?.advisorId ?? actorId,
      createdByEmail: existingScenario?.createdByEmail ?? existingScenario?.advisorEmail ?? actorEmail,
      // Updater stamp: refreshed on every save.
      updatedBy: actorId,
      updatedByEmail: actorEmail,
      updatedAt: now
    };

    // Flag if this is a new client reusing an existing email
    if (isDuplicate) {
      scenarioData.duplicateEmail = clientInfo.email || null;
    }

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
  }, [currentUser, savedScenarios]);

  /**
   * Submit a scenario (for clients)
   * @param {object} scenarioState - Current scenario state to submit
   * @returns {Promise<boolean>} Success status
   */
  const submitClientScenario = useCallback(async (scenarioState, { openScheduling = true } = {}) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, vaEnabled, vaInputs, legacyBalance } = scenarioState;

    if (!currentUser || !db) {
      alert("Connection error. Please ensure you are online.");
      return false;
    }

    // Open scheduling link immediately to bypass popup blockers
    if (openScheduling) {
      window.open("https://oncehub.com/RoddMiller-30", "_blank");
    }

    setSaveStatus('saving');

    const docId = `submission_${clientInfo.name || 'client'}_${Date.now()}`;
    const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '_');

    const now = Date.now();
    const scenarioData = {
      advisorId: 'CLIENT_SUBMISSION',
      advisorEmail: 'Client Submission',
      isClientSubmission: true,
      clientStatus: 'prospect',
      clientInfo,
      inputs,
      assumptions,
      targetMaxPortfolioAge,
      rebalanceFreq,
      vaEnabled: vaEnabled || false,
      vaInputs: vaInputs || null,
      legacyBalance: legacyBalance || 0,
      createdAt: now,
      createdBy: 'CLIENT_SUBMISSION',
      createdByEmail: 'Client Submission',
      updatedBy: 'CLIENT_SUBMISSION',
      updatedByEmail: 'Client Submission',
      updatedAt: now
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
   * Reassign a scenario to a different team.
   * @param {string} scenarioId
   * @param {string|null} teamId - Target team id, or null to clear team assignment
   * @param {string|null} teamName - Target team name (denormalized for display)
   */
  const setScenarioTeam = useCallback(async (scenarioId, teamId, teamName) => {
    if (!db) return false;
    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', scenarioId),
        {
          teamId: teamId ?? null,
          teamName: teamName ?? null,
          updatedAt: Date.now()
        }
      );
      setSavedScenarios(prev =>
        prev.map(s =>
          s.id === scenarioId
            ? { ...s, teamId: teamId ?? null, teamName: teamName ?? null, updatedAt: Date.now() }
            : s
        )
      );
      return true;
    } catch (error) {
      console.error("Error setting scenario team:", error);
      return false;
    }
  }, []);

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

      scenarios = applyPlanVisibility(scenarios, {
        currentUser,
        userRole,
        planFilter,
        myTeamIds,
        teamMemberEmails,
      });

      scenarios.sort((a, b) => b.updatedAt - a.updatedAt);
      setSavedScenarios(scenarios);
    } catch (error) {
      console.error("Error refreshing scenarios:", error);
    } finally {
      setIsLoadingScenarios(false);
    }
  }, [currentUser, userRole, planFilter, teamMemberEmails, myTeamIds]);

  /**
   * Update the clientStatus of a scenario
   * @param {string} scenarioId - Scenario ID to update
   * @param {string} newStatus - New status ('client', 'prospect', 'in_progress')
   * @returns {Promise<boolean>} Success status
   */
  const updateClientStatus = useCallback(async (scenarioId, newStatus) => {
    if (!db) return false;

    try {
      await updateDoc(
        doc(db, 'artifacts', appId, 'public', 'data', 'scenarios', scenarioId),
        {
          clientStatus: newStatus,
          updatedAt: Date.now()
        }
      );

      // Update local state
      setSavedScenarios(prev =>
        prev.map(s =>
          s.id === scenarioId
            ? { ...s, clientStatus: newStatus, updatedAt: Date.now() }
            : s
        )
      );

      return true;
    } catch (error) {
      console.error("Error updating client status:", error);
      return false;
    }
  }, []);

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
    setScenarioTeam,
    refreshScenarios,
    assignPlanToClient,
    removeClientAssignment,
    updateClientStatus
  };
};

export default useScenarios;
