import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

// Types
interface Project {
  id: string;
  name: string;
}

interface Release {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  earlyFinishDate: string;
  lateFinishDate: string;
}

interface ChartColors {
  solidBar: string;
  hatchedBar: string;
  todayLine: string;
}

interface AppData {
  projects: Project[];
  releases: Release[];
  chartColors?: ChartColors;
  activePreset?: string;
}

// Default color scheme
const DEFAULT_CHART_COLORS: ChartColors = {
  solidBar: '#0070f3',
  hatchedBar: '#0070f3',
  todayLine: '#dc3545'
};

export default function Home() {
  const [data, setData] = useState<AppData>({ projects: [], releases: [] });
  const [activeTab, setActiveTab] = useState<'projects' | 'releases' | 'chart' | 'about' | 'changelog'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [chartColors, setChartColors] = useState<ChartColors>(DEFAULT_CHART_COLORS);
  const [activePreset, setActivePreset] = useState<string | undefined>(undefined);

  const [projectName, setProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const [releaseName, setReleaseName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [earlyFinish, setEarlyFinish] = useState('');
  const [lateFinish, setLateFinish] = useState('');
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);

  // Track which date fields have been touched (user left the field)
  const [touchedFields, setTouchedFields] = useState({ startDate: false, earlyFinish: false, lateFinish: false });

  // Drag and drop state
  const [draggedProjectId, setDraggedProjectId] = useState<string | null>(null);
  const [draggedReleaseId, setDraggedReleaseId] = useState<string | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    const loadData = () => {
      try {
        const savedData = localStorage.getItem('ganttAppData');
        if (savedData) {
          const loadedData = JSON.parse(savedData) as AppData;
          setData(loadedData);
          if (loadedData.projects && loadedData.projects.length > 0) {
            setSelectedProjectId(loadedData.projects[0].id);
          }
          // Load chart colors or use defaults
          if (loadedData.chartColors) {
            setChartColors(loadedData.chartColors);
          }
          // Load active preset if it exists
          if (loadedData.activePreset) {
            setActivePreset(loadedData.activePreset);
          }
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Clear release form when switching away from releases tab (only if not editing)
  useEffect(() => {
    if (activeTab !== 'releases' && !editingReleaseId) {
      setReleaseName('');
      setStartDate('');
      setEarlyFinish('');
      setLateFinish('');
      setTouchedFields({ startDate: false, earlyFinish: false, lateFinish: false });
    }
  }, [activeTab, editingReleaseId]);

  // Clear release form when changing project selection (only if not editing)
  useEffect(() => {
    if (!editingReleaseId) {
      setReleaseName('');
      setStartDate('');
      setEarlyFinish('');
      setLateFinish('');
      setTouchedFields({ startDate: false, earlyFinish: false, lateFinish: false });
    }
  }, [selectedProjectId, editingReleaseId]);

  // Save data to localStorage
  const saveData = (newData: AppData) => {
    try {
      localStorage.setItem('ganttAppData', JSON.stringify(newData));
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const updateData = (newData: AppData) => {
    setData(newData);
    saveData(newData);
  };

  // Update chart colors and persist to localStorage
  const updateChartColors = (newColors: ChartColors, presetName?: string) => {
    setChartColors(newColors);

    // If presetName is provided, set it as active
    // If presetName is explicitly undefined/null (custom color change), clear active preset
    const newActivePreset = presetName !== undefined ? presetName : undefined;
    setActivePreset(newActivePreset);

    const newData = { ...data, chartColors: newColors, activePreset: newActivePreset };
    saveData(newData);
  };

  // Export/Import functions
  const exportData = () => {
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gantt-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);

        if (imported.projects && imported.releases && Array.isArray(imported.projects) && Array.isArray(imported.releases)) {
          updateData(imported);
          if (imported.projects.length > 0) {
            setSelectedProjectId(imported.projects[0].id);
          }
          alert('Data imported successfully!');
        } else {
          alert('Invalid file format');
        }
      } catch (err) {
        alert('Error reading file');
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Project CRUD
  const addProject = () => {
    if (!projectName.trim()) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name: projectName.trim()
    };
    const newData = { ...data, projects: [...data.projects, newProject] };
    updateData(newData);
    setProjectName('');
    if (!selectedProjectId) {
      setSelectedProjectId(newProject.id);
    }
  };

  const updateProject = () => {
    if (!projectName.trim() || !editingProjectId) return;
    const newData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === editingProjectId ? { ...p, name: projectName.trim() } : p
      )
    };
    updateData(newData);
    setProjectName('');
    setEditingProjectId(null);
  };

  const deleteProject = (id: string) => {
    const newData = {
      projects: data.projects.filter(p => p.id !== id),
      releases: data.releases.filter(r => r.projectId !== id)
    };
    updateData(newData);
    if (selectedProjectId === id) {
      const remaining = data.projects.filter(p => p.id !== id);
      setSelectedProjectId(remaining.length > 0 ? remaining[0].id : '');
    }
  };

  const startEditProject = (project: Project) => {
    setProjectName(project.name);
    setEditingProjectId(project.id);
  };

  const cancelEditProject = () => {
    setProjectName('');
    setEditingProjectId(null);
  };

  // Release CRUD
  const addRelease = () => {
    if (!releaseName.trim() || !selectedProjectId || !startDate || !earlyFinish || !lateFinish) return;

    const newRelease: Release = {
      id: Date.now().toString(),
      projectId: selectedProjectId,
      name: releaseName.trim(),
      startDate,
      earlyFinishDate: earlyFinish,
      lateFinishDate: lateFinish
    };
    const newData = { ...data, releases: [...data.releases, newRelease] };
    updateData(newData);
    clearReleaseForm();
  };

  const updateRelease = () => {
    if (!releaseName.trim() || !editingReleaseId || !startDate || !earlyFinish || !lateFinish) return;

    const newData = {
      ...data,
      releases: data.releases.map(r =>
        r.id === editingReleaseId ? {
          ...r,
          name: releaseName.trim(),
          startDate,
          earlyFinishDate: earlyFinish,
          lateFinishDate: lateFinish
        } : r
      )
    };
    updateData(newData);
    clearReleaseForm();
  };

  const deleteRelease = (id: string) => {
    const newData = {
      ...data,
      releases: data.releases.filter(r => r.id !== id)
    };
    updateData(newData);
  };

  const startEditRelease = (release: Release) => {
    setReleaseName(release.name);
    setStartDate(release.startDate);
    setEarlyFinish(release.earlyFinishDate);
    setLateFinish(release.lateFinishDate);
    setEditingReleaseId(release.id);
  };

  const clearReleaseForm = () => {
    setReleaseName('');
    setStartDate('');
    setEarlyFinish('');
    setLateFinish('');
    setEditingReleaseId(null);
    setTouchedFields({ startDate: false, earlyFinish: false, lateFinish: false });
  };

  // Drag and drop handlers for projects
  const handleProjectDragStart = (projectId: string) => {
    setDraggedProjectId(projectId);
  };

  const handleProjectDragOver = (e: React.DragEvent<HTMLDivElement>, targetProjectId: string) => {
    e.preventDefault();
    if (!draggedProjectId || draggedProjectId === targetProjectId) return;

    const draggedIndex = data.projects.findIndex(p => p.id === draggedProjectId);
    const targetIndex = data.projects.findIndex(p => p.id === targetProjectId);

    const newProjects = [...data.projects];
    const [removed] = newProjects.splice(draggedIndex, 1);
    newProjects.splice(targetIndex, 0, removed);

    const newData = { ...data, projects: newProjects };
    updateData(newData);
  };

  const handleProjectDragEnd = () => {
    setDraggedProjectId(null);
  };

  // Drag and drop handlers for releases
  const handleReleaseDragStart = (releaseId: string) => {
    setDraggedReleaseId(releaseId);
  };

  const handleReleaseDragOver = (e: React.DragEvent<HTMLDivElement>, targetReleaseId: string) => {
    e.preventDefault();
    if (!draggedReleaseId || draggedReleaseId === targetReleaseId) return;

    // Only reorder within the same project
    const draggedRelease = data.releases.find(r => r.id === draggedReleaseId);
    const targetRelease = data.releases.find(r => r.id === targetReleaseId);
    if (!draggedRelease || !targetRelease || draggedRelease.projectId !== targetRelease.projectId) return;

    const projectReleases = data.releases.filter(r => r.projectId === draggedRelease.projectId);
    const otherReleases = data.releases.filter(r => r.projectId !== draggedRelease.projectId);

    const draggedIndex = projectReleases.findIndex(r => r.id === draggedReleaseId);
    const targetIndex = projectReleases.findIndex(r => r.id === targetReleaseId);

    const newProjectReleases = [...projectReleases];
    const [removed] = newProjectReleases.splice(draggedIndex, 1);
    newProjectReleases.splice(targetIndex, 0, removed);

    const newData = { ...data, releases: [...otherReleases, ...newProjectReleases] };
    updateData(newData);
  };

  const handleReleaseDragEnd = () => {
    setDraggedReleaseId(null);
  };

  // Validation function for project name
  const isProjectNameValid = () => {
    return projectName.trim().length > 0;
  };

  // Validation function for release (all fields)
  const isReleaseValid = () => {
    // Check name
    if (releaseName.trim().length === 0) return false;

    // Check all dates filled
    if (!startDate || !earlyFinish || !lateFinish) return false;

    // Check date logic
    const start = new Date(startDate);
    const early = new Date(earlyFinish);
    const late = new Date(lateFinish);

    // Start must be before early
    if (start >= early) return false;

    // Early must be before or equal to late
    if (early > late) return false;

    return true;
  };

  // Generate user-friendly error message for dates
  const getDateErrorMessage = () => {
    // Only validate when date fields have complete values (format: YYYY-MM-DD)
    const isValidDateFormat = (dateStr: string) => {
      // Must be exactly 10 characters in YYYY-MM-DD format
      if (!dateStr || dateStr.length !== 10) return false;
      // Check format with regex
      return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    };

    // Check start vs early only when earlyFinish field has been touched AND both dates are complete
    if (touchedFields.earlyFinish && isValidDateFormat(startDate) && isValidDateFormat(earlyFinish)) {
      const start = new Date(startDate);
      const early = new Date(earlyFinish);

      if (start >= early) {
        return 'Start date must be before the Early finish date';
      }
    }

    // Check early vs late only when lateFinish field has been touched AND both dates are complete
    if (touchedFields.lateFinish && isValidDateFormat(earlyFinish) && isValidDateFormat(lateFinish)) {
      const early = new Date(earlyFinish);
      const late = new Date(lateFinish);

      if (early > late) {
        return 'Early finish date must be before or equal to the Late finish date';
      }
    }

    return '';
  };

  const currentReleases = data.releases.filter(r => r.projectId === selectedProjectId);
  const selectedProject = data.projects.find(p => p.id === selectedProjectId);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        fontSize: '1.5rem',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }
  return (
    <>
      <Head>
        <title>Gantt Chart App</title>
        <meta name="description" content="Project release planning with uncertainty visualization" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: 'calc(100vh - 100px)' }}>
        <h1 style={{
          fontSize: '2.5rem',
          fontWeight: '700',
          marginBottom: '2rem',
          background: 'linear-gradient(to right, #0070f3, #00c9a7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
          Project Release Planner
        </h1>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '2px solid #eee' }}>
          <button
            onClick={() => setActiveTab('projects')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'projects' ? '#0070f3' : 'transparent',
              color: activeTab === 'projects' ? 'white' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              borderRadius: '4px 4px 0 0',
              transition: 'all 0.2s'
            }}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveTab('releases')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'releases' ? '#0070f3' : 'transparent',
              color: activeTab === 'releases' ? 'white' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              borderRadius: '4px 4px 0 0',
              transition: 'all 0.2s'
            }}
            disabled={data.projects.length === 0}
          >
            Releases
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'chart' ? '#0070f3' : 'transparent',
              color: activeTab === 'chart' ? 'white' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              borderRadius: '4px 4px 0 0',
              transition: 'all 0.2s'
            }}
            disabled={currentReleases.length === 0}
          >
            Gantt Chart
          </button>
          <button
            onClick={() => setActiveTab('about')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'about' ? '#0070f3' : 'transparent',
              color: activeTab === 'about' ? 'white' : '#666',
              cursor: 'pointer',
              fontWeight: '600',
              borderRadius: '4px 4px 0 0',
              transition: 'all 0.2s'
            }}
          >
            About
          </button>
        </div>

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', color: '#333' }}>Projects</h2>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={exportData}
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
                    onChange={importData}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px' }}>
              <input
                type="text"
                placeholder="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (editingProjectId ? updateProject() : addProject())}
                style={{
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  width: '300px',
                  marginRight: '0.5rem'
                }}
              />
              {editingProjectId ? (
                <>
                  <button
                    onClick={updateProject}
                    disabled={!isProjectNameValid()}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: isProjectNameValid() ? '#00c9a7' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isProjectNameValid() ? 'pointer' : 'not-allowed',
                      fontWeight: '600',
                      marginRight: '0.5rem',
                      opacity: isProjectNameValid() ? 1 : 0.6
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
                  onClick={addProject}
                  disabled={!isProjectNameValid()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: isProjectNameValid() ? '#0070f3' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isProjectNameValid() ? 'pointer' : 'not-allowed',
                    fontWeight: '600',
                    opacity: isProjectNameValid() ? 1 : 0.6
                  }}
                >
                  Add Project
                </button>
              )}
            </div>

            {data.projects.length === 0 ? (
              <p style={{ color: '#999', fontStyle: 'italic' }}>No projects yet. Add one to get started!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {data.projects.map(project => (
                  <div
                    key={project.id}
                    draggable
                    onDragStart={() => handleProjectDragStart(project.id)}
                    onDragOver={(e) => handleProjectDragOver(e, project.id)}
                    onDragEnd={handleProjectDragEnd}
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
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        cursor: 'grab'
                      }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
                      </div>
                      <div>
                        <strong style={{ fontSize: '1.1rem' }}>{project.name}</strong>
                        <span style={{ marginLeft: '1rem', color: '#999', fontSize: '0.9rem' }}>
                          ({data.releases.filter(r => r.projectId === project.id).length} releases)
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
                            deleteProject(project.id);
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
        )}

        {/* Releases Tab */}
        {activeTab === 'releases' && (
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
                  minWidth: '200px'
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
                    onChange={(e) => setStartDate(e.target.value)}
                    onBlur={() => setTouchedFields(prev => ({ ...prev, startDate: true }))}
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
                      setEarlyFinish(e.target.value);
                      // Reset touched state when user is actively changing the value
                      setTouchedFields(prev => ({ ...prev, earlyFinish: false }));
                    }}
                    onBlur={() => setTouchedFields(prev => ({ ...prev, earlyFinish: true }))}
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
                      setLateFinish(e.target.value);
                      // Reset touched state when user is actively changing the value
                      setTouchedFields(prev => ({ ...prev, lateFinish: false }));
                    }}
                    onBlur={() => setTouchedFields(prev => ({ ...prev, lateFinish: true }))}
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

              {/* Validation error message */}
              {getDateErrorMessage() && (
                <div style={{
                  color: '#dc3545',
                  fontSize: '0.9rem',
                  marginBottom: '0.75rem',
                  padding: '0.5rem',
                  background: '#f8d7da',
                  borderRadius: '4px',
                  border: '1px solid #f5c6cb'
                }}>
                  {getDateErrorMessage()}
                </div>
              )}

              {editingReleaseId ? (
                <>
                  <button
                    onClick={updateRelease}
                    disabled={!isReleaseValid()}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: isReleaseValid() ? '#00c9a7' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isReleaseValid() ? 'pointer' : 'not-allowed',
                      fontWeight: '600',
                      marginRight: '0.5rem',
                      opacity: isReleaseValid() ? 1 : 0.6
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
                  onClick={addRelease}
                  disabled={!isReleaseValid()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: isReleaseValid() ? '#0070f3' : '#ccc',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isReleaseValid() ? 'pointer' : 'not-allowed',
                    fontWeight: '600',
                    opacity: isReleaseValid() ? 1 : 0.6
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
                    onDragStart={() => handleReleaseDragStart(release.id)}
                    onDragOver={(e) => handleReleaseDragOver(e, release.id)}
                    onDragEnd={handleReleaseDragEnd}
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
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        cursor: 'grab'
                      }}>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
                        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#999' }}></div>
                      </div>
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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
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
        )}

        {/* Gantt Chart Tab */}
        {activeTab === 'chart' && (
          <div>
            <GanttChart
              releases={currentReleases}
              projectName={selectedProject?.name || ''}
              chartColors={chartColors}
              onColorsChange={updateChartColors}
              activePreset={activePreset}
            />
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div style={{ maxWidth: '800px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>About This App</h2>

            <section style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Purpose</h3>
              <p style={{ lineHeight: '1.6', color: '#555' }}>
                This application helps project managers communicate release uncertainty to stakeholders.
                Traditional Gantt charts show single delivery dates, but real projects have uncertainty.
                GanttApp visualizes this by showing:
              </p>
              <ul style={{ marginTop: '0.5rem', paddingLeft: '2rem', lineHeight: '1.8' }}>
                <li><strong>Solid blue bars:</strong> Design, Code, Test phase (predictable work)</li>
                <li><strong>Hatched blue bars:</strong> Delivery uncertainty window (the "maybe" zone)</li>
              </ul>
            </section>

            <section style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Your Data & Security</h3>
              <ul style={{ paddingLeft: '2rem', lineHeight: '1.8', color: '#555' }}>
                <li>Stored locally in your <strong>browser</strong> (not in any cloud database)</li>
                <li><strong>Your data never leaves your device</strong></li>
                <li>No external servers, no third-party access, no data governance concerns</li>
                <li>Safe for corporate/organizational data - all data stays within your network</li>
                <li>Use <strong>Export</strong> to backup your data to your file system anytime</li>
                <li>Use <strong>Import</strong> to restore from a backup or share with colleagues</li>
                <li><strong>Note:</strong> If you clear your browser cache/data, you will lose all stored projects and releases unless you've exported a backup</li>
              </ul>
            </section>

            <section style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Version Updates</h3>
              <p style={{ lineHeight: '1.6', color: '#555' }}>
                When new versions are released, your data remains safe in localStorage. I recommend
                exporting a backup before major updates as a precaution.
              </p>
            </section>

            <section style={{ marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.75rem', color: '#0070f3' }}>Author & Source Code</h3>
              <p style={{ lineHeight: '1.6', color: '#555', marginBottom: '0.5rem' }}>
                Created by <strong>William W. Davis, MSPM, PMP</strong>
              </p>
              <a
                href="https://github.com/famousdavis/GanttApp"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: '#0070f3',
                  color: 'white',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  fontWeight: '600',
                  marginTop: '0.5rem'
                }}
              >
                View Source Code on GitHub
              </a>
              <p style={{ lineHeight: '1.6', color: '#555', marginTop: '1rem' }}>
                This software is open source under <strong>GNU GPL v3</strong>.
                Feel free to fork, modify, and contribute!
              </p>
            </section>
          </div>
        )}
        {/* Change Log */}
        {activeTab === 'changelog' && (
          <div style={{ maxWidth: '800px' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#333' }}>Change Log</h2>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '2rem' }}>
              A history of updates and improvements to GanttApp.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Version 3.6 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 3.6
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 19, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Revert from Firebase to localStorage for better data persistence. While Firebase provided cloud storage, anonymous authentication sessions expired unpredictably, causing data to appear lost. localStorage puts users in control - data persists until they choose to clear their browser cache. Export/Import feature provides reliable backup mechanism.
                </p>
              </div>

              {/* Version 3.5 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 3.5
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 19, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Add configurable chart colors with custom color pickers and preset themes. Active preset is visually indicated and automatically clears when custom colors are selected. Chart color settings persist to localStorage.
                </p>
              </div>

              {/* Version 3.4 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 3.4
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 19, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Add intelligent label hiding on Gantt chart to prevent overlapping date labels
                </p>
              </div>

              {/* Version 3.3 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 3.3
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 19, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Add real-time validation for project names, release names, and date logic
                </p>
              </div>

              {/* Version 3.2 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 3.2
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 19, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Add Change Log accessible via footer link
                </p>
              </div>

              {/* Version 3.1 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 3.1
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 18, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Fix timezone bug in date display
                </p>
              </div>

              {/* Version 3.0 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 3.0
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 18, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Add Firebase database, Today's Date toggle line, and About tab
                </p>
              </div>

              {/* Version 2.1 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 2.1
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 17, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Add copyright footer and GNU GPL v3 license
                </p>
              </div>

              {/* Version 2.0 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 2.0
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 17, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Add Export/Import functionality and copy chart as image
                </p>
              </div>

              {/* Version 1.0 */}
              <div>
                <h3 style={{ fontSize: '1.2rem', color: '#0070f3', marginBottom: '0.5rem' }}>
                  Version 1.0
                  <span style={{ fontSize: '0.9rem', color: '#999', marginLeft: '1rem', fontWeight: 'normal' }}>
                    January 17, 2026
                  </span>
                </h3>
                <p style={{ lineHeight: '1.6', color: '#555' }}>
                  Initial release with localStorage, Projects, Releases, and Gantt chart
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '2rem',
        marginTop: '3rem',
        borderTop: '1px solid #eee',
        fontSize: '0.9rem',
        color: '#666'
      }}>
        © 2026 William W. Davis, MSPM, PMP | <span
          onClick={() => setActiveTab('changelog')}
          style={{
            color: '#0070f3',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}
        >Version 3.6</span> | Licensed under GNU GPL v3
      </footer>
    </>
  );
}
// Standard color palette for individual color selection
const STANDARD_COLORS = [
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Blue', value: '#0070f3' },
  { name: 'Indigo', value: '#4f46e5' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Purple', value: '#9333ea' },
  { name: 'Fuchsia', value: '#d946ef' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Gray', value: '#6b7280' },
  { name: 'Slate', value: '#475569' },
  { name: 'Black', value: '#000000' }
];

// Color preset themes
const COLOR_PRESETS: { [key: string]: ChartColors } = {
  'Default': DEFAULT_CHART_COLORS,
  'Professional': { solidBar: '#2c3e50', hatchedBar: '#34495e', todayLine: '#e74c3c' },
  'Colorful': { solidBar: '#9b59b6', hatchedBar: '#3498db', todayLine: '#e67e22' },
  'Grayscale': { solidBar: '#555555', hatchedBar: '#777777', todayLine: '#333333' },
  'High Contrast': { solidBar: '#000000', hatchedBar: '#0066cc', todayLine: '#ff0000' },
  'Forest': { solidBar: '#2d5016', hatchedBar: '#56ab2f', todayLine: '#ff6b6b' },
  'Ocean': { solidBar: '#1e3a8a', hatchedBar: '#3b82f6', todayLine: '#f59e0b' },
  'Sunset': { solidBar: '#dc2626', hatchedBar: '#f97316', todayLine: '#7c2d12' },
  'Lavender': { solidBar: '#7c3aed', hatchedBar: '#a78bfa', todayLine: '#ec4899' },
  'Earth': { solidBar: '#78350f', hatchedBar: '#92400e', todayLine: '#15803d' }
};

// Color Swatch Picker Component
function ColorSwatchPicker({ value, onChange, label }: { value: string, onChange: (color: string) => void, label: string }) {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false);
      }
    };

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPicker]);

  return (
    <div style={{ position: 'relative' }} ref={pickerRef}>
      <label style={{
        display: 'block',
        marginBottom: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: '600',
        color: '#555'
      }}>
        {label}
      </label>
      <div
        onClick={() => setShowPicker(!showPicker)}
        style={{
          width: '100%',
          height: '40px',
          background: value,
          border: '2px solid #ddd',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      />

      {showPicker && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '0.5rem',
          background: 'white',
          border: '2px solid #ddd',
          borderRadius: '8px',
          padding: '1rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          zIndex: 1000,
          minWidth: '280px'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            {STANDARD_COLORS.map(color => (
              <div
                key={color.value}
                onClick={() => {
                  onChange(color.value);
                  setShowPicker(false);
                }}
                title={color.name}
                style={{
                  width: '40px',
                  height: '40px',
                  background: color.value,
                  border: value === color.value ? '3px solid #0070f3' : '2px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                  boxSizing: 'border-box'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              />
            ))}
          </div>
          <div style={{ borderTop: '1px solid #ddd', paddingTop: '0.75rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8rem',
              fontWeight: '600',
              color: '#555',
              marginBottom: '0.5rem'
            }}>
              Custom Color
            </label>
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                border: '2px solid #ddd',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Gantt Chart Component
function GanttChart({ releases, projectName, chartColors, onColorsChange, activePreset }: {
  releases: Release[],
  projectName: string,
  chartColors: ChartColors,
  onColorsChange: (colors: ChartColors, presetName?: string) => void,
  activePreset?: string
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');
  const [showTodayLine, setShowTodayLine] = useState(true);

  if (releases.length === 0) {
    return <p style={{ color: '#999', fontStyle: 'italic' }}>No releases to display.</p>;
  }

  // Calculate date range
  const allDates = releases.flatMap(r => {
    const [y1, m1, d1] = r.startDate.split('-').map(Number);
    const [y2, m2, d2] = r.lateFinishDate.split('-').map(Number);
    return [
      new Date(y1, m1 - 1, d1).getTime(),
      new Date(y2, m2 - 1, d2).getTime()
    ];
  });

  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  // Chart dimensions
  const chartWidth = 900;
  const chartHeight = releases.length * 60 + 80;
  const leftMargin = 200;
  const rightMargin = 50;
  const topMargin = 50;
  const barHeight = 30;
  const rowHeight = 60;

  const dateToX = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const timestamp = new Date(year, month - 1, day).getTime();
    const ratio = (timestamp - minDate) / dateRange;
    return leftMargin + ratio * (chartWidth - leftMargin - rightMargin);
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Calculate quarter boundaries for gridlines
  const getQuarterBoundaries = () => {
    const start = new Date(minDate);
    const end = new Date(maxDate);
    const boundaries: Date[] = [];

    let current = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);

    while (current <= end) {
      current = new Date(current.getFullYear(), current.getMonth() + 3, 1);
      if (current > start && current < end) {
        boundaries.push(new Date(current));
      }
    }

    return boundaries;
  };

  const quarterBoundaries = getQuarterBoundaries();

  // Get today's date formatted
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Check if today is within the chart range
  const todayInRange = todayTime >= minDate && todayTime <= maxDate;
  const todayX = todayInRange ? dateToX(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`) : null;
  // Copy chart as image
  const copyChartAsImage = async () => {
    if (!chartRef.current) return;

    setCopyStatus('copying');

    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setCopyStatus('error');
          setTimeout(() => setCopyStatus('idle'), 2000);
          return;
        }

        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopyStatus('success');
          setTimeout(() => setCopyStatus('idle'), 2000);
        } catch (err) {
          console.error('Clipboard error:', err);
          setCopyStatus('error');
          setTimeout(() => setCopyStatus('idle'), 2000);
        }
      }, 'image/png');

    } catch (err) {
      console.error('Capture error:', err);
      setCopyStatus('error');
      setTimeout(() => setCopyStatus('idle'), 2000);
    }
  };

  return (
    <>
      <div ref={chartRef}>
        {/* Header with project name, toggle, and date */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', color: '#333', margin: 0 }}>
          Gantt Chart: {projectName}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            color: '#666',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={showTodayLine}
              onChange={(e) => setShowTodayLine(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Today's Date
          </label>
          <span style={{ fontSize: '0.9rem', color: '#666' }}>
            Date Prepared: {todayFormatted}
          </span>
          <button
            onClick={copyChartAsImage}
            disabled={copyStatus === 'copying'}
            title="Copy chart as image"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: copyStatus === 'copying' ? 'wait' : 'pointer',
              fontSize: '1.2rem',
              padding: '0.25rem',
              opacity: 0.6,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
          >
            {copyStatus === 'copying' && '⏳'}
            {copyStatus === 'success' && '✅'}
            {copyStatus === 'error' && '❌'}
            {copyStatus === 'idle' && '📋'}
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', background: 'white', padding: '2rem', borderRadius: '8px', border: '2px solid #eee' }}>
        <svg width={chartWidth} height={chartHeight}>
          {/* Quarterly gridlines */}
          {quarterBoundaries.map((date, i) => {
            const x = dateToX(date.toISOString().split('T')[0]);
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={topMargin - 10}
                  x2={x}
                  y2={chartHeight - 20}
                  stroke="#ddd"
                  strokeWidth="1"
                  strokeDasharray="5,5"
                />
              </g>
            );
          })}

          {/* Today's date line */}
          {showTodayLine && todayInRange && todayX && (
            <line
              x1={todayX}
              y1={topMargin - 10}
              x2={todayX}
              y2={chartHeight - 20}
              stroke={chartColors.todayLine}
              strokeWidth="2"
            />
          )}

          {/* Time axis */}
          <line
            x1={leftMargin}
            y1={topMargin - 10}
            x2={chartWidth - rightMargin}
            y2={topMargin - 10}
            stroke="#333"
            strokeWidth="2"
          />

          {/* Year markers */}
          {(() => {
            const startYear = new Date(minDate).getFullYear();
            const endYear = new Date(maxDate).getFullYear();
            const years: number[] = [];

            for (let year = startYear; year <= endYear; year++) {
              years.push(year);
            }

            return years.map((year, index) => {
              let x: number;

              if (index === 0) {
                x = leftMargin + 20;
              } else {
                const jan1 = new Date(year, 0, 1).getTime();
                if (jan1 < minDate || jan1 > maxDate) return null;
                x = dateToX(new Date(year, 0, 1).toISOString().split('T')[0]);
              }

              return (
                <text
                  key={year}
                  x={x}
                  y={topMargin - 20}
                  fontSize="14"
                  fill="#333"
                  fontWeight="600"
                  textAnchor={index === 0 ? "start" : "middle"}
                >
                  {year}
                </text>
              );
            });
          })()}

          {/* Releases */}
          {releases.map((release, i) => {
            const y = topMargin + i * rowHeight;
            const startX = dateToX(release.startDate);
            const earlyX = dateToX(release.earlyFinishDate);
            const lateX = dateToX(release.lateFinishDate);

            // Label collision detection - minimum 40px spacing
            const MIN_LABEL_SPACING = 40;
            const showEarlyLabel = (earlyX - startX) >= MIN_LABEL_SPACING && (lateX - earlyX) >= MIN_LABEL_SPACING;

            return (
              <g key={release.id}>
                {/* Release name */}
                <text
                  x={10}
                  y={y + barHeight / 2 + 5}
                  fontSize="14"
                  fill="#333"
                  fontWeight="600"
                >
                  {release.name}
                </text>

                {/* Solid bar (start to early finish) */}
                <rect
                  x={startX}
                  y={y}
                  width={earlyX - startX}
                  height={barHeight}
                  fill={chartColors.solidBar}
                  rx="4"
                />

                {/* Hatched bar (early finish to late finish) */}
                <defs>
                  <pattern
                    id={`hatch-${release.id}`}
                    patternUnits="userSpaceOnUse"
                    width="8"
                    height="8"
                    patternTransform="rotate(45)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="8"
                      stroke={chartColors.hatchedBar}
                      strokeWidth="3"
                    />
                  </pattern>
                </defs>
                <rect
                  x={earlyX}
                  y={y}
                  width={lateX - earlyX}
                  height={barHeight}
                  fill={`url(#hatch-${release.id})`}
                  stroke={chartColors.hatchedBar}
                  strokeWidth="2"
                  rx="4"
                />

                {/* Date labels */}
                {/* Always show start date */}
                <text
                  x={startX}
                  y={y + barHeight + 15}
                  fontSize="11"
                  fill="#666"
                  textAnchor="middle"
                >
                  {formatDate(release.startDate)}
                </text>

                {/* Show early finish date only if there's enough spacing */}
                {showEarlyLabel && (
                  <text
                    x={earlyX}
                    y={y + barHeight + 15}
                    fontSize="11"
                    fill="#666"
                    textAnchor="middle"
                  >
                    {formatDate(release.earlyFinishDate)}
                  </text>
                )}

                {/* Always show late finish date */}
                <text
                  x={lateX}
                  y={y + barHeight + 15}
                  fontSize="11"
                  fill="#666"
                  textAnchor="middle"
                >
                  {formatDate(release.lateFinishDate)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '30px', height: '20px', background: chartColors.solidBar, borderRadius: '4px' }}></div>
            <span>Design, Code, Test</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="30" height="20">
              <defs>
                <pattern
                  id="legend-hatch"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="8" stroke={chartColors.hatchedBar} strokeWidth="3" />
                </pattern>
              </defs>
              <rect width="30" height="20" fill="url(#legend-hatch)" stroke={chartColors.hatchedBar} strokeWidth="2" rx="4" />
            </svg>
            <span>Delivery Uncertainty</span>
          </div>
          {showTodayLine && todayInRange && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '30px', height: '2px', background: chartColors.todayLine }}></div>
              <span>Today</span>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Chart Color Settings - Outside chartRef so not included in copy-to-image */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#f9f9f9',
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#333' }}>Chart Colors</h3>

        {/* Color Pickers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <ColorSwatchPicker
            label="Solid Bars"
            value={chartColors.solidBar}
            onChange={(color) => onColorsChange({ ...chartColors, solidBar: color }, undefined)}
          />
          <ColorSwatchPicker
            label="Hatched Bars"
            value={chartColors.hatchedBar}
            onChange={(color) => onColorsChange({ ...chartColors, hatchedBar: color }, undefined)}
          />
          <ColorSwatchPicker
            label="Today's Line"
            value={chartColors.todayLine}
            onChange={(color) => onColorsChange({ ...chartColors, todayLine: color }, undefined)}
          />
        </div>

        {/* Preset Themes */}
        <div style={{ marginBottom: '1rem' }}>
          <label style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: '600',
            color: '#555'
          }}>
            Color Presets
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {Object.keys(COLOR_PRESETS).map(presetName => {
              const isActive = activePreset === presetName;
              return (
                <button
                  key={presetName}
                  onClick={() => onColorsChange(COLOR_PRESETS[presetName], presetName)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: isActive ? '#e6f2ff' : 'white',
                    border: isActive ? '2px solid #0070f3' : '2px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? '600' : '500',
                    transition: 'all 0.2s',
                    boxShadow: isActive ? '0 2px 4px rgba(0, 112, 243, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#0070f3';
                      e.currentTarget.style.background = '#f0f8ff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.borderColor = '#ddd';
                      e.currentTarget.style.background = 'white';
                    }
                  }}
                >
                  {presetName}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}