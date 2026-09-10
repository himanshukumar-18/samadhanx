import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { Card, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Button } from '../../../shared/components/ui/Button';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import {
  TrendingUp,
  Award,
  GraduationCap,
  Users,
  CheckCircle2,
  Layers,
  FileCheck,
  Building2,
  Printer,
  Sparkles,
  ShieldCheck,
  Globe2,
  BarChart3,
  BookOpen,
  HeartHandshake,
} from 'lucide-react';
import { impactApi } from '../../../api/impact';

export const InstitutionalImpactPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'departments' | 'framework'>('overview');

  const { data: impact, isLoading, error } = useQuery({
    queryKey: ['institutional-impact-overview'],
    queryFn: () => impactApi.getInstitutionalImpact(),
  });

  const handlePrint = () => {
    window.print();
  };

  const getImpactBadgeColor = (level?: string | null) => {
    switch (level?.toLowerCase()) {
      case 'critical':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'high':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <Badge variant="approved">Completed & Deployed</Badge>;
      case 'pilot':
        return <Badge variant="student">Active Field Pilot</Badge>;
      case 'review':
        return <Badge variant="faculty">Under Faculty Review</Badge>;
      default:
        return <Badge variant="default">{status.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 print:p-0 print:space-y-4">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-linear-to-r from-emerald-900/10 via-teal-900/10 to-primary/10 border border-border p-6 rounded-2xl print:border-none print:p-0">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Institutional Impact & Accreditation Desk
            </h1>
            {user?.role && (
              <Badge variant="university" className="text-[10px]">
                {user.role}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Measuring civic problem resolution, student innovator engagement, KAPILA patent disclosures, and NIRF / NAAC accreditation readiness.
            {impact?.university_name && (
              <span className="font-semibold text-foreground ml-1">
                — {impact.university_name}
              </span>
            )}
            {impact?.aishe_code && (
              <span className="font-mono text-xs text-muted-foreground ml-2 px-2 py-0.5 rounded-md bg-muted/60 border border-border">
                AISHE: {impact.aishe_code}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-2 border-border text-foreground hover:bg-muted"
          >
            <Printer className="w-4 h-4" />
            Print NAAC/NIRF Brief
          </Button>
        </div>
      </div>

      {/* Primary KPI Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load institutional impact data.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Citizens Impacted</p>
              <Users className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
              {impact?.estimated_citizens_impacted.toLocaleString() || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Civic beneficiaries</p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Problems Addressed</p>
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-indigo-600 dark:text-indigo-400">
              {impact?.solved_problems_count || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Of {impact?.total_solutions_count || 0} active pods
            </p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Solution Pods</p>
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-blue-600 dark:text-blue-400">
              {impact?.total_solutions_count || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Campus prototype teams</p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Student Innovators</p>
              <GraduationCap className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-purple-600 dark:text-purple-400">
              {impact?.active_innovator_students_count || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Active participants</p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Faculty Mentors</p>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-amber-600 dark:text-amber-400">
              {impact?.faculty_mentors_count || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Guiding student pods</p>
          </Card>

          <Card className="p-4 border border-border bg-card">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Patents & IP</p>
              <ShieldCheck className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-2xl font-black mt-2 text-rose-600 dark:text-rose-400">
              {impact?.patents_filed_count || 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {impact?.patents_granted_count || 0} granted patents
            </p>
          </Card>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-border flex items-center gap-6 print:hidden">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          SDG Alignment & Accreditation
        </button>

        <button
          onClick={() => setActiveTab('projects')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'projects'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Deployed Solutions ({impact?.top_projects?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'departments'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Departmental League ({impact?.departmental_breakdown?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab('framework')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'framework'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          NIRF / NAAC Documentation Guide
        </button>
      </div>

      {/* TAB 1: SDG Alignment & Accreditation Readiness */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* UN Sustainable Development Goals (SDG) Breakdown */}
            <Card className="lg:col-span-2 p-6 border border-border bg-card space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe2 className="w-5 h-5 text-emerald-600" />
                    UN Sustainable Development Goals (SDG) Alignment
                  </CardTitle>
                  <CardDescription>
                    Distribution of campus innovation pods solving real-world challenges mapped to UN Agenda 2030 targets.
                  </CardDescription>
                </div>
                <Badge variant="approved" className="text-[10px]">
                  Agenda 2030
                </Badge>
              </div>

              <div className="space-y-4">
                {impact?.sdg_breakdown.map((sdg) => (
                  <div key={sdg.code} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: sdg.color }}
                        />
                        <span className="font-bold text-foreground">{sdg.code}:</span>
                        <span className="text-muted-foreground">{sdg.title}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-foreground">{sdg.count} pods</span>
                        <span className="text-muted-foreground">({sdg.percentage}%)</span>
                      </div>
                    </div>
                    {/* Progress meter */}
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(sdg.percentage, 3)}%`,
                          backgroundColor: sdg.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Accreditation Readiness Index Card */}
            <Card className="p-6 border border-border bg-card flex flex-col justify-between space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Award className="w-5 h-5 text-amber-500" />
                    Accreditation Scorecard
                  </CardTitle>
                  <Badge variant="university" className="text-[10px]">
                    NIRF & NAAC
                  </Badge>
                </div>
                <CardDescription>
                  Composite institutional readiness rating calculated across research, social outreach, and IPR.
                </CardDescription>
              </div>

              {/* Overall Index Display */}
              <div className="p-5 rounded-2xl bg-linear-to-br from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 text-center space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Composite Readiness Index
                </p>
                <p className="text-4xl font-black text-emerald-600 dark:text-emerald-400">
                  {impact?.accreditation_readiness?.overall_readiness_index || 0}
                  <span className="text-base font-normal text-muted-foreground"> / 100</span>
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                  Eligible for High-Tier NAAC A++ & NIRF Innovation
                </p>
              </div>

              {/* Sub-scores */}
              <div className="space-y-3 text-xs border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">NIRF Innovation Metric:</span>
                  <span className="font-bold text-foreground font-mono">
                    {impact?.accreditation_readiness?.nirf_innovation_score} / 100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">NAAC Criterion 3 (Research):</span>
                  <span className="font-bold text-foreground font-mono">
                    {impact?.accreditation_readiness?.naac_criterion_3_score} / 100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">NAAC Criterion 7 (Extension):</span>
                  <span className="font-bold text-foreground font-mono">
                    {impact?.accreditation_readiness?.naac_criterion_7_score} / 100
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">KAPILA Patent Filing Rate:</span>
                  <span className="font-bold text-foreground font-mono">
                    {impact?.accreditation_readiness?.kapila_utilization_rate}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Industry CSR Mobilized:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {impact?.csr_funds_mobilized}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: High-Impact Deployed Solutions */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))}
            </div>
          ) : (impact?.top_projects?.length || 0) === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-2xl p-8 space-y-3">
              <Layers className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
              <p className="text-base font-bold text-foreground">No Projects Reported Yet</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                As student pods build solutions and file prototypes, top high-impact deployments will be showcased here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {impact?.top_projects.map((proj) => (
                <Card key={proj.id} className="p-5 border border-border bg-card space-y-3 hover:border-emerald-500/40 transition-all">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="student" className="text-[10px]">
                        Team {proj.team_name}
                      </Badge>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border tracking-wide uppercase ${getImpactBadgeColor(
                          proj.impact_level
                        )}`}
                      >
                        {proj.impact_level} Impact
                      </span>
                    </div>
                    {getStatusBadge(proj.status)}
                  </div>

                  <h3 className="text-base font-bold text-foreground">{proj.title}</h3>

                  {proj.problem_title && (
                    <div className="p-2.5 bg-muted/40 rounded-xl border border-border/50 text-xs text-muted-foreground space-y-1">
                      <span className="font-semibold text-foreground">Civic Challenge:</span>
                      <p className="line-clamp-2">{proj.problem_title}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border flex-wrap gap-2">
                    <span className="flex items-center gap-1">
                      <Award className="w-3.5 h-3.5 text-amber-500" />
                      Mentor: <strong className="text-foreground">{proj.faculty_mentor_name || 'Academic Mentor'}</strong>
                    </span>
                    {proj.lead_student_name && (
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-purple-500" />
                        Lead: <strong className="text-foreground">{proj.lead_student_name}</strong>
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Departmental Impact League */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <Card className="p-6 border border-border bg-card space-y-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Interdepartmental Innovation League
              </CardTitle>
              <CardDescription>
                Comparative breakdown of faculty guides, student innovators, and patent disclosures across academic departments.
              </CardDescription>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="p-3 font-bold text-foreground">Department</th>
                    <th className="p-3 font-bold text-foreground text-center">Faculty Mentors</th>
                    <th className="p-3 font-bold text-foreground text-center">Student Innovators</th>
                    <th className="p-3 font-bold text-foreground text-center">Solution Pods</th>
                    <th className="p-3 font-bold text-foreground text-center">Patents / IP</th>
                    <th className="p-3 font-bold text-foreground text-right">Activity Index</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {impact?.departmental_breakdown.map((dept, index) => {
                    const activityScore = dept.faculty_count * 10 + dept.students_count * 5 + dept.projects_count * 15 + dept.patents_count * 25;
                    return (
                      <tr key={index} className="hover:bg-muted/20 transition-colors">
                        <td className="p-3 font-semibold text-foreground flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                            {index + 1}
                          </span>
                          {dept.department}
                        </td>
                        <td className="p-3 text-center font-mono text-muted-foreground">{dept.faculty_count}</td>
                        <td className="p-3 text-center font-mono text-muted-foreground">{dept.students_count}</td>
                        <td className="p-3 text-center font-mono font-semibold text-indigo-600">{dept.projects_count}</td>
                        <td className="p-3 text-center font-mono font-semibold text-rose-600">{dept.patents_count}</td>
                        <td className="p-3 text-right">
                          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            {activityScore} pts
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: NIRF & NAAC Documentation Guide */}
      {activeTab === 'framework' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6 border border-border bg-card space-y-3">
              <div className="p-3 w-fit rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <FileCheck className="w-6 h-6" />
              </div>
              <CardTitle>NAAC Criterion 3.2: Innovation Ecosystem</CardTitle>
              <CardDescription>
                Higher Educational Institutions are assessed on initiatives for creation and transfer of knowledge, incubation centers, and IPR facilitation cells.
              </CardDescription>
              <div className="text-xs text-muted-foreground space-y-1.5 pt-2 border-t border-border">
                <p><strong>Metrics Supported:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>3.2.1: Ecosystem for innovations including IPR cell and incubation linkage.</li>
                  <li>3.2.2: Workshops/seminars conducted on Intellectual Property Rights (IPR) and entrepreneurship.</li>
                  <li>3.4.3: Extension and outreach programs conducted in collaboration with industry and community.</li>
                </ul>
              </div>
            </Card>

            <Card className="p-6 border border-border bg-card space-y-3">
              <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <CardTitle>NAAC Criterion 7.1: Social Responsibility</CardTitle>
              <CardDescription>
                Evaluation of institutional efforts in addressing community civic issues, sustainable development practices, and local municipal collaboration.
              </CardDescription>
              <div className="text-xs text-muted-foreground space-y-1.5 pt-2 border-t border-border">
                <p><strong>Metrics Supported:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>7.1.1: Civic and community outreach with measurable beneficiary impacts.</li>
                  <li>7.1.3: Clean energy, water conservation, and waste management campus prototypes.</li>
                  <li>7.1.8: Institutional efforts in providing an inclusive environment for citizen problem resolution.</li>
                </ul>
              </div>
            </Card>
          </div>

          <Card className="p-6 border border-border bg-card space-y-3">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              NIRF Innovation (Formerly ARIIA) Alignment
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ministry of Education's NIRF Innovation framework benchmarks universities on: Developing ideation and venture incubation, Teaching and learning regarding innovation and entrepreneurship, Pre-incubation/incubation infrastructure, Generation of innovations and technologies licensed, and Pre-commercialization TRL tracking.
              All data exported from SamadhanX meets AICTE/UGC IQAC verification formats.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};
