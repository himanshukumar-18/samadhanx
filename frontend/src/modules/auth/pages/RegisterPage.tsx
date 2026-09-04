import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { useApprovedUniversities } from '../../../hooks/useApprovedUniversities';
import { useInstitutionSearch, InstitutionMasterItem } from '../../../hooks/useInstitutionSearch';
import { InstitutionRequestModal } from '../components/InstitutionRequestModal';
import { InstitutionVerificationRequestItem } from '../../../api/institutions';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Logo } from '../../../shared/components/Logo';
import {
  Users,
  GraduationCap,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Building,
  PlusCircle,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const RegisterPage: React.FC = () => {
  const [roleType, setRoleType] = useState<'citizen' | 'student'>('citizen');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  // Citizen-specific fields
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');

  // Student institution selection state
  const [institutionQuery, setInstitutionQuery] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionMasterItem | null>(null);
  const [pendingRequest, setPendingRequest] = useState<InstitutionVerificationRequestItem | null>(null);
  const [selectedUnivId, setSelectedUnivId] = useState('');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Student academic fields
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [department, setDepartment] = useState('');
  const [gradYear, setGradYear] = useState('2027');
  const [skillsInput, setSkillsInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // TanStack Query for debounced institution master search
  const {
    data: instSearchData,
    isLoading: loadingInsts,
    isError: instsError,
    refetch: refetchInsts,
  } = useInstitutionSearch(institutionQuery, roleType === 'student');

  // Approved universities fallback list
  const { data: approvedUniversities = [] } = useApprovedUniversities(roleType === 'student');

  const masterInstitutions = instSearchData?.data || [];

  useEffect(() => {
    if (approvedUniversities.length > 0 && !selectedUnivId && !selectedInstitution && !pendingRequest) {
      setSelectedUnivId(approvedUniversities[0].id);
    }
  }, [approvedUniversities, selectedUnivId, selectedInstitution, pendingRequest]);

  const handleSelectInstitution = (inst: InstitutionMasterItem) => {
    setSelectedInstitution(inst);
    setPendingRequest(null);
    setInstitutionQuery('');
  };

  const handleClearInstitution = () => {
    setSelectedInstitution(null);
    setPendingRequest(null);
    setInstitutionQuery('');
  };

  const handlePendingRequestSubmitted = (req: InstitutionVerificationRequestItem) => {
    setPendingRequest(req);
    setSelectedInstitution(null);
    setInstitutionQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (roleType === 'citizen') {
        await apiClient.post('/auth/register/citizen', {
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim(),
          phone_number: phone.trim() || undefined,
          location: location.trim(),
          district: district.trim(),
          state: state.trim(),
        });
      } else {
        if (!selectedInstitution && !pendingRequest && !selectedUnivId) {
          setErrorMsg('Please select a verified institution or submit an institution verification request.');
          setIsLoading(false);
          return;
        }

        await apiClient.post('/auth/register/student', {
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim(),
          institution_id: selectedInstitution?.id || undefined,
          pending_institution_request_id: pendingRequest?.id || undefined,
          university_id: (!selectedInstitution && !pendingRequest) ? selectedUnivId || undefined : undefined,
          enrollment_number: enrollmentNo.trim() || undefined,
          department: department.trim(),
          graduation_year: parseInt(gradYear, 10) || 2027,
          skills: skillsInput.split(',').map((s) => s.trim()).filter(Boolean),
        });
      }

      toast.success('Registration successful! Please verify your email OTP.');
      window.location.href = `/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } } };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        errorObj.response?.data?.message ||
        'Registration failed. Please check your inputs.';
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
            <div className="mb-4 mx-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 pt-0 space-y-4">
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
                {/* Clean, Non-Intimidating Institution Search Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Institution / College / University *
                    </label>
                    {instsError && (
                      <button
                        type="button"
                        onClick={() => refetchInsts()}
                        className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Retry
                      </button>
                    )}
                  </div>

                  {/* Selected Institution View */}
                  {selectedInstitution ? (
                    <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-black text-foreground truncate">{selectedInstitution.name}</p>
                          <p className="text-muted-foreground text-[11px] truncate">
                            {selectedInstitution.city || selectedInstitution.district}, {selectedInstitution.state} •{' '}
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Verified Institution</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearInstitution}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg transition-colors flex items-center gap-1 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" /> Change
                      </button>
                    </div>
                  ) : pendingRequest ? (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-black text-foreground truncate">{pendingRequest.requested_name}</p>
                          <p className="text-muted-foreground text-[11px] truncate">
                            {pendingRequest.district}, {pendingRequest.state} •{' '}
                            <span className="text-amber-600 dark:text-amber-400 font-bold">Pending Official Verification</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearInstitution}
                        className="text-xs font-bold text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg transition-colors flex items-center gap-1 flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" /> Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search your college, university, or AISHE/UGC code..."
                          value={institutionQuery}
                          onChange={(e) => setInstitutionQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-xs sm:text-sm text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[44px]"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Search by official institution name, city, AISHE or UGC code.
                      </p>

                      {/* Dropdown Options List */}
                      {institutionQuery.trim().length >= 2 && (
                        <div className="mt-2 max-h-56 overflow-y-auto border border-border rounded-xl bg-card shadow-lg divide-y divide-border">
                          {loadingInsts ? (
                            <div className="p-3.5 text-xs text-muted-foreground text-center font-medium">
                              Searching verified institutions...
                            </div>
                          ) : masterInstitutions.length > 0 ? (
                            masterInstitutions.map((inst) => (
                              <button
                                key={inst.id}
                                type="button"
                                onClick={() => handleSelectInstitution(inst)}
                                className="w-full text-left p-3 hover:bg-muted transition-colors flex items-center justify-between text-xs group"
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-foreground group-hover:text-primary transition-colors">
                                      {inst.name}
                                    </p>
                                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                      {inst.institution_type || 'University'}
                                    </span>
                                  </div>
                                  <p className="text-muted-foreground text-[11px]">
                                    {inst.city || inst.district}, {inst.state}{' '}
                                    {inst.aishe_code ? `• AISHE: ${inst.aishe_code}` : ''}
                                  </p>
                                </div>
                                <span className="text-[10px] uppercase font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded flex-shrink-0">
                                  ✓ Verified
                                </span>
                              </button>
                            ))
                          ) : (
                            <div className="p-4 text-xs text-muted-foreground text-center space-y-2">
                              <p>No matching institution found.</p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsRequestModalOpen(true)}
                                leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
                                className="mx-auto text-xs font-bold"
                              >
                                Request Institution Verification
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Not Listed Fallback Trigger */}
                      <div className="mt-2.5 flex items-center justify-between p-2.5 rounded-xl bg-muted/50 border border-border text-xs">
                        <span className="text-muted-foreground font-medium">Can't find your institution?</span>
                        <button
                          type="button"
                          onClick={() => setIsRequestModalOpen(true)}
                          className="text-primary font-bold hover:underline flex items-center gap-1 text-xs"
                        >
                          <Building className="w-3.5 h-3.5" /> Request Verification
                        </button>
                      </div>

                      {/* Registered Partner Campuses Fallback */}
                      {!selectedInstitution && !pendingRequest && approvedUniversities.length > 0 && (
                        <div className="mt-3 pt-2 border-t border-border/60">
                          <label className="block text-[11px] font-bold text-muted-foreground mb-1">
                            Or select from registered partner campuses:
                          </label>
                          <select
                            className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[40px]"
                            value={selectedUnivId}
                            onChange={(e) => setSelectedUnivId(e.target.value)}
                          >
                            <option value="">-- Select Partner Campus --</option>
                            {approvedUniversities.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.city ? `${u.city}, ` : ''}{u.state})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Department / Branch"
                    placeholder="e.g. Computer Science & Engineering"
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
                    placeholder="React, Python, IoT, AI, Field Research"
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

      {/* Institution Verification Request Modal */}
      <InstitutionRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        defaultEmail={email}
        defaultName={institutionQuery}
        onRequestSubmitted={handlePendingRequestSubmitted}
      />
    </div>
  );
};
