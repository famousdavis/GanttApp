// Projects Tab component with form and list

import { useProjects } from './useProjects';
import { useAppData } from '../../context/AppDataContext';
import { exportData as exportDataUtil, parseImportedData, readFileAsText } from '../../shared/utils';
import { isProjectNameValid } from '../../shared/utils';
import { formatDateMDY } from '../../shared/utils';
import { DragHandle } from '../../shared/components/DragHandle';
import { TabType } from '../../shared/types';

interface ProjectsTabProps {
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  setActiveTab: (tab: TabType) => void;
  draggedProjectId: string | null;
  onProjectDragStart: (id: string) => void;
  onProjectDragOver: (e: React.DragEvent, id: string) => void;
  onProjectDragEnd: () => void;
}

export function ProjectsTab({
  selectedProjectId,
  setSelectedProjectId,
  setActiveTab,
  draggedProjectId,
  onProjectDragStart,
  onProjectDragOver,
  onProjectDragEnd
}: ProjectsTabProps) {
  const { data, updateData } = useAppData();
  const {
    projectName,
    setProjectName,
    projectFinishDate,
    setProjectFinishDate,
    editingProjectId,
    addProject,
    updateProject,
    deleteProject,
    startEditProject,
    cancelEditProject
  } = useProjects();

  const handleExport = () => {
    exportDataUtil(data);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await readFileAsText(file);
      const imported = parseImportedData(content);

      if (imported) {
        updateData(imported);
        if (imported.projects.length > 0) {
          setSelectedProjectId(imported.projects[0].id);
        }
        alert('Data imported successfully!');
      } else {
        alert('Invalid file format');
      }
    } catch (error) {
      alert('Error importing file');
      console.error(error);
    }

    // Reset file input
    event.target.value = '';
  };

  const isValid = isProjectNameValid(projectName);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', color: '#333' }}>Projects</h2>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={handleExport}
            disabled={data.projects.length === 0}
            style={{
              padding: '0.5rem 1rem',
              background: data.projects.length === 0 ? '#ccc' : '#00c9a7',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: data.projects.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            📥 Export Data
          </button>
          <label style={{
            padding: '0.5rem 1rem',
            background: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem'
          }}>
            📤 Import Data
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px' }}>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 auto' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#555' }}>
              Project Name
            </label>
            <input
              type="text"
              placeholder="Project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (editingProjectId ? updateProject() : addProject(selectedProjectId, setSelectedProjectId))}
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #ddd',
                borderRadius: '4px',
                width: '400px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: '600', color: '#555' }}>
              Project Finish Date (Optional)
            </label>
            <input
              type="date"
              value={projectFinishDate}
              onChange={(e) => setProjectFinishDate(e.target.value)}
              style={{
                padding: '0.75rem',
                fontSize: '1rem',
                border: '2px solid #ddd',
                borderRadius: '4px',
                width: '180px'
              }}
            />
          </div>
        </div>
        <div>
          {editingProjectId ? (
            <>
              <button
                onClick={updateProject}
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
                Update
              </button>
              <button
                onClick={cancelEditProject}
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
              onClick={() => addProject(selectedProjectId, setSelectedProjectId)}
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
              Add Project
            </button>
          )}
        </div>
      </div>

      {data.projects.length === 0 ? (
        <p style={{ color: '#999', fontStyle: 'italic' }}>No projects yet. Add one to get started!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {data.projects.map(project => (
            <div
              key={project.id}
              draggable
              onDragStart={() => onProjectDragStart(project.id)}
              onDragOver={(e) => onProjectDragOver(e, project.id)}
              onDragEnd={onProjectDragEnd}
              style={{
                padding: '1rem',
                background: 'white',
                border: '2px solid #eee',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: draggedProjectId === project.id ? 'grabbing' : 'grab',
                opacity: draggedProjectId === project.id ? 0.5 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <DragHandle />
                <div>
                  <strong style={{ fontSize: '1.1rem' }}>{project.name}</strong>
                  <span style={{ marginLeft: '1rem', color: '#999', fontSize: '0.9rem' }}>
                    ({data.releases.filter(r => r.projectId === project.id).length} releases
                    {project.finishDate && `, finish: ${formatDateMDY(project.finishDate)}`})
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => {
                    setSelectedProjectId(project.id);
                    setActiveTab('releases');
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  View Releases
                </button>
                <button
                  onClick={() => startEditProject(project)}
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
                    if (confirm(`Delete project "${project.name}"? This will also delete all its releases.`)) {
                      deleteProject(project.id, selectedProjectId, setSelectedProjectId);
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
