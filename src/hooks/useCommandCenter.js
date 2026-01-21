import { useState, useCallback, useEffect } from 'react';
import { doc, setDoc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
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
  const [commandCenterClients, setCommandCenterClients] = useState([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [commandCenterAdvisorId, setCommandCenterAdvisorId] = useState(null);

  // Fetch clients from Command Center when user changes
  // We need to find the advisor profile by email since UIDs differ between Firebase projects
  useEffect(() => {
    if (!currentUser || !commandCenterDb || !currentUser.email) {
      setCommandCenterClients([]);
      setCommandCenterAdvisorId(null);
      return;
    }

    const fetchClients = async () => {
      setIsLoadingClients(true);
      try {
        // First, find the advisor profile by email
        const advisorProfilesRef = collection(commandCenterDb, 'advisorProfiles');
        const advisorQuery = query(advisorProfilesRef, where('email', '==', currentUser.email));
        const advisorSnapshot = await getDocs(advisorQuery);

        if (advisorSnapshot.empty) {
          console.log('No advisor profile found for email:', currentUser.email);
          setCommandCenterClients([]);
          setCommandCenterAdvisorId(null);
          setIsLoadingClients(false);
          return;
        }

        // Use the first matching advisor profile
        const advisorDoc = advisorSnapshot.docs[0];
        const advisorId = advisorDoc.id;
        setCommandCenterAdvisorId(advisorId);
        console.log('Found Command Center advisor ID:', advisorId);

        // Now fetch clients for this advisor
        const clientsRef = collection(commandCenterDb, 'advisorProfiles', advisorId, 'clients');
        const clientsSnapshot = await getDocs(clientsRef);
        const clients = [];
        clientsSnapshot.forEach((doc) => {
          const data = doc.data();
          clients.push({
            id: doc.id,
            displayName: data.displayName || data.name || 'Unknown Client',
            email: data.email || '',
            ...data
          });
        });
        // Sort by displayName
        clients.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));
        setCommandCenterClients(clients);
        console.log('Found', clients.length, 'clients');
      } catch (error) {
        console.error('Error fetching Command Center clients:', error);
        setCommandCenterClients([]);
        setCommandCenterAdvisorId(null);
      } finally {
        setIsLoadingClients(false);
      }
    };

    fetchClients();
  }, [currentUser]);

  /**
   * Save portfolio architect data to the Client Command Center
   * @param {object} scenarioState - Current scenario state to save
   * @param {string} clientId - The client ID in the command center (must be provided or derived from clientInfo)
   * @returns {Promise<{success: boolean, message: string}>} Result
   */
  const saveToCommandCenter = useCallback(async (scenarioState, clientId = null) => {
    const { clientInfo, inputs, assumptions, targetMaxPortfolioAge, rebalanceFreq, monteCarloData, basePlan } = scenarioState;

    if (!currentUser) {
      return { success: false, message: 'You must be logged in to save to the Client Command Center.' };
    }

    if (!commandCenterDb) {
      return { success: false, message: 'Client Command Center database not connected.' };
    }

    if (!commandCenterAdvisorId) {
      return { success: false, message: 'No advisor profile found in Command Center for your email. Please log in to the Command Center first to create your profile.' };
    }

    // Use provided clientId directly (from the selector)
    const resolvedClientId = clientId;
    if (!resolvedClientId) {
      return { success: false, message: 'Please select a client from the Command Center.' };
    }

    setCommandCenterStatus('saving');

    // Calculate bucket percentages for asset allocation display
    const totalPortfolio = inputs.totalPortfolio || 0;
    const b1Pct = totalPortfolio > 0 ? Math.round((basePlan?.b1Val || 0) / totalPortfolio * 100) : 0;
    const b2Pct = totalPortfolio > 0 ? Math.round((basePlan?.b2Val || 0) / totalPortfolio * 100) : 0;
    const b3Pct = totalPortfolio > 0 ? Math.round((basePlan?.b3Val || 0) / totalPortfolio * 100) : 0;
    const b4Pct = totalPortfolio > 0 ? Math.round((basePlan?.b4Val || 0) / totalPortfolio * 100) : 0;
    const b5Pct = totalPortfolio > 0 ? Math.round((basePlan?.b5Val || 0) / totalPortfolio * 100) : 0;

    // Structure the data to match Command Center's expected format
    const portfolioArchitectData = {
      // Required for Command Center query
      isActive: true,

      // Display fields expected by PortfolioSection component
      planName: `${clientInfo.name || 'Client'}'s Retirement Plan`,
      initialPortfolioValue: totalPortfolio,
      monthlyWithdrawal: inputs.monthlySpending || 0,
      currentAge: clientInfo.currentAge || 55,
      retirementAge: clientInfo.retirementAge || 65,

      // Monte Carlo results
      monteCarloResults: {
        successRate: monteCarloData?.successRate || 0,
        simulations: 500
      },

      // Asset allocation (mapped to Command Center's expected format)
      // Command Center expects: stocks, bonds, cash, alternatives
      // We'll map our buckets: B1=cash, B2=bonds, B3-B4=balanced, B5=stocks
      assetAllocation: {
        cash: b1Pct,
        bonds: b2Pct,
        stocks: b5Pct,
        alternatives: b3Pct + b4Pct
      },

      // Bucket strategy details (our actual allocation)
      bucketAllocation: {
        b1: { value: basePlan?.b1Val || 0, percent: b1Pct, name: 'Short Term (1-3 yrs)' },
        b2: { value: basePlan?.b2Val || 0, percent: b2Pct, name: 'Mid Term (4-6 yrs)' },
        b3: { value: basePlan?.b3Val || 0, percent: b3Pct, name: 'Balanced 60/40 (7-15 yrs)' },
        b4: { value: basePlan?.b4Val || 0, percent: b4Pct, name: 'Income & Growth' },
        b5: { value: basePlan?.b5Val || 0, percent: b5Pct, name: 'Long Term Growth' }
      },

      // Social Security strategy
      socialSecurityStrategy: {
        primaryStartAge: inputs.ssStartAge || 67,
        primaryMonthlyBenefit: inputs.ssPIA || 0,
        ...(clientInfo.isMarried && {
          secondaryStartAge: inputs.partnerSSStartAge || 67,
          secondaryMonthlyBenefit: inputs.partnerSSPIA || 0
        })
      },

      // Full data for potential future use
      fullData: {
        clientInfo: {
          name: clientInfo.name || '',
          email: clientInfo.email || '',
          phone: clientInfo.phone || '',
          currentAge: clientInfo.currentAge || 55,
          retirementAge: clientInfo.retirementAge || 65,
          currentPortfolio: clientInfo.currentPortfolio || 0,
          annualSavings: clientInfo.annualSavings || 0,
          isMarried: clientInfo.isMarried || false,
          isRetired: clientInfo.isRetired || clientInfo.alreadyRetired || false
        },
        inputs: {
          totalPortfolio: inputs.totalPortfolio || 0,
          monthlySpending: inputs.monthlySpending || 0,
          inflationRate: inputs.inflationRate || 2.5,
          ssPIA: inputs.ssPIA || 0,
          ssStartAge: inputs.ssStartAge || 67,
          partnerSSPIA: inputs.partnerSSPIA || 0,
          partnerSSStartAge: inputs.partnerSSStartAge || 67,
          monthlyPension: inputs.monthlyPension || 0,
          pensionStartAge: inputs.pensionStartAge || 65,
          additionalIncomes: inputs.additionalIncomes || []
        },
        assumptions: assumptions,
        targetMaxPortfolioAge: targetMaxPortfolioAge || 80,
        rebalanceFreq: rebalanceFreq || 3
      },

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
        commandCenterAdvisorId,
        'clients',
        resolvedClientId,
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
        clientId: resolvedClientId
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
  }, [currentUser, commandCenterAdvisorId]);

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
    commandCenterClients,
    isLoadingClients,

    // Actions
    saveToCommandCenter,
    checkClientExists
  };
};

export default useCommandCenter;
