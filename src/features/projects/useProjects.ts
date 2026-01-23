// Projects CRUD operations hook

import { useState } from 'react';
import { Project } from '../../shared/types';
import { useAppData } from '../../context/AppDataContext';

export function useProjects() {
  const { data, updateData } = useAppData();
  const [projectName, setProjectName] = useState('');
  const [projectFinishDate, setProjectFinishDate] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  const addProject = (selectedProjectId: string, setSelectedProjectId: (id: string) => void) => {
    if (!projectName.trim()) return;
    const newProject: Project = {
      id: Date.now().toString(),
      name: projectName.trim(),
      ...(projectFinishDate && { finishDate: projectFinishDate })
    };
    const newData = { ...data, projects: [...data.projects, newProject] };
    updateData(newData);
    setProjectName('');
    setProjectFinishDate('');
    if (!selectedProjectId) {
      setSelectedProjectId(newProject.id);
    }
  };

  const updateProject = () => {
    if (!projectName.trim() || !editingProjectId) return;
    const newData = {
      ...data,
      projects: data.projects.map(p =>
        p.id === editingProjectId ? {
          ...p,
          name: projectName.trim(),
          ...(projectFinishDate ? { finishDate: projectFinishDate } : { finishDate: undefined })
        } : p
      )
    };
    updateData(newData);
    setProjectName('');
    setProjectFinishDate('');
    setEditingProjectId(null);
  };

  const deleteProject = (id: string, selectedProjectId: string, setSelectedProjectId: (id: string) => void) => {
    const newData = {
      ...data,
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
    setProjectFinishDate(project.finishDate || '');
    setEditingProjectId(project.id);
  };

  const cancelEditProject = () => {
    setProjectName('');
    setProjectFinishDate('');
    setEditingProjectId(null);
  };

  return {
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
  };
}
