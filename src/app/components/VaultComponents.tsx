'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addProjectToVault,
  deleteProjectFromVault,
  updateProjectInVault,
} from '@/app/actions/vault';

type VaultProject = {
  id: string;
  title: string;
  description: string;
  techStack: string[];
  tags: string[];
  impactScore: number;
  createdAt?: string | Date | null;
};

export function ImpactBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? '#15803d' : score >= 6 ? '#b45309' : '#6b7280';
  const bg =
    score >= 8 ? '#dcfce7' : score >= 6 ? '#fef3c7' : '#f3f4f6';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 700,
        background: bg,
        color,
        flexShrink: 0,
      }}
    >
      ⚡ {score}
    </span>
  );
}

export function ProjectCard({
  project,
  onEdit,
  onDelete,
  editing,
  deleting,
}: {
  project: VaultProject;
  onEdit?: (project: VaultProject) => void;
  onDelete?: (project: VaultProject) => void;
  editing?: boolean;
  deleting?: boolean;
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: '14px',
        border: '1px solid #e7e5e4',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: '0 1px 4px rgba(28,25,23,0.04)',
        transition: 'box-shadow 0.15s, border-color 0.15s',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 4px 16px rgba(28,25,23,0.09)';
        el.style.borderColor = '#d6d3d1';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 1px 4px rgba(28,25,23,0.04)';
        el.style.borderColor = '#e7e5e4';
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#1c1917',
            margin: 0,
            lineHeight: 1.3,
            flex: 1,
          }}
        >
          {project.title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <ImpactBadge score={project.impactScore} />
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(project)}
              disabled={editing}
              style={{
                border: '1px solid #cbd5e1',
                background: editing ? '#e2e8f0' : '#f8fafc',
                color: '#334155',
                borderRadius: '999px',
                fontSize: '11px',
                padding: '3px 9px',
                fontWeight: 600,
                cursor: editing ? 'not-allowed' : 'pointer',
              }}
            >
              {editing ? 'Editing...' : 'Edit'}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(project)}
              disabled={deleting}
              style={{
                border: '1px solid #fecaca',
                background: deleting ? '#fee2e2' : '#fff1f2',
                color: '#b91c1c',
                borderRadius: '999px',
                fontSize: '11px',
                padding: '3px 9px',
                fontWeight: 600,
                cursor: deleting ? 'not-allowed' : 'pointer',
              }}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: '13px',
          color: '#78716c',
          margin: 0,
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {project.description}
      </p>

      {/* Tech stack */}
      {project.techStack.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {project.techStack.slice(0, 5).map((t) => (
            <span
              key={t}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '20px',
                background: '#f2ebe0',
                color: '#7a4f1e',
                fontWeight: 500,
              }}
            >
              {t}
            </span>
          ))}
          {project.techStack.length > 5 && (
            <span style={{ fontSize: '11px', color: '#a8a29e', padding: '2px 4px' }}>
              +{project.techStack.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {project.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
          {project.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '20px',
                background: '#f5f5f4',
                color: '#78716c',
                border: '1px solid #e7e5e4',
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <p style={{ fontSize: '11px', color: '#a8a29e', margin: 0, marginTop: 'auto' }}>
        {project.createdAt
          ? new Date(project.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : ''}
      </p>
    </div>
  );
}

export function VaultInlineManager({
  initialProjects,
  total,
}: {
  initialProjects: VaultProject[];
  total: number;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [rawInput, setRawInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<VaultProject | null>(null);
  const [editingProject, setEditingProject] = useState<VaultProject | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTechStack, setEditTechStack] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editImpactScore, setEditImpactScore] = useState(7);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const [isEditing, startEditing] = useTransition();
  const router = useRouter();

  const counterLabel = useMemo(() => {
    const count = projects.length;
    return `${count} shown / ${total} total`;
  }, [projects.length, total]);

  const addInlineProject = () => {
    const value = rawInput.trim();
    if (value.length < 10) {
      setError('Please provide at least 10 characters of project context.');
      return;
    }

    startSaving(async () => {
      try {
        setError(null);
        setMessage(null);
        const result = await addProjectToVault({ rawInput: value });

        const next: VaultProject = {
          id: result.id,
          title: result.title,
          description: result.description,
          techStack: result.techStack,
          tags: result.tags,
          impactScore: result.impactScore,
          createdAt: new Date().toISOString(),
        };

        if (result.duplicate) {
          setMessage('Duplicate detected. Existing vault item kept.');
        } else {
          setProjects((prev) => [next, ...prev.filter((p) => p.id !== next.id)]);
          setMessage('Project added to vault.');
        }

        setRawInput('');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add project.');
      }
    });
  };

  const deleteInlineProject = (project: VaultProject) => {
    setConfirmDeleteProject(project);
  };

  const confirmDeleteInlineProject = () => {
    if (!confirmDeleteProject) {
      return;
    }

    const project = confirmDeleteProject;

    startDeleting(async () => {
      try {
        setDeletingProjectId(project.id);
        setError(null);
        setMessage(null);
        await deleteProjectFromVault({ projectId: project.id });
        setProjects((prev) => prev.filter((item) => item.id !== project.id));
        setMessage('Project deleted.');
        setConfirmDeleteProject(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete project.');
      } finally {
        setDeletingProjectId(null);
      }
    });
  };

  const openEditPopup = (project: VaultProject) => {
    setEditingProject(project);
    setEditTitle(project.title);
    setEditDescription(project.description);
    setEditTechStack(project.techStack.join(', '));
    setEditTags(project.tags.join(', '));
    setEditImpactScore(project.impactScore);
  };

  const saveInlineEdit = () => {
    if (!editingProject) {
      return;
    }

    const title = editTitle.trim();
    const description = editDescription.trim();
    if (title.length < 2) {
      setError('Title must be at least 2 characters.');
      return;
    }
    if (description.length < 10) {
      setError('Description must be at least 10 characters.');
      return;
    }

    const techStack = editTechStack
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const tags = editTags
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    startEditing(async () => {
      try {
        setEditingProjectId(editingProject.id);
        setError(null);
        setMessage(null);

        const updated = await updateProjectInVault({
          projectId: editingProject.id,
          title,
          description,
          techStack,
          tags,
          impactScore: editImpactScore,
        });

        setProjects((prev) =>
          prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
        );
        setEditingProject(null);
        setMessage('Project updated.');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update project.');
      } finally {
        setEditingProjectId(null);
      }
    });
  };

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e7e5e4',
          padding: '18px',
          boxShadow: '0 1px 4px rgba(28,25,23,0.04)',
        }}
      >
        <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#1c1917' }}>Quick Add</h2>
          <span style={{ fontSize: '12px', color: '#78716c' }}>{counterLabel}</span>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: '13px', color: '#78716c' }}>
          Paste a project paragraph, bullet list, or role summary. It will be parsed and added directly to the vault.
        </p>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder="Built and scaled a multi-tenant analytics dashboard with Next.js, MongoDB, and vector search..."
          rows={4}
          style={{
            width: '100%',
            border: '1px solid #d6d3d1',
            borderRadius: '10px',
            padding: '10px 12px',
            fontSize: '13px',
            lineHeight: 1.5,
            resize: 'vertical',
            marginBottom: '12px',
          }}
        />
        <button
          type="button"
          onClick={addInlineProject}
          disabled={isSaving}
          style={{
            border: 'none',
            borderRadius: '999px',
            padding: '9px 16px',
            background: isSaving ? '#57534e' : '#1c1917',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          {isSaving ? 'Adding...' : '+ Add To Vault'}
        </button>
        {(error || message) && (
          <p
            style={{
              margin: '10px 0 0',
              fontSize: '12px',
              color: error ? '#b91c1c' : '#047857',
            }}
          >
            {error ?? message}
          </p>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '14px',
        }}
      >
        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onEdit={openEditPopup}
            onDelete={deleteInlineProject}
            editing={isEditing && editingProjectId === project.id}
            deleting={isDeleting && deletingProjectId === project.id}
          />
        ))}
      </div>

      {confirmDeleteProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'white',
              borderRadius: '14px',
              border: '1px solid #e7e5e4',
              boxShadow: '0 18px 40px rgba(28,25,23,0.2)',
              padding: '18px',
              display: 'grid',
              gap: '12px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1c1917' }}>Delete project?</h3>
            <p style={{ margin: 0, fontSize: '14px', color: '#57534e', lineHeight: 1.5 }}>
              This will permanently remove "{confirmDeleteProject.title}" from your vault.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setConfirmDeleteProject(null)}
                disabled={isDeleting}
                style={{
                  border: '1px solid #d6d3d1',
                  background: 'white',
                  color: '#44403c',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteInlineProject}
                disabled={isDeleting}
                style={{
                  border: 'none',
                  background: isDeleting ? '#ef4444' : '#dc2626',
                  color: 'white',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProject && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              background: 'white',
              borderRadius: '14px',
              border: '1px solid #e7e5e4',
              boxShadow: '0 18px 40px rgba(28,25,23,0.2)',
              padding: '18px',
              display: 'grid',
              gap: '10px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '18px', color: '#1c1917' }}>Edit project</h3>

            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Project title"
              style={{
                width: '100%',
                border: '1px solid #d6d3d1',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
              }}
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={5}
              placeholder="Project description"
              style={{
                width: '100%',
                border: '1px solid #d6d3d1',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: 1.5,
                resize: 'vertical',
              }}
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
              }}
            >
              <input
                value={editTechStack}
                onChange={(e) => setEditTechStack(e.target.value)}
                placeholder="Tech stack (comma-separated)"
                style={{
                  width: '100%',
                  border: '1px solid #d6d3d1',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '13px',
                }}
              />
              <input
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="Tags (comma-separated)"
                style={{
                  width: '100%',
                  border: '1px solid #d6d3d1',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  fontSize: '13px',
                }}
              />
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '12px', color: '#57534e' }}>
              Impact score: {editImpactScore}
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={editImpactScore}
                onChange={(e) => setEditImpactScore(Number(e.target.value))}
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setEditingProject(null)}
                disabled={isEditing}
                style={{
                  border: '1px solid #d6d3d1',
                  background: 'white',
                  color: '#44403c',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  cursor: isEditing ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveInlineEdit}
                disabled={isEditing}
                style={{
                  border: 'none',
                  background: isEditing ? '#57534e' : '#1c1917',
                  color: 'white',
                  borderRadius: '999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '8px 14px',
                  cursor: isEditing ? 'not-allowed' : 'pointer',
                }}
              >
                {isEditing ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
