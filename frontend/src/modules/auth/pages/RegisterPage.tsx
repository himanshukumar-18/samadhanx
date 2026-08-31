import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Logo } from '../../../shared/components/Logo';
import { Users, GraduationCap, ArrowRight, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface UniversityItem {
  id: string;
  university_name: string;
  state: string;
  district: string;
}

export const RegisterPage: React.FC = () => {
  const [roleType, setRoleType] = useState<'citizen' | 'student'>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');

  const [universities, setUniversities] = useState<UniversityItem[]>([]);
  const [selectedUnivId, setSelectedUnivId] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [department, setDepartment] = useState('');
  const [gradYear, setGradYear] = useState('2026');
  const [skillsInput, setSkillsInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (roleType === 'student') {
      apiClient.get('/auth/universities')
        .then((res) => {
          setUniversities(res.data?.data || []);
          if (res.data?.data?.length > 0) {
            setSelectedUnivId(res.data.data[0].id);
          }
        })
        .catch((err) => console.error('Failed to load universities', err));
    }
  }, [roleType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (roleType === 'citizen') {
        await apiClient.post('/auth/register/citizen', {
          email,
          password,
          full_name: fullName,
          phone_number: phone || undefined,
          location,
          district,
          state,
        });
      } else {
        if (!selectedUnivId) {
          setErrorMsg('Please select an approved university.');
          setIsLoading(false);
          return;
        }
        await apiClient.post('/auth/register/student', {
          email,
          password,
          full_name: fullName,
          university_id: selectedUnivId,
          enrollment_number: enrollmentNo || undefined,
          department,
          graduation_year: parseInt(gradYear, 10) || 2026,
          skills: skillsInput.split(',').map((s) => s.trim()).filter(Boolean),
        });
      }

      toast.success('Registration successful! Please verify your email OTP.');
      window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = errorObj.response?.data?.error?.message || 'Registration failed. Please check your inputs.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 py-8 bg-background">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex justify-center">
          <a href="/">
            <Logo size="lg" />
          </a>
        </div>

        <Card className="shadow-lg border-border">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-black">Create Your Account</CardTitle>
            <CardDescription>Join SamadhanX to crowdsource and build real-world societal solutions</CardDescription>

            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl mt-4">
              <button
                type="button"
                onClick={() => setRoleType('citizen')}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all min-h-[40px] ${
                  roleType === 'citizen'
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-4 h-4" /> Citizen / Submitter
              </button>
              <button
                type="button"
                onClick={() => setRoleType('student')}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all min-h-[40px] ${
                  roleType === 'student'
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <GraduationCap className="w-4 h-4" /> Student Innovator
              </button>
            </div>
          </CardHeader>

          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Full Name"
                placeholder="e.g. Ramesh Kumar"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <Input
              label="Password (min 8 chars)"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {roleType === 'citizen' ? (
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Phone Number"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <Input
                    label="Locality / Ward / Area"
                    placeholder="e.g. Ward 14, Main Road"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="District"
                    placeholder="e.g. Ranchi"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required
                  />
                  <Input
                    label="State"
                    placeholder="e.g. Jharkhand"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Affiliated University / College (Approved Only)
                  </label>
                  <select
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[44px]"
                    value={selectedUnivId}
                    onChange={(e) => setSelectedUnivId(e.target.value)}
                    required
                  >
                    {universities.length === 0 ? (
                      <option value="">No approved universities available</option>
                    ) : (
                      universities.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.university_name} ({u.state})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Department / Branch"
                    placeholder="e.g. Computer Science"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                  />
                  <Input
                    label="Enrollment / Roll No"
                    placeholder="e.g. 22CS0104"
                    value={enrollmentNo}
                    onChange={(e) => setEnrollmentNo(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Graduation Year"
                    type="number"
                    value={gradYear}
                    onChange={(e) => setGradYear(e.target.value)}
                    required
                  />
                  <Input
                    label="Skills (comma separated)"
                    placeholder="React, Python, IoT, AI"
                    value={skillsInput}
                    onChange={(e) => setSkillsInput(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full mt-4 font-bold" isLoading={isLoading} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Create Account & Verify OTP
            </Button>

            <div className="text-center pt-2">
              <a href="/request-access" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                Are you a University or Industry Partner? <span className="font-bold underline">Request Access here</span>
              </a>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
