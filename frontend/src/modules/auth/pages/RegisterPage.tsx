import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
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
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Registration failed. Please check your inputs.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-xl">
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Create Your Account</CardTitle>
            <CardDescription>Join SamadhanX to crowdsource and build real-world societal solutions</CardDescription>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mt-4">
              <button
                type="button"
                onClick={() => setRoleType('citizen')}
                className={`py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                  roleType === 'citizen'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" /> Citizen / Submitter
              </button>
              <button
                type="button"
                onClick={() => setRoleType('student')}
                className={`py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                  roleType === 'student'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <GraduationCap className="w-4 h-4" /> Student Innovator
              </button>
            </div>
          </CardHeader>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
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
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
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
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    Affiliated University / College (Approved Only)
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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

            <Button type="submit" className="w-full mt-4" isLoading={isLoading} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Create Account & Verify OTP
            </Button>

            <div className="text-center pt-2">
              <a href="/request-access" className="text-xs text-slate-500 hover:text-indigo-600">
                Are you a University or Industry Partner? <span className="font-semibold underline">Request Access here</span>
              </a>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
