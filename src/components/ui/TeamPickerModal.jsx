import React, { useState } from 'react';
import { Users, X } from 'lucide-react';

export const TeamPickerModal = ({
  teams = [],
  title = 'Select a team',
  message = 'Which team should this belong to?',
  defaultTeamId = null,
  onSelect,
  onClose,
}) => {
  // Guard: if defaultTeamId isn't actually in the team list (stale / team membership changed),
  // start with no selection so the user is forced to pick a valid one.
  const [selectedId, setSelectedId] = useState(
    teams.some((t) => t.id === defaultTeamId) ? defaultTeamId : null
  );

  const handleConfirm = () => {
    const team = teams.find((t) => t.id === selectedId);
    if (team) onSelect(team);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-mwm-green/60" />
            <h2 className="text-base font-bold">{title}</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-600">{message}</p>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedId(team.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedId === team.id
                    ? 'border-mwm-green bg-mwm-green/10'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="font-medium text-slate-800">{team.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 p-4 bg-slate-50 border-t border-slate-200">
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-all"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="flex-1 px-4 py-2 text-sm bg-mwm-green/80 text-white rounded-lg font-medium hover:bg-mwm-emerald transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamPickerModal;
