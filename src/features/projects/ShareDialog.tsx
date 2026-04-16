// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// ShareDialog — Modal for sharing a project with other users (cloud mode only)

import { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { sanitizeString } from '../../shared/utils/validation';
import type { CloudGanttStorageService } from '../../shared/storage';
import type { ProjectRole } from '../../shared/types/firestore';

interface ShareDialogProps {
  projectId: string;
  projectName: string;
  cloudStorage: CloudGanttStorageService;
  onClose: () => void;
}

interface Member {
  uid: string;
  role: ProjectRole;
  email?: string;
}

export function ShareDialog({ projectId, projectName, cloudStorage, onClose }: ShareDialogProps) {
  const { colors } = useTheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [removeMemberUid, setRemoveMemberUid] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadMembers = async () => {
      try {
        const result = await cloudStorage.getProjectMembers(projectId);
        if (!cancelled) {
          setMembers(result);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load members');
          setLoading(false);
        }
      }
    };
    loadMembers();
    return () => { cancelled = true; };
  }, [projectId, cloudStorage]);

  const handleShare = async () => {
    const sanitizedEmail = sanitizeString(email, 254);
    if (!sanitizedEmail) return;
    if (!sanitizedEmail.includes('@')) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setActionLoading(true);
    try {
      await cloudStorage.shareProject(projectId, sanitizedEmail, role);
      // Reload members
      const result = await cloudStorage.getProjectMembers(projectId);
      setMembers(result);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share project');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmRemoveMember = async (uid: string) => {
    setRemoveMemberUid(null);
    setError(null);
    setActionLoading(true);
    try {
      await cloudStorage.removeProjectMember(projectId, uid);
      const result = await cloudStorage.getProjectMembers(projectId);
      setMembers(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        padding: '2rem',
        maxWidth: '520px',
        width: '90%',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        <h3 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: colors.text,
          marginBottom: '0.5rem'
        }}>
          Share Project
        </h3>
        <p style={{ color: colors.textSecondary, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {projectName}
        </p>

        {/* Add member form */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleShare()}
            disabled={actionLoading}
            maxLength={254}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              background: colors.inputBg,
              color: colors.text,
              fontSize: '0.9rem'
            }}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
            disabled={actionLoading}
            style={{
              padding: '0.5rem',
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              background: colors.inputBg,
              color: colors.text,
              fontSize: '0.9rem'
            }}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={handleShare}
            disabled={!email.trim() || actionLoading}
            style={{
              padding: '0.5rem 1rem',
              background: email.trim() && !actionLoading ? '#0070f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: email.trim() && !actionLoading ? 'pointer' : 'not-allowed',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Share
          </button>
        </div>

        {error && (
          <p style={{ color: '#e53e3e', fontSize: '0.85rem', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {/* Members list */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: '600', color: colors.textSecondary, marginBottom: '0.5rem' }}>
            Members
          </h4>
          {loading ? (
            <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>Loading...</p>
          ) : members.length === 0 ? (
            <p style={{ color: colors.textMuted, fontSize: '0.85rem' }}>No members</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map((member) => (
                <div
                  key={member.uid}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: colors.background,
                    borderRadius: '4px',
                    border: `1px solid ${colors.border}`
                  }}
                >
                  <div>
                    <span style={{ color: colors.text, fontSize: '0.9rem' }}>
                      {member.email || member.uid}
                    </span>
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.75rem',
                      color: member.role === 'owner' ? '#0070f3' : colors.textMuted,
                      fontWeight: member.role === 'owner' ? '600' : '400'
                    }}>
                      {member.role}
                    </span>
                  </div>
                  {member.role !== 'owner' && (
                    <button
                      onClick={() => setRemoveMemberUid(member.uid)}
                      disabled={actionLoading}
                      style={{
                        padding: '0.25rem 0.5rem',
                        background: 'transparent',
                        border: '1px solid #dc3545',
                        borderRadius: '4px',
                        color: '#dc3545',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Remove member confirmation modal */}
        {removeMemberUid && (
          <ConfirmDialog
            modal
            title="Remove Member"
            message="Remove this member from the project?"
            colors={colors}
            buttons={[
              {
                label: 'Cancel',
                variant: 'secondary',
                onClick: () => setRemoveMemberUid(null),
              },
              {
                label: 'Remove',
                variant: 'danger',
                onClick: () => confirmRemoveMember(removeMemberUid),
              },
            ]}
          />
        )}

        {/* Close button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1.25rem',
              background: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
