import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { 
  GraduationCap, 
  UserPlus, 
  Mail, 
  BookOpen, 
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

interface FacultyMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  department: string;
  designation: string;
  research_areas: string[];
  created_at: string;
}

export const UniversityFacultyPage: React.FC = () => {
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('Assistant Professor');
  const [researchAreas, setResearchAreas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadFaculty = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/university/faculty');
      setFacultyList(res.data?.data || []);
    } catch {
      toast.error('Failed to load faculty roster.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, []);

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiClient.post('/university/faculty', {
        email,
        password,
        full_name: fullName,
        department,
        designation,
        research_areas: researchAreas.split(',').map((s) => s.trim()).filter(Boolean),
      });

      toast.success(`Faculty account created for ${fullName}`);
      setModalOpen(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setDepartment('');
      setResearchAreas('');
      loadFaculty();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(errorObj.response?.data?.error?.message || 'Failed to create faculty account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-black text-foreground">Institutional Faculty Management</h1>
            <Badge variant="university">University Portal</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Create verified faculty accounts and assign academic mentors to student problem-solving teams
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
          Add Faculty Mentor
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : facultyList.length === 0 ? (
        <Card className="text-center py-12 border-border">
          <GraduationCap className="w-12 h-12 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-bold text-foreground">No faculty members onboarded yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Add your university professors to guide student challenge teams.</p>
          <Button onClick={() => setModalOpen(true)} leftIcon={<UserPlus className="w-4 h-4" />}>
            Onboard First Faculty Member
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {facultyList.map((fac) => (
            <Card key={fac.id} className="border-border flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-base font-bold text-foreground">{fac.full_name}</h4>
                    <span className="text-xs text-primary font-bold">{fac.designation}</span>
                  </div>
                  <Badge variant="faculty">Faculty</Badge>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{fac.department}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{fac.email}</span>
                  </div>
                </div>

                {fac.research_areas && fac.research_areas.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {fac.research_areas.map((r, idx) => (
                      <span key={idx} className="text-[10px] bg-muted px-2 py-0.5 rounded-md text-foreground font-medium">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-border">
            <CardHeader>
              <CardTitle>Create Faculty Account</CardTitle>
              <CardDescription>Onboard a professor or academic mentor linked directly to your university</CardDescription>
            </CardHeader>

            <form onSubmit={handleCreateFaculty} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Faculty Full Name"
                  placeholder="Dr. Ananya Sen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <Input
                  label="Official Email"
                  type="email"
                  placeholder="ananya.sen@univ.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Temporary Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Input
                  label="Department"
                  placeholder="e.g. Electrical Engg"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <Input
                  label="Research Areas (comma separated)"
                  placeholder="Solar cells, Grid AI"
                  value={researchAreas}
                  onChange={(e) => setResearchAreas(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button variant="outline" size="sm" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" isLoading={isSubmitting}>
                  Create & Dispatch Credentials
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
