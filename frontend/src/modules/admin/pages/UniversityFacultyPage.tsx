import React, { useState, useEffect, useMemo } from 'react';
import { facultyApi, FacultyMember, FacultyInvitation } from '../../../api/faculty';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  GraduationCap,
  Mail,
  BookOpen,
  Plus,
  Search,
  RotateCw,
  Trash2,
  CheckCircle2,
  Clock,
  UserX,
  UserCheck,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const UniversityFacultyPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'roster' | 'invitations'>('roster');

  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [invitations, setInvitations] = useState<FacultyInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Invite modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [researchAreas, setResearchAreas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [facRoster, sentInvites] = await Promise.all([
        facultyApi.listUniversityFaculty(),
        facultyApi.listInvitations(),
      ]);
      setFacultyList(facRoster);
      setInvitations(sentInvites);
    } catch {
      toast.error('Failed to load institutional faculty records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInviteFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await facultyApi.inviteFaculty({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        department: department.trim(),
        designation,
        research_areas: researchAreas.split(',').map((s) => s.trim()).filter(Boolean),
      });

      toast.success(`Secure invitation link dispatched to ${email}`);
      setModalOpen(false);
      setFullName('');
      setEmail('');
      setDepartment('');
      setResearchAreas('');
      loadData();
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
      };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        errorObj.response?.data?.message ||
        'Failed to send invitation.';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (invitationId: string) => {
    setActionLoadingId(invitationId);
    try {
      await facultyApi.resendInvitation(invitationId);
      toast.success('Fresh invitation token dispatched to faculty email.');
      loadData();
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
      };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        'Failed to resend invitation.';
      toast.error(msg);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (invitationId: string) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) return;
    setActionLoadingId(invitationId);
    try {
      await facultyApi.revokeInvitation(invitationId);
      toast.success('Invitation revoked.');
      loadData();
    } catch {
      toast.error('Failed to revoke invitation.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleStatus = async (fac: FacultyMember) => {
    const action = fac.is_active ? 'deactivate' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} ${fac.full_name}'s account?`)) return;

    setActionLoadingId(fac.id);
    try {
      await facultyApi.toggleFacultyStatus(fac.id, !fac.is_active);
      toast.success(`Faculty account ${fac.is_active ? 'deactivated' : 'reactivated'}.`);
      loadData();
    } catch {
      toast.error('Failed to update faculty account status.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered faculty list
  const filteredFaculty = useMemo(() => {
    return facultyList.filter((f) => {
      const matchesSearch =
        !searchQuery ||
        f.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.department.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = !departmentFilter || f.department.toLowerCase() === departmentFilter.toLowerCase();
      return matchesSearch && matchesDept;
    });
  }, [facultyList, searchQuery, departmentFilter]);

  // Unique departments for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    facultyList.forEach((f) => {
      if (f.department) set.add(f.department);
    });
    return Array.from(set);
  }, [facultyList]);

  const pendingCount = invitations.filter((i) => i.status === 'pending').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">Institutional Faculty Management</h1>
            <Badge variant="university">University Portal</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Invite verified professors, manage academic mentors, and oversee student problem-solving guidance
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Invite Faculty Mentor
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'roster'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Active Faculty Roster</span>
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {facultyList.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('invitations')}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'invitations'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Sent Invitations</span>
          {pendingCount > 0 && (
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Active Faculty Roster */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search faculty by name, email, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4 text-muted-foreground" />}
              />
            </div>
            {departments.length > 0 && (
              <select
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary/40 focus:outline-none min-h-[44px]"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-44 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredFaculty.length === 0 ? (
            <Card className="text-center py-12 border-border">
              <GraduationCap className="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">
                {facultyList.length === 0 ? 'No faculty members onboarded yet' : 'No matching faculty found'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {facultyList.length === 0
                  ? 'Send invitations to your university professors to guide student challenge teams.'
                  : 'Try adjusting your search criteria or department filter.'}
              </p>
              {facultyList.length === 0 && (
                <Button onClick={() => setModalOpen(true)} leftIcon={<Send className="w-4 h-4" />}>
                  Invite First Faculty Member
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {filteredFaculty.map((fac) => (
                <Card key={fac.id} className="border-border flex flex-col justify-between p-5 space-y-4">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h4 className="text-base font-bold text-foreground">{fac.full_name}</h4>
                        <span className="text-xs text-primary font-bold">{fac.designation}</span>
                      </div>
                      <Badge variant={fac.is_active ? 'faculty' : 'default'}>
                        {fac.is_active ? 'Active' : 'Deactivated'}
                      </Badge>
                    </div>

                    <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{fac.department}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="truncate">{fac.email}</span>
                      </div>
                    </div>

                    {fac.research_areas && fac.research_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {fac.research_areas.map((r, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] bg-muted px-2 py-0.5 rounded-md text-foreground font-medium"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      Added {new Date(fac.created_at).toLocaleDateString()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(fac)}
                      isLoading={actionLoadingId === fac.id}
                      leftIcon={fac.is_active ? <UserX className="w-3.5 h-3.5 text-destructive" /> : <UserCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    >
                      {fac.is_active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Sent Invitations */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <Card className="text-center py-12 border-border">
              <Send className="w-12 h-12 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground">No invitations sent yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Invite faculty members by sending them an invitation with a secure link.
              </p>
              <Button onClick={() => setModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
                Invite Faculty Member
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv) => {
                const isPending = inv.status === 'pending';
                const isAccepted = inv.status === 'accepted';
                const isRevoked = inv.status === 'revoked';
                const isExpired = inv.status === 'expired';

                return (
                  <Card key={inv.id} className="border-border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{inv.full_name}</span>
                        {isPending && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Pending Acceptance
                          </span>
                        )}
                        {isAccepted && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Accepted
                          </span>
                        )}
                        {isRevoked && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                            Revoked
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-xs px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-bold">
                            Expired
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        <span>{inv.email}</span>
                        <span>•</span>
                        <span>{inv.department}</span>
                        <span>•</span>
                        <span>{inv.designation}</span>
                      </div>

                      <div className="text-[11px] text-muted-foreground pt-0.5">
                        Sent on {new Date(inv.created_at).toLocaleDateString()} • Expires{' '}
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:self-center">
                      {(isPending || isExpired) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResend(inv.id)}
                          isLoading={actionLoadingId === inv.id}
                          leftIcon={<RotateCw className="w-3.5 h-3.5" />}
                        >
                          Resend Invite
                        </Button>
                      )}

                      {isPending && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(inv.id)}
                          isLoading={actionLoadingId === inv.id}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Invite Faculty Mentor</CardTitle>
                  <CardDescription>
                    Send a secure onboarding invitation link to an academic professor or mentor
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <form onSubmit={handleInviteFaculty} className="p-6 pt-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Faculty Full Name"
                  placeholder="Prof. / Dr. Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <Input
                  label="Official Email"
                  type="email"
                  placeholder="faculty@univ.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Department"
                  placeholder="e.g. Computer Science"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                />
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Designation
                  </label>
                  <select
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[44px]"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                  >
                    <option value="Assistant Professor">Assistant Professor</option>
                    <option value="Associate Professor">Associate Professor</option>
                    <option value="Professor">Professor</option>
                    <option value="Dean / HOD">Dean / HOD</option>
                    <option value="Research Mentor">Research Mentor</option>
                  </select>
                </div>
              </div>

              <Input
                label="Research Areas (comma separated)"
                placeholder="Solar microgrids, Deep Learning, Water quality"
                value={researchAreas}
                onChange={(e) => setResearchAreas(e.target.value)}
              />

              <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 text-xs text-muted-foreground">
                🔐 A single-use, 7-day cryptographically secure invitation token will be generated and dispatched. The professor will set their own password and verify email OTP upon accepting.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmitting} leftIcon={<Send className="w-3.5 h-3.5" />}>
                  Dispatch Invitation
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
