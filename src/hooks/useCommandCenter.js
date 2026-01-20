import { useState, useCallback } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { commandCenterDb } from '../constants';

/**
 * Custom hook for saving Portfolio Architect data to The One Process Client Command Center
 *
 * Data is stored at: advisorProfiles/{advisorUserId}/clients/{clientId}/portfolioArchitect
 *
 * @param {object} params - Hook parameters
 * @param {object} params.currentUser - Current authenticated user (advisor)
 * @returns {object} Command center state and handlers
 */
export const useCommandCenter = ({ currentUser }) => {
  const [commandCenterStatus, setCommandCenterStatus] = useState('idle'); // idle, saving, success, error
  const [lastSavedClient, setLastSavedClient] = useState(null);

  /**
   * Save portfolio architect data to the Client Command Center
   * @param {object} scenarioState - Current scenario state to save
   * @param {string} clientId - The client ID in the command center (must be provided or derived from clientInfo)
   * @returns {Promise<{success: boolean, message: string}>} Result
   */
  const saveToCommandCenter = useCallback(async (scenarioState, clientId = null) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq } = scenarioState;

    if (!currentUser) {
      return { success: false, message: 'You must be logged in to save to the Client Command Center.' };
    }

    if (!commandCenterDb) {
      return { success: false, message: 'Client Command Center database not connected.' };
    }

    // Use provided clientId, or derive from client email/name
    const resolvedClientId = clientId || clientInfo.email || clientInfo.name;
    if (!resolvedClientId) {
      return { success: false, message: 'Client email or name is required to save to the Command Center.' };
    }

    // Sanitize client ID for Firestore document path
    const safeClientId = resolvedClientId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    setCommandCenterStatus('saving');

    // Structure the data for the Command Center
    const portfolioArchitectData = {
      // Client Demographics
      clientInfo: {
        name: clientInfo.name || '',
        email: clientInfo.email || '',
        phone: clientInfo.phone || '',
        currentAge: clientInfo.currentAge || 55,
        retirementAge: clientInfo.retirementAge || 65,
        currentPortfolio: clientInfo.currentPortfolio || 0,
        annualSavings: clientInfo.annualSavings || 0,
        maritalStatus: clientInfo.maritalStatus || (clientInfo.isMarried ? 'married' : 'single'),
        alreadyRetired: clientInfo.alreadyRetired || clientInfo.isRetired || false,
        // Partner info if married
        ...((clientInfo.maritalStatus === 'married' || clientInfo.isMarried) && {
          partnerCurrentAge: clientInfo.partnerCurrentAge || clientInfo.partnerAge || 55,
          partnerRetirementAge: clientInfo.partnerRetirementAge || 65,
          partnerCurrentPortfolio: clientInfo.partnerCurrentPortfolio || 0,
          partnerAnnualSavings: clientInfo.partnerAnnualSavings || 0,
          partnerAlreadyRetired: clientInfo.partnerAlreadyRetired || clientInfo.partnerIsRetired || false
        })
      },

      // Financial Inputs
      inputs: {
        totalPortfolio: inputs.totalPortfolio || 0,
        monthlySpending: inputs.monthlySpending || 0,
        inflationRate: inputs.inflationRate || 2.5,
        // Social Security
        ssPIA: inputs.ssPIA || 0,
        ssStartAge: inputs.ssStartAge || 67,
        partnerSSPIA: inputs.partnerSSPIA || 0,
        partnerSSStartAge: inputs.partnerSSStartAge || 67,
        // Pension
        monthlyPension: inputs.monthlyPension || 0,
        pensionStartAge: inputs.pensionStartAge || 65,
        pensionCOLA: inputs.pensionCOLA || false,
        partnerMonthlyPension: inputs.partnerMonthlyPension || 0,
        partnerPensionStartAge: inputs.partnerPensionStartAge || 65,
        partnerPensionCOLA: inputs.partnerPensionCOLA || false,
        // Additional Incomes
        additionalIncomes: inputs.additionalIncomes || []
      },

      // Bucket Strategy Assumptions (nested objects with return, stdDev, name, historical)
      assumptions: {
        b1: assumptions.b1 || { return: 2.0, stdDev: 2.0, name: "Short Term" },
        b2: assumptions.b2 || { return: 4.0, stdDev: 5.0, name: "Mid Term" },
        b3: assumptions.b3 || { return: 5.5, stdDev: 8.0, name: "Balanced 60/40" },
        b4: assumptions.b4 || { return: 6.0, stdDev: 12.0, name: "Inc & Growth" },
        b5: assumptions.b5 || { return: 8.0, stdDev: 18.0, name: "Long Term" }
      },

      // Planning Parameters
      targetMaxPortfolioAge: targetMaxPortfolioAge || 80,
      rebalanceFreq: rebalanceFreq || 3,

      // Metadata
      source: 'portfolio-architect',
      advisorId: currentUser.uid,
      advisorEmail: currentUser.email || '',
      savedAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      const docRef = doc(
        commandCenterDb,
        'advisorProfiles',
        currentUser.uid,
        'clients',
        safeClientId,
        'portfolioArchitect',
        'current'
      );

      // Check if document exists to preserve createdAt
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        portfolioArchitectData.createdAt = existingDoc.data().createdAt;
      } else {
        portfolioArchitectData.createdAt = Date.now();
      }

      await setDoc(docRef, portfolioArchitectData);

      setCommandCenterStatus('success');
      setLastSavedClient(resolvedClientId);
      setTimeout(() => setCommandCenterStatus('idle'), 2000);

      return {
        success: true,
        message: `Saved to Client Command Center for ${clientInfo.name || resolvedClientId}`,
        clientId: safeClientId
      };
    } catch (error) {
      console.error('Error saving to Command Center:', error);
      setCommandCenterStatus('error');
      setTimeout(() => setCommandCenterStatus('idle'), 3000);

      if (error.code === 'permission-denied') {
        return {
          success: false,
          message: 'Permission denied. Check Firestore rules for The One Process project.'
        };
      }
      return { success: false, message: error.message };
    }
  }, [currentUser]);

  /**
   * Check if a client exists in the Command Center
   * @param {string} clientId - The client ID to check
   * @returns {Promise<boolean>} Whether the client exists
   */
  const checkClientExists = useCallback(async (clientId) => {
    if (!currentUser || !commandCenterDb || !clientId) return false;

    const safeClientId = clientId.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

    try {
      const docRef = doc(
        commandCenterDb,
        'advisorProfiles',
        currentUser.uid,
        'clients',
        safeClientId
      );
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('Error checking client existence:', error);
      return false;
    }
  }, [currentUser]);

  return {
    // State
    commandCenterStatus,
    lastSavedClient,
    isCommandCenterConnected: !!commandCenterDb,

    // Actions
    saveToCommandCenter,
    checkClientExists
  };
};

export default useCommandCenter;
