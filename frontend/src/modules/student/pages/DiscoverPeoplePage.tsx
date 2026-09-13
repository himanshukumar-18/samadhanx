import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Search, GraduationCap, Building2, 
  Sparkles, Copy, Check, ArrowRight, Filter, ChevronDown, RotateCcw
} from 'lucide-react';
import { studentApi } from '../../../api/student';

const POPULAR_SKILLS = [
  'All',
  'Python',
  'React',
  'AI / ML',
  'IoT & Embedded',
  'CleanTech',
  'Robotics',
  'Data Science',
  'Full Stack',
  'Mobile App',
  'Hardware',
];

const DEPARTMENTS = [
  'All Departments',
  'Computer Science & Engineering',
  'Electronics & Communication',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil & Environmental',
  'Biotechnology & Healthcare',
  'Information Technology',
];

export const DiscoverPeoplePage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('All');
  const [selectedDept, setSelectedDept] = useState('All Departments');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const LIMIT = 12;

  const { data: people, isLoading, error, isFetching } = useQuery({
    queryKey: ['student-people', searchTerm, selectedSkill, selectedDept, offset],
    queryFn: () =>
      studentApi.listPeople({
        search: searchTerm.trim() || undefined,
        skill: selectedSkill === 'All' ? undefined : selectedSkill,
        department: selectedDept === 'All Departments' ? undefined : selectedDept,
        offset,
        limit: LIMIT,
      }),
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedSkill('All');
    setSelectedDept('All Departments');
    setOffset(0);
  };

  return (
    <div className="space-y-6 pb-16 w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase text-primary">
          <Sparkles className="w-4 h-4" /> Innovator Network
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Discover Student Innovators
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Find engineers, designers, researchers, and domain experts across verified institutions to collaborate on civic solution pods.
          </p>
        </div>

        {/* Search Input */}
        <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by student name or keywords..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setOffset(0);
              }}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-muted-foreground"
            />
          </div>

          <div className="relative">
            <select
              aria-label="Filter by department"
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setOffset(0);
              }}
              className="w-full appearance-none pl-4 pr-10 py-3 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all cursor-pointer font-medium"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept} className="bg-card text-foreground">
                  {dept}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Skill Filter Chips */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Filter className="w-3.5 h-3.5" /> Filter by Skill:
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            {POPULAR_SKILLS.map((skill) => {
              const active = selectedSkill === skill;
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => {
                    setSelectedSkill(skill);
                    setOffset(0);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                  }`}
                >
                  {skill}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Innovator Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-card border border-border rounded-3xl p-6 h-48 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-card border border-border rounded-3xl p-8 text-center text-destructive">
          Failed to load student innovators. Please try again later.
        </div>
      ) : !people || people.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-foreground">No Innovators Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            No student profiles matched your active search and filter criteria.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {people.map((person: any) => (
              <div
                key={person.id}
                className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0 border border-primary/20">
                        {person.full_name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                          {person.full_name}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <GraduationCap className="w-3.5 h-3.5 text-primary" /> {person.department || 'Undergraduate Innovator'}
                          {person.graduation_year && <span>• Class of {person.graduation_year}</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{person.institution_name}</span>
                  </div>

                  {/* Skills tags */}
                  {person.skills && person.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {person.skills.map((skill: string, idx: number) => (
                        <span
                          key={idx}
                          className="text-[11px] font-semibold px-2.5 py-0.5 rounded-xl bg-secondary text-secondary-foreground"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopyId(person.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/80 hover:bg-secondary text-secondary-foreground text-xs font-semibold transition-colors"
                    title="Copy User UUID to add to your solution pod team"
                  >
                    {copiedId === person.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" /> Copied ID
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Copy ID
                      </>
                    )}
                  </button>

                  <a
                    href={`/profile/user/${person.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    View Profile <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setOffset((prev) => Math.max(0, prev - LIMIT))}
              disabled={offset === 0 || isFetching}
              className="px-4 py-2 rounded-2xl bg-secondary text-secondary-foreground text-xs font-bold disabled:opacity-40 hover:bg-secondary/80 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground font-medium">
              Showing page {Math.floor(offset / LIMIT) + 1}
            </span>
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + LIMIT)}
              disabled={!people || people.length < LIMIT || isFetching}
              className="px-4 py-2 rounded-2xl bg-secondary text-secondary-foreground text-xs font-bold disabled:opacity-40 hover:bg-secondary/80 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
