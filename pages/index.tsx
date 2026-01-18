import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import styles from '@/styles/Home.module.css';

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

interface AppData {
  projects: Project[];
  releases: Release[];
}

// localStorage key
const STORAGE_KEY = 'gantt_app_data';

export default function Home() {
  const [data, setData] = useState<AppData>({ projects: [], releases: [] });
  const [activeTab, setActiveTab] = useState<'projects' | 'releases' | 'chart'>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  // Form states
  const [projectName, setProjectName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  
  const [releaseName, setReleaseName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [earlyFinish, setEarlyFinish] = useState('');
  const [lateFinish, setLateFinish] = useState('');
  const [editingReleaseId, setEditingReleaseId] = useState<string | null>(null);

  // Load data from localStorage on mount
  useEffect(() => {
    console.log('Loading from localStorage...');
    const stored = localStorage.getItem(STORAGE_KEY);
    console.log('Stored data:', stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        console.log('Parsed data:', parsed);
        setData(parsed);
        if (parsed.projects && parsed.projects.length > 0) {
          console.log('Setting selected project to:', parsed.projects[0].id);
          setSelectedProjectId(parsed.projects[0].id);
        }
      } catch (e) {
        console.error('Failed to parse stored data:', e);
      }
    } else {
      console.log('No stored data found');
    }
  }, []);

  // Update selected project when data changes and no project is selected
  useEffect(() => {
    if (data.projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(data.projects[0].id);
    }
  }, [data.projects, selectedProjectId]);

  // Save data to localStorage whenever it changes (but not on initial render)
  const isInitialMount = useRef(true);
  
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    console.log('Saving to localStorage:', data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  // Export data to JSON file
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

  // Import data from JSON file
  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        
        // Basic validation
        if (imported.projects && imported.releases && Array.isArray(imported.projects) && Array.isArray(imported.releases)) {
          setData(imported);
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
    
    // Reset the input so the same file can be imported again
    event.target.value = '';
  };

  // Project CRUD
  const addProject = () => {
    if (!projectName.trim()) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name: projectName.trim()
    };
    setData(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
    setProjectName('');
    if (!selectedProjectId) {
      setSelectedProjectId(newProject.id);
    }
  };

  const updateProject = () => {
    if (!projectName.trim() || !editingProjectId) return;
    setData(prev => ({
      ...prev,
      projects: prev.projects.map(p => 
        p.id === editingProjectId ? { ...p, name: projectName.trim() } : p
      )
    }));
    setProjectName('');
    setEditingProjectId(null);
  };

  const deleteProject = (id: string) => {
    setData(prev => ({
      projects: prev.projects.filter(p => p.id !== id),
      releases: prev.releases.filter(r => r.projectId !== id)
    }));
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
    setData(prev => ({ ...prev, releases: [...prev.releases, newRelease] }));
    clearReleaseForm();
  };

  const updateRelease = () => {
    if (!releaseName.trim() || !editingReleaseId || !startDate || !earlyFinish || !lateFinish) return;
    
    setData(prev => ({
      ...prev,
      releases: prev.releases.map(r => 
        r.id === editingReleaseId ? {
          ...r,
          name: releaseName.trim(),
          startDate,
          earlyFinishDate: earlyFinish,
          lateFinishDate: lateFinish
        } : r
      )
    }));
    clearReleaseForm();
  };

  const deleteRelease = (id: string) => {
    setData(prev => ({
      ...prev,
      releases: prev.releases.filter(r => r.id !== id)
    }));
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
  };

  // Get releases for selected project
  const currentReleases = data.releases.filter(r => r.projectId === selectedProjectId);
  const selectedProject = data.projects.find(p => p.id === selectedProjectId);

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
        </div>

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', color: '#333' }}>Projects</h2>
              
              {/* Export/Import buttons */}
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
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#00c9a7',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      marginRight: '0.5rem'
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
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600'
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
                    style={{
                      padding: '1rem',
                      background: 'white',
                      border: '2px solid #eee',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '1.1rem' }}>{project.name}</strong>
                      <span style={{ marginLeft: '1rem', color: '#999', fontSize: '0.9rem' }}>
                        ({data.releases.filter(r => r.projectId === project.id).length} releases)
                      </span>
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
                <input
                  type="text"
                  placeholder="Release name"
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                  style={{
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                <input
                  type="date"
                  placeholder="Start date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                <input
                  type="date"
                  placeholder="Early finish"
                  value={earlyFinish}
                  onChange={(e) => setEarlyFinish(e.target.value)}
                  style={{
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
                <input
                  type="date"
                  placeholder="Late finish"
                  value={lateFinish}
                  onChange={(e) => setLateFinish(e.target.value)}
                  style={{
                    padding: '0.75rem',
                    fontSize: '1rem',
                    border: '2px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              {editingReleaseId ? (
                <>
                  <button
                    onClick={updateRelease}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#00c9a7',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      marginRight: '0.5rem'
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
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: '600'
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
                    style={{
                      padding: '1rem',
                      background: 'white',
                      border: '2px solid #eee',
                      borderRadius: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '1.1rem', display: 'block', marginBottom: '0.5rem' }}>
                        {release.name}
                      </strong>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        <span>Start: {new Date(release.startDate).toLocaleDateString()}</span>
                        <span style={{ margin: '0 1rem' }}>|</span>
                        <span>Early: {new Date(release.earlyFinishDate).toLocaleDateString()}</span>
                        <span style={{ margin: '0 1rem' }}>|</span>
                        <span>Late: {new Date(release.lateFinishDate).toLocaleDateString()}</span>
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
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem',
        marginTop: '3rem',
        borderTop: '1px solid #eee',
        fontSize: '0.9rem',
        color: '#666'
      }}>
        © 2026 William W. Davis, MSPM, PMP | Version 2.1 | Licensed under GNU GPL v3
      </footer>
    </>
  );
}

// Gantt Chart Component
function GanttChart({ releases, projectName }: { releases: Release[], projectName: string }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'success' | 'error'>('idle');

  if (releases.length === 0) {
    return <p style={{ color: '#999', fontStyle: 'italic' }}>No releases to display.</p>;
  }

  // Calculate date range
  const allDates = releases.flatMap(r => [
    new Date(r.startDate).getTime(),
    new Date(r.lateFinishDate).getTime()
  ]);
  const minDate = Math.min(...allDates);
  const maxDate = Math.max(...allDates);
  const dateRange = maxDate - minDate;

  // Chart dimensions
  const chartWidth = 900;
  const chartHeight = releases.length * 60 + 80;
  const leftMargin = 200;
  const rightMargin = 50;
  const topMargin = 50;
  const barHeight = 30;
  const rowHeight = 60;

  const dateToX = (date: string) => {
    const timestamp = new Date(date).getTime();
    const ratio = (timestamp - minDate) / dateRange;
    return leftMargin + ratio * (chartWidth - leftMargin - rightMargin);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

  // Copy chart as image
  const copyChartAsImage = async () => {
    if (!chartRef.current) return;
    
    setCopyStatus('copying');
    
    try {
      // Use html2canvas to capture the chart
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2 // Higher quality
      });
      
      // Convert to blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setCopyStatus('error');
          setTimeout(() => setCopyStatus('idle'), 2000);
          return;
        }
        
        try {
          // Copy to clipboard
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
    <div ref={chartRef}>
      {/* Header with project name and date */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'baseline',
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ fontSize: '1.5rem', color: '#333', margin: 0 }}>
          Gantt Chart: {projectName}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
                  fill="#0070f3"
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
                      stroke="#0070f3"
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
                  stroke="#0070f3"
                  strokeWidth="2"
                  rx="4"
                />

                {/* Date labels */}
                <text
                  x={startX}
                  y={y + barHeight + 15}
                  fontSize="11"
                  fill="#666"
                  textAnchor="middle"
                >
                  {formatDate(release.startDate)}
                </text>
                <text
                  x={earlyX}
                  y={y + barHeight + 15}
                  fontSize="11"
                  fill="#666"
                  textAnchor="middle"
                >
                  {formatDate(release.earlyFinishDate)}
                </text>
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
            <div style={{ width: '30px', height: '20px', background: '#0070f3', borderRadius: '4px' }}></div>
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
                  <line x1="0" y1="0" x2="0" y2="8" stroke="#0070f3" strokeWidth="3" />
                </pattern>
              </defs>
              <rect width="30" height="20" fill="url(#legend-hatch)" stroke="#0070f3" strokeWidth="2" rx="4" />
            </svg>
            <span>Delivery Uncertainty</span>
          </div>
        </div>
      </div>
    </div>
  );
}