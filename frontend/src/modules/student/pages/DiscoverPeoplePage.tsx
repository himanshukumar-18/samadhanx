import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Search, GraduationCap, Building2, 
  Sparkles, Copy, Check, ArrowRight
} from 'lucide-react';
import { projectsApi } from '../../../api/projects';

export const DiscoverPeoplePage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: people, isLoading, error } = useQuery({
    queryKey: ['student-people', searchTerm],
    queryFn: () => projectsApi.listPeople({ search: searchTerm || undefined }),
  });

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
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
        <div className="pt-2">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by student name, department (e.g. Computer Science, Mechanical)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all placeholder:text-muted-foreground"
            />
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
            {searchTerm ? `No student profiles matched "${searchTerm}". Try a different department or keyword.` : 'No registered student profiles available yet.'}
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
};
