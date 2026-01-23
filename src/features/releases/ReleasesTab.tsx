// Releases Tab component with form and list

import { useReleases } from './useReleases';
import { useAppData } from '../../context/AppDataContext';
import { isReleaseValid, getDateErrorMessage } from '../../shared/utils';
import { DragHandle } from '../../shared/components/DragHandle';

interface ReleasesTabProps {
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  draggedReleaseId: string | null;
  onReleaseDragStart: (id: string) => void;
  onReleaseDragOver: (e: React.DragEvent, id: string) => void;
  onReleaseDragEnd: () => void;
}

export function ReleasesTab({
  selectedProjectId,
  setSelectedProjectId,
  draggedReleaseId,
  onReleaseDragStart,
  onReleaseDragOver,
  onReleaseDragEnd
}: ReleasesTabProps) {
  const { data } = useAppData();
  const {
    releaseName,
    setReleaseName,
    startDate,
    setStartDate,
    earlyFinish,
    setEarlyFinish,
    lateFinish,
    setLateFinish,
    editingReleaseId,
    touchedFields,
    setTouchedFields,
    addRelease,
    updateRelease,
    deleteRelease,
    startEditRelease,
    clearReleaseForm,
    toggleReleaseHidden,
    toggleReleaseCompleted
  } = useReleases();

  const currentReleases = data.releases.filter(r => r.projectId === selectedProjectId);
  const selectedProject = data.projects.find(p => p.id === selectedProjectId);
  const isValid = isReleaseValid(releaseName, startDate, earlyFinish, lateFinish);
  const errorMessage = getDateErrorMessage(startDate, earlyFinish, lateFinish, touchedFields);

  if (data.projects.length === 0) {
    return <p style={{ color: '#999', fontStyle: 'italic' }}>No projects yet. Create a project first!</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontSize: '1rem', fontWeight: '600', marginRight: '1rem' }}>
          Project:
        </label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{
            padding: '0.5rem',
            fontSize: '1rem',
            border: '2px solid #ddd',
            borderRadius: '4px',
            minWidth: '300px'
          }}
        >
          {data.projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>
        Releases for {selectedProject?.name}
      </h2>

      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#555' }}>
              Release Name
            </label>
            <input
              type="text"
              placeholder="Release name"
              value={releaseName}
              onChange={(e) => setReleaseName(e.target.value)}
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #ddd',
                borderRadius: '4px',
                width: '100%'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#555' }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const date = e.target.value;
                // Only validate if it's empty or a complete date (length 10: YYYY-MM-DD)
                if (date === '' || date.length !== 10 || (date >= '2000-01-01' && date <= '2050-12-31')) {
                  setStartDate(date);
                }
              }}
              onBlur={() => setTouchedFields(prev => ({ ...prev, startDate: true }))}
              min="2000-01-01"
              max="2050-12-31"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #ddd',
                borderRadius: '4px',
                width: '100%'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#555' }}>
              Early Finish Date
            </label>
            <input
              type="date"
              value={earlyFinish}
              onChange={(e) => {
                const date = e.target.value;
                // Only validate if it's empty or a complete date (length 10: YYYY-MM-DD)
                if (date === '' || date.length !== 10 || (date >= '2000-01-01' && date <= '2050-12-31')) {
                  setEarlyFinish(date);
                  setTouchedFields(prev => ({ ...prev, earlyFinish: false }));
                }
              }}
              onBlur={() => setTouchedFields(prev => ({ ...prev, earlyFinish: true }))}
              min="2000-01-01"
              max="2050-12-31"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #ddd',
                borderRadius: '4px',
                width: '100%'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#555' }}>
              Late Finish Date
            </label>
            <input
              type="date"
              value={lateFinish}
              onChange={(e) => {
                const date = e.target.value;
                // Only validate if it's empty or a complete date (length 10: YYYY-MM-DD)
                if (date === '' || date.length !== 10 || (date >= '2000-01-01' && date <= '2050-12-31')) {
                  setLateFinish(date);
                  setTouchedFields(prev => ({ ...prev, lateFinish: false }));
                }
              }}
              onBlur={() => setTouchedFields(prev => ({ ...prev, lateFinish: true }))}
              min="2000-01-01"
              max="2050-12-31"
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #ddd',
                borderRadius: '4px',
                width: '100%'
              }}
            />
          </div>
        </div>

        {errorMessage && (
          <div style={{
            color: '#dc3545',
            fontSize: '0.9rem',
            marginBottom: '0.75rem',
            padding: '0.5rem',
            background: '#f8d7da',
            borderRadius: '4px',
            border: '1px solid #f5c6cb'
          }}>
            {errorMessage}
          </div>
        )}

        {editingReleaseId ? (
          <>
            <button
              onClick={updateRelease}
              disabled={!isValid}
              style={{
                padding: '0.75rem 1.5rem',
                background: isValid ? '#00c9a7' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isValid ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                marginRight: '0.5rem',
                opacity: isValid ? 1 : 0.6
              }}
            >
              Update Release
            </button>
            <button
              onClick={clearReleaseForm}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#999',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => addRelease(selectedProjectId)}
            disabled={!isValid}
            style={{
              padding: '0.75rem 1.5rem',
              background: isValid ? '#0070f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isValid ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              opacity: isValid ? 1 : 0.6
            }}
          >
            Add Release
          </button>
        )}
      </div>

      {currentReleases.length === 0 ? (
        <p style={{ color: '#999', fontStyle: 'italic' }}>No releases yet. Add one to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {currentReleases.map(release => (
            <div
              key={release.id}
              draggable
              onDragStart={() => onReleaseDragStart(release.id)}
              onDragOver={(e) => onReleaseDragOver(e, release.id)}
              onDragEnd={onReleaseDragEnd}
              style={{
                padding: '1rem',
                background: 'white',
                border: '2px solid #eee',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: draggedReleaseId === release.id ? 'grabbing' : 'grab',
                opacity: draggedReleaseId === release.id ? 0.5 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <DragHandle />
                <div>
                  <strong style={{ fontSize: '1.1rem', display: 'block', marginBottom: '0.5rem' }}>
                    {release.name}
                  </strong>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    <span>Start: {(() => {
                      const [y, m, d] = release.startDate.split('-').map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString();
                    })()}</span>
                    <span style={{ margin: '0 1rem' }}>|</span>
                    <span>Early: {(() => {
                      const [y, m, d] = release.earlyFinishDate.split('-').map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString();
                    })()}</span>
                    <span style={{ margin: '0 1rem' }}>|</span>
                    <span>Late: {(() => {
                      const [y, m, d] = release.lateFinishDate.split('-').map(Number);
                      return new Date(y, m - 1, d).toLocaleDateString();
                    })()}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  background: release.hidden ? '#f0f0f0' : 'transparent'
                }}>
                  <input
                    type="checkbox"
                    checked={!release.hidden}
                    onChange={() => toggleReleaseHidden(release.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Show</span>
                </label>
                <button
                  onClick={() => toggleReleaseCompleted(release.id)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: release.completed ? '#d4edda' : '#fff',
                    border: release.completed ? '1px solid #28a745' : '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: release.completed ? '600' : 'normal'
                  }}
                >
                  {release.completed ? '✓ Done' : 'Mark Done'}
                </button>
                <button
                  onClick={() => startEditRelease(release)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete release "${release.name}"?`)) {
                      deleteRelease(release.id);
                    }
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f8d7da',
                    border: '1px solid #dc3545',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
