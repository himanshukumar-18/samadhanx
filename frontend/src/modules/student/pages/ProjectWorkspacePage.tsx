import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Rocket, ArrowLeft, ExternalLink, GitBranch, Users, Plus, 
  Send, Clock, CheckCircle2, ShieldCheck, Sparkles, MessageSquare, AlertCircle
} from 'lucide-react';
import { projectsApi } from '../../../api/projects';
import { useAuthStore } from '../../../store/authStore';

interface ProjectWorkspacePageProps {
  projectId?: string;
}

export const ProjectWorkspacePage: React.FC<ProjectWorkspacePageProps> = ({ projectId }) => {
  // Extract project ID from URL if not passed via props
  const id = projectId || window.location.pathname.replace('/projects/', '').replace('/teams/', '').split('/')[0];
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [prototypeUrl, setPrototypeUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('Core Developer');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project-detail', id],
    queryFn: () => projectsApi.getProjectDetail(id),
    enabled: Boolean(id),
  });

  const postUpdateMutation = useMutation({
    mutationFn: (data: { title: string; content: string; prototype_url?: string }) =>
      projectsApi.addProjectUpdate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', id] });
      setUpdateTitle('');
      setUpdateContent('');
      setPrototypeUrl('');
      setIsPosting(false);
      setPostError(null);
    },
    onError: (err: any) => {
      setPostError(err.response?.data?.detail?.message || 'Failed to submit milestone update.');
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data: { user_id: string; role_in_team: string }) =>
      projectsApi.addProjectMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', id] });
      setNewMemberUserId('');
      setIsAddingMember(false);
      setMemberError(null);
    },
    onError: (err: any) => {
      setMemberError(err.response?.data?.detail?.message || 'Failed to add team member.');
    },
  });

  const handlePostUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTitle.trim() || !updateContent.trim()) return;
    postUpdateMutation.mutate({
      title: updateTitle.trim(),
      content: updateContent.trim(),
      prototype_url: prototypeUrl.trim() || undefined,
    });
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberUserId.trim()) return;
    addMemberMutation.mutate({
      user_id: newMemberUserId.trim(),
      role_in_team: newMemberRole.trim() || 'Member',
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-muted-foreground">Loading Solution Pod Workspace...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center bg-card border border-border rounded-3xl space-y-4 my-8">
        <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Solution Pod Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The requested solution workspace does not exist or you do not have permission to view it.
        </p>
        <button
          onClick={() => (window.location.href = '/projects')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow hover:bg-primary/90 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to My Pods
        </button>
      </div>
    );
  }

  const isLead = user?.id === project.lead_student_id;
  const isMember = isLead || project.members?.some((m: any) => m.user_id === user?.id);

  return (
    <div className="space-y-6 pb-16 w-full max-w-6xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <a
          href="/projects"
          className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Projects
        </a>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 capitalize">
            {project.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Pod Banner Header */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-primary">
              <Rocket className="w-4 h-4" /> Team {project.team_name}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              {project.title}
            </h1>
            <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
              {project.description}
            </p>
          </div>

          {project.repository_url && (
            <a
              href={project.repository_url.startsWith('http') ? project.repository_url : `https://${project.repository_url}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-colors shrink-0"
            >
              <GitBranch className="w-4 h-4" /> Code Repository <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Linked Problem Bar */}
        <div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-semibold text-foreground">Solving Challenge:</span>
            <a
              href={`/problems/${project.problem_id}`}
              className="font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              {project.problem_title || 'View Problem Statement'}
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="text-muted-foreground">
            Created: {new Date(project.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns (Workspace Main & Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Feed: Milestone Updates */}
        <div className="lg:col-span-2 space-y-6">
          {/* Post Update Card (Available to Pod Members) */}
          {isMember && (
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Post Milestone Update
                </h2>
                {!isPosting && (
                  <button
                    onClick={() => setIsPosting(true)}
                    className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Update
                  </button>
                )}
              </div>

              {isPosting && (
                <form onSubmit={handlePostUpdate} className="space-y-4 pt-2 border-t border-border">
                  {postError && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-2xl text-xs font-semibold text-destructive">
                      {postError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Update Title / Milestone
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., v1.0 Functional Prototype Deployed"
                      value={updateTitle}
                      onChange={(e) => setUpdateTitle(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Progress Details & Technical Highlights
                    </label>
                    <textarea
                      required
                      rows={4}
                      placeholder="Describe what your pod achieved, architectural decisions, test results..."
                      value={updateContent}
                      onChange={(e) => setUpdateContent(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      Live Prototype / Demo URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://prototype.samadhanx.in or Figma/Vercel URL"
                      value={prototypeUrl}
                      onChange={(e) => setPrototypeUrl(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsPosting(false)}
                      className="px-4 py-2 rounded-2xl text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={postUpdateMutation.isPending}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {postUpdateMutation.isPending ? 'Publishing...' : 'Publish Update'} <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Updates Timeline List */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Engineering Log & Milestone History
            </h2>

            {(!project.updates || project.updates.length === 0) ? (
              <div className="bg-card border border-border rounded-3xl p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-foreground">No Milestone Updates Yet</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Team updates demonstrate active problem solving and help university faculty and civic reviewers track your progress.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {project.updates.map((update: any) => (
                  <div
                    key={update.id}
                    className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3 relative"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold text-foreground">{update.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Posted by <span className="font-semibold text-foreground">{update.author_name || 'Team Member'}</span> • {new Date(update.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />
                    </div>

                    <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                      {update.content}
                    </p>

                    {update.prototype_url && (
                      <div className="pt-2">
                        <a
                          href={update.prototype_url.startsWith('http') ? update.prototype_url : `https://${update.prototype_url}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline bg-primary/5 px-3 py-1.5 rounded-xl border border-primary/20"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View Live Prototype / Demo
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Team & Mentor Status */}
        <div className="space-y-6">
          {/* Team Members Card */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Solution Pod Roster
              </h3>
              {isLead && !isAddingMember && (
                <button
                  onClick={() => setIsAddingMember(true)}
                  className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Member
                </button>
              )}
            </div>

            {isAddingMember && (
              <form onSubmit={handleAddMember} className="space-y-3 p-3 bg-secondary/30 rounded-2xl border border-border">
                {memberError && (
                  <p className="text-xs text-destructive font-semibold">{memberError}</p>
                )}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">User ID / Innovator ID</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter User UUID"
                    value={newMemberUserId}
                    onChange={(e) => setNewMemberUserId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">Role in Team</label>
                  <input
                    type="text"
                    placeholder="e.g., Frontend Dev, ML Engineer"
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingMember(false)}
                    className="px-3 py-1 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addMemberMutation.isPending}
                    className="px-3 py-1 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                  >
                    {addMemberMutation.isPending ? 'Adding...' : 'Add'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3 divide-y divide-border">
              {/* Team Lead */}
              <div className="pt-2 first:pt-0 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-foreground">
                    {project.lead_student_name || 'Team Lead'}
                  </p>
                  <p className="text-muted-foreground">Pod Lead / Creator</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                  Lead
                </span>
              </div>

              {/* Members */}
              {project.members
                ?.filter((m: any) => m.user_id !== project.lead_student_id)
                .map((m: any) => (
                  <div key={m.id} className="pt-2 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-foreground">
                        {m.member_name || m.email || 'Team Member'}
                      </p>
                      <p className="text-muted-foreground">{m.role_in_team || 'Member'}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-semibold text-[10px]">
                      {m.role_in_team}
                    </span>
                  </div>
                ))}
            </div>

            <div className="pt-2">
              <a
                href="/people"
                className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-2xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold transition-colors"
              >
                <Users className="w-3.5 h-3.5" /> Discover Student Innovators
              </a>
            </div>
          </div>

          {/* Institutional Review & Verification */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Academic & Review Status
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Once your prototype is submitted, faculty mentors and civic stakeholders will review and validate your solution for official deployment.
            </p>
            <div className="p-3 bg-secondary/30 rounded-2xl border border-border flex items-center gap-2 text-xs">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-muted-foreground">
                Current Stage: <strong className="text-foreground capitalize">{project.status.replace('_', ' ')}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
