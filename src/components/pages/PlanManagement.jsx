import React, { useState, useMemo } from 'react';
import {
  Search, Trash2, UserCheck, Users, FileText, Calendar, Mail, Phone,
  ChevronDown, ChevronUp, Filter, RefreshCw, AlertCircle, Loader,
  DollarSign, TrendingUp, LogOut, UserPlus, X, Check, ArrowLeft
} from 'lucide-react';

import { COLORS, LOGO_URL } from '../../constants';
import { Card, Disclaimer } from '../ui';

/**
 * Plan Management Page - For advisors to view and manage all client plans
 */
export const PlanManagement = ({
  userRole,
  currentUser,
  savedScenarios,
  isLoadingScenarios,
  onLoadScenario,
  onDeleteScenario,
  onReassignScenario,
  onRefreshScenarios,
  onLogout,
  onBackToPlanning,
  // Advisors management
  advisors = [],
  isLoadingAdvisors,
  onAddAdvisor,
  onDeleteAdvisor,
  onRefreshAdvisors
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterType, setFilterType] = useState('all'); // all, submissions, advisor, progress
  const [selectedPlans, setSelectedPlans] = useState([]);
  const [reassignAdvisor, setReassignAdvisor] = useState('');
  const [assigningPlanId, setAssigningPlanId] = useState(null);
  const [newAdvisorEmail, setNewAdvisorEmail] = useState(''); // For reassignment
  const [showAddAdvisor, setShowAddAdvisor] = useState(false);
  const [newAdvisorName, setNewAdvisorName] = useState('');
  const [addAdvisorEmail, setAddAdvisorEmail] = useState(''); // For Add Advisor form
  const [addAdvisorError, setAddAdvisorError] = useState('');
  const [isAddingAdvisor, setIsAddingAdvisor] = useState(false);
  const [showManageAdvisors, setShowManageAdvisors] = useState(false);

  // Filter and sort scenarios
  const filteredScenarios = useMemo(() => {
    let filtered = [...savedScenarios];

    // Apply type filter
    if (filterType === 'submissions') {
      filtered = filtered.filter(s => s.isClientSubmission);
    } else if (filterType === 'progress') {
      filtered = filtered.filter(s => s.advisorId === 'CLIENT_PROGRESS');
    } else if (filterType === 'advisor') {
      filtered = filtered.filter(s => s.advisorId !== 'CLIENT_SUBMISSION' && s.advisorId !== 'CLIENT_PROGRESS');
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.clientInfo?.name?.toLowerCase().includes(term) ||
        s.clientInfo?.email?.toLowerCase().includes(term) ||
        s.clientInfo?.phone?.includes(term) ||
        s.advisorEmail?.toLowerCase().includes(term)
      );
    }

    // Apply sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'name':
          aVal = a.clientInfo?.name || '';
          bVal = b.clientInfo?.name || '';
          break;
        case 'email':
          aVal = a.clientInfo?.email || '';
          bVal = b.clientInfo?.email || '';
          break;
        case 'advisor':
          aVal = a.advisorEmail || '';
          bVal = b.advisorEmail || '';
          break;
        case 'portfolio':
          aVal = a.inputs?.totalPortfolio || 0;
          bVal = b.inputs?.totalPortfolio || 0;
          break;
        default:
          aVal = a.updatedAt || 0;
          bVal = b.updatedAt || 0;
      }
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return filtered;
  }, [savedScenarios, searchTerm, sortField, sortDirection, filterType]);

  // Handle sort toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Handle select all
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedPlans(filteredScenarios.map(s => s.id));
    } else {
      setSelectedPlans([]);
    }
  };

  // Handle individual select
  const handleSelectPlan = (id) => {
    setSelectedPlans(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (!selectedPlans.length) return;
    if (!confirm(`Are you sure you want to delete ${selectedPlans.length} plan(s)?`)) return;

    for (const id of selectedPlans) {
      await onDeleteScenario({ stopPropagation: () => {} }, id, true); // skipConfirm = true for bulk
    }
    setSelectedPlans([]);
  };

  // Handle bulk reassign
  const handleBulkReassign = async () => {
    const targetAdvisor = reassignAdvisor || newAdvisorEmail;
    if (!selectedPlans.length || !targetAdvisor) return;
    if (!confirm(`Reassign ${selectedPlans.length} plan(s) to ${targetAdvisor}?`)) return;

    for (const id of selectedPlans) {
      await onReassignScenario(id, targetAdvisor, targetAdvisor);
    }
    setSelectedPlans([]);
    setReassignAdvisor('');
    setNewAdvisorEmail('');
  };

  // Handle individual plan assignment
  const handleAssignPlan = async (planId, advisorEmail) => {
    if (!advisorEmail) return;
    await onReassignScenario(planId, advisorEmail, advisorEmail);
    setAssigningPlanId(null);
    setNewAdvisorEmail('');
  };

  // Handle adding new advisor
  const handleAddAdvisor = async () => {
    if (!newAdvisorName || !addAdvisorEmail) return;
    setAddAdvisorError('');
    setIsAddingAdvisor(true);
    try {
      const success = await onAddAdvisor(newAdvisorName, addAdvisorEmail);
      if (success) {
        setNewAdvisorName('');
        setAddAdvisorEmail('');
        setShowAddAdvisor(false);
      } else {
        setAddAdvisorError('Failed to add advisor. Please try again.');
      }
    } catch (error) {
      console.error('Error adding advisor:', error);
      setAddAdvisorError('An error occurred while adding the advisor.');
    } finally {
      setIsAddingAdvisor(false);
    }
  };

  // Get advisor name by email
  const getAdvisorName = (email) => {
    if (!email) return 'Unassigned';
    const advisor = advisors.find(a => a.email?.toLowerCase() === email?.toLowerCase());
    return advisor?.name || email;
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status badge
  const getStatusBadge = (scenario) => {
    if (scenario.isClientSubmission) {
      return <span className="px-2 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full">New Lead</span>;
    }
    if (scenario.advisorId === 'CLIENT_PROGRESS') {
      return <span className="px-2 py-1 text-xs font-bold bg-yellow-100 text-yellow-700 rounded-full">In Progress</span>;
    }
    return <span className="px-2 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-full">Saved</span>;
  };

  // Stats
  const stats = useMemo(() => ({
    total: savedScenarios.length,
    submissions: savedScenarios.filter(s => s.isClientSubmission).length,
    inProgress: savedScenarios.filter(s => s.advisorId === 'CLIENT_PROGRESS').length,
    totalPortfolio: savedScenarios.reduce((sum, s) => sum + (s.inputs?.totalPortfolio || 0), 0)
  }), [savedScenarios]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 p-3 sm:p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4 sm:mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={LOGO_URL} alt="Logo" className="h-10 sm:h-12 md:h-[72px] w-auto object-contain" />
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">Plan Management</h1>
              <p className="text-slate-500 text-xs sm:text-sm">
                {userRole === 'master' ? 'All Plans (Master View)' : 'Your Client Plans'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {userRole === 'master' && (
              <button
                onClick={() => setShowManageAdvisors(!showManageAdvisors)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all text-xs sm:text-sm"
              >
                <Users className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">{showManageAdvisors ? 'Hide' : 'Manage'}</span> Advisors
              </button>
            )}
            <button
              onClick={onBackToPlanning}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all text-xs sm:text-sm"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Back to</span> Planning
            </button>
            <button
              onClick={() => { onRefreshScenarios(); onRefreshAdvisors && onRefreshAdvisors(); }}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all text-xs sm:text-sm"
            >
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Refresh</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-all text-xs sm:text-sm"
            >
              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                <p className="text-xs text-slate-500">Total Plans</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700">{stats.submissions}</p>
                <p className="text-xs text-slate-500">New Leads</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-700">{stats.inProgress}</p>
                <p className="text-xs text-slate-500">In Progress</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700">${(stats.totalPortfolio / 1000000).toFixed(1)}M</p>
                <p className="text-xs text-slate-500">Total AUM</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Manage Advisors Panel */}
        {showManageAdvisors && userRole === 'master' && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-5 h-5" /> Advisor Directory
              </h3>
              <button
                onClick={() => setShowAddAdvisor(!showAddAdvisor)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all"
              >
                <UserPlus className="w-4 h-4" /> Add Advisor
              </button>
            </div>

            {/* Add Advisor Form */}
            {showAddAdvisor && (
              <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-3">Add New Advisor</h4>
                {addAdvisorError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {addAdvisorError}
                  </div>
                )}
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                    <input
                      type="text"
                      placeholder="John Smith"
                      value={newAdvisorName}
                      onChange={(e) => { setNewAdvisorName(e.target.value); setAddAdvisorError(''); }}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="john@example.com"
                      value={addAdvisorEmail}
                      onChange={(e) => { setAddAdvisorEmail(e.target.value); setAddAdvisorError(''); }}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddAdvisor}
                      disabled={!newAdvisorName || !addAdvisorEmail || isAddingAdvisor}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isAddingAdvisor ? (
                        <>Saving...</>
                      ) : (
                        <><Check className="w-4 h-4" /> Save</>
                      )}
                    </button>
                    <button
                      onClick={() => { setShowAddAdvisor(false); setNewAdvisorName(''); setAddAdvisorEmail(''); setAddAdvisorError(''); }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Advisors List */}
            {advisors.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No advisors added yet. Click "Add Advisor" to get started.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {advisors.map(advisor => (
                  <div
                    key={advisor.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition-all"
                  >
                    <div>
                      <p className="font-medium text-slate-800">{advisor.name}</p>
                      <p className="text-xs text-slate-500">{advisor.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm(`Delete advisor "${advisor.name}"?`)) {
                          onDeleteAdvisor(advisor.id);
                        }
                      }}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-all"
                      title="Delete Advisor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Filters and Search */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filterType === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                All ({savedScenarios.length})
              </button>
              <button
                onClick={() => setFilterType('submissions')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filterType === 'submissions' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
              >
                New Leads ({stats.submissions})
              </button>
              <button
                onClick={() => setFilterType('progress')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filterType === 'progress' ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'}`}
              >
                In Progress ({stats.inProgress})
              </button>
              <button
                onClick={() => setFilterType('advisor')}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${filterType === 'advisor' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
              >
                Advisor Saved
              </button>
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedPlans.length > 0 && (
            <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-slate-600">
                {selectedPlans.length} selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-4 h-4" /> Delete Selected
              </button>
              {userRole === 'master' && (
                <div className="flex items-center gap-2">
                  <select
                    value={reassignAdvisor}
                    onChange={(e) => setReassignAdvisor(e.target.value)}
                    className="text-sm border rounded-lg px-2 py-1.5"
                  >
                    <option value="">Select advisor...</option>
                    {advisors.map(a => (
                      <option key={a.id} value={a.email}>{a.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleBulkReassign}
                    disabled={!reassignAdvisor}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <UserPlus className="w-4 h-4" /> Assign Selected
                  </button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Plans Table */}
        <Card className="overflow-hidden">
          {isLoadingScenarios ? (
            <div className="flex items-center justify-center p-12">
              <Loader className="w-8 h-8 animate-spin text-emerald-600" />
              <span className="ml-3 text-slate-500">Loading plans...</span>
            </div>
          ) : filteredScenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mb-4 text-slate-300" />
              <p className="text-lg font-medium">No plans found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedPlans.length === filteredScenarios.length && filteredScenarios.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded"
                      />
                    </th>
                    <th className="p-3 text-left">
                      <button onClick={() => handleSort('name')} className="flex items-center gap-1 font-bold text-slate-600 hover:text-slate-800">
                        Client {sortField === 'name' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button onClick={() => handleSort('email')} className="flex items-center gap-1 font-bold text-slate-600 hover:text-slate-800">
                        Contact {sortField === 'email' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button onClick={() => handleSort('portfolio')} className="flex items-center gap-1 font-bold text-slate-600 hover:text-slate-800">
                        Portfolio {sortField === 'portfolio' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                      </button>
                    </th>
                    {userRole === 'master' && (
                      <th className="p-3 text-left">
                        <button onClick={() => handleSort('advisor')} className="flex items-center gap-1 font-bold text-slate-600 hover:text-slate-800">
                          Assigned To {sortField === 'advisor' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                        </button>
                      </th>
                    )}
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">
                      <button onClick={() => handleSort('updatedAt')} className="flex items-center gap-1 font-bold text-slate-600 hover:text-slate-800">
                        Updated {sortField === 'updatedAt' && (sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
                      </button>
                    </th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScenarios.map((scenario) => (
                    <tr
                      key={scenario.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => onLoadScenario(scenario)}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedPlans.includes(scenario.id)}
                          onChange={() => handleSelectPlan(scenario.id)}
                          className="w-4 h-4 rounded"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{scenario.clientInfo?.name || 'Unnamed'}</div>
                        <div className="text-xs text-slate-500">Age {scenario.clientInfo?.currentAge || '-'}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-slate-600">
                          <Mail className="w-3 h-3" /> {scenario.clientInfo?.email || '-'}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="w-3 h-3" /> {scenario.clientInfo?.phone || '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-emerald-700">
                          ${((scenario.inputs?.totalPortfolio || 0) / 1000000).toFixed(2)}M
                        </div>
                        <div className="text-xs text-slate-500">
                          ${(scenario.inputs?.monthlySpending || 0).toLocaleString()}/mo
                        </div>
                      </td>
                      {userRole === 'master' && (
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={scenario.advisorEmail || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value) {
                                handleAssignPlan(scenario.id, value);
                              }
                            }}
                            className="text-xs border rounded px-2 py-1.5 bg-white min-w-[160px] focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Unassigned</option>
                            {advisors.map(a => (
                              <option key={a.id} value={a.email}>{a.name}</option>
                            ))}
                          </select>
                        </td>
                      )}
                      <td className="p-3">
                        {getStatusBadge(scenario)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3 h-3" />
                          {formatDate(scenario.updatedAt)}
                        </div>
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => onDeleteScenario(e, scenario.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Disclaimer />
      </div>
    </div>
  );
};

export default PlanManagement;
