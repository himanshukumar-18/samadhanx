import React, { useState } from 'react';
import { apiClient } from '../../../api/client';
import { useInstitutionSearch, InstitutionMasterItem } from '../../../hooks/useInstitutionSearch';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Badge } from '../../../shared/components/ui/Badge';
import { Logo } from '../../../shared/components/Logo';
import {
  Building2,
  Landmark,
  ArrowRight,
  AlertCircle,
  Search,
  CheckCircle2,
  X,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const RequestAccessPage: React.FC = () => {
  const [orgType, setOrgType] = useState<'university' | 'industry'>('university');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [nodalOfficer, setNodalOfficer] = useState('');
  const [officialEmail, setOfficialEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [designation, setDesignation] = useState('');
  const [focusSectors, setFocusSectors] = useState('');

  // Institution Master selector state
  const [instSearchQuery, setInstSearchQuery] = useState('');
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionMasterItem | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: instResults, isLoading: isSearchingInsts } = useInstitutionSearch(
    instSearchQuery,
    orgType === 'university' && !selectedInstitution && !isManualEntry
  );

  const masterList = instResults?.data || [];

  const handleSelectInstitution = (inst: InstitutionMasterItem) => {
    setSelectedInstitution(inst);
    setOrgName(inst.name);
    setIdentifier(inst.aishe_code || inst.ugc_code || '');
    setState(inst.state);
    setDistrict(inst.district);
    setInstSearchQuery('');
  };

  const handleClearInstitution = () => {
    setSelectedInstitution(null);
    setOrgName('');
    setIdentifier('');
    setState('');
    setDistrict('');
    setInstSearchQuery('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (orgType === 'university') {
        await apiClient.post('/auth/register/university-request', {
          email: email.trim().toLowerCase(),
          password,
          university_name: orgName.trim(),
          institution_id: selectedInstitution?.id || undefined,
          aishe_code: identifier.trim() || undefined,
          state: state.trim(),
          district: district.trim(),
          nodal_officer_name: nodalOfficer.trim(),
          official_email: officialEmail.trim().toLowerCase(),
          website: website.trim() || undefined,
        });
      } else {
        await apiClient.post('/auth/register/industry-request', {
          email: email.trim().toLowerCase(),
          password,
          company_name: orgName.trim(),
          cin_number: identifier.trim() || undefined,
          website: website.trim() || undefined,
          point_of_contact_name: nodalOfficer.trim(),
          designation: designation.trim(),
          focus_sectors: focusSectors.split(',').map((s) => s.trim()).filter(Boolean),
        });
      }

      toast.success('Access request submitted! Please verify OTP.');
      window.location.href = `/verify-otp?email=${encodeURIComponent(email.trim().toLowerCase())}`;
    } catch (err: unknown) {
      const errorObj = err as {
        response?: { data?: { error?: { message?: string }; detail?: { message?: string } | string; message?: string } };
      };
      const detail = errorObj.response?.data?.detail;
      const msg =
        (typeof detail === 'object' ? detail?.message : detail) ||
        errorObj.response?.data?.error?.message ||
        errorObj.response?.data?.message ||
        'Failed to submit institutional request.';
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
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
              <Landmark className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-black">Institutional Access Request</CardTitle>
            <CardDescription>
              Higher Education & Corporate onboarding workflow subject to National Governance Desk verification
            </CardDescription>

            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-xl mt-4">
              <button
                type="button"
                onClick={() => {
                  setOrgType('university');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all min-h-[40px] ${
                  orgType === 'university'
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Landmark className="w-4 h-4" /> University / Institute
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrgType('industry');
                  setErrorMsg(null);
                }}
                className={`py-2.5 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all min-h-[40px] ${
                  orgType === 'industry'
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Building2 className="w-4 h-4" /> Industry Partner / CSR
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
            {/* University Institutional Master Search Selection */}
            {orgType === 'university' && !isManualEntry && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Verified Institution Master Search
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsManualEntry(true);
                      handleClearInstitution();
                    }}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Enter Unlisted Institution
                  </button>
                </div>

                {selectedInstitution ? (
                  <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-sm font-bold text-foreground">{selectedInstitution.name}</span>
                        <Badge variant="university">Verified Master</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        AISHE: <span className="font-mono font-medium">{selectedInstitution.aishe_code || 'N/A'}</span> • {selectedInstitution.district}, {selectedInstitution.state}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearInstitution}
                      className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted"
                      title="Change selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Type college / university name or AISHE code (e.g., IIT, U-0109)..."
                      value={instSearchQuery}
                      onChange={(e) => setInstSearchQuery(e.target.value)}
                      leftIcon={<Search className="w-4 h-4 text-muted-foreground" />}
                    />
                    {instSearchQuery.trim().length >= 2 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-xl divide-y divide-border">
                        {isSearchingInsts ? (
                          <div className="p-3 text-xs text-muted-foreground text-center">Searching master directory...</div>
                        ) : masterList.length === 0 ? (
                          <div className="p-3 text-xs text-muted-foreground text-center">
                            No matching institutions found in registry.{' '}
                            <button
                              type="button"
                              onClick={() => {
                                setIsManualEntry(true);
                                setOrgName(instSearchQuery);
                              }}
                              className="text-primary font-bold hover:underline"
                            >
                              Enter manually
                            </button>
                          </div>
                        ) : (
                          masterList.map((inst) => (
                            <button
                              type="button"
                              key={inst.id}
                              onClick={() => handleSelectInstitution(inst)}
                              className="w-full p-2.5 text-left hover:bg-muted/70 transition-colors flex items-center justify-between"
                            >
                              <div>
                                <div className="text-xs font-bold text-foreground">{inst.name}</div>
                                <div className="text-[11px] text-muted-foreground">
                                  AISHE: {inst.aishe_code || 'N/A'} • {inst.district}, {inst.state}
                                </div>
                              </div>
                              <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {orgType === 'university' && isManualEntry && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
                <span>Entering unlisted institution details manually.</span>
                <button
                  type="button"
                  onClick={() => setIsManualEntry(false)}
                  className="font-bold underline hover:opacity-80"
                >
                  Back to Master Search
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={orgType === 'university' ? 'University / College Name' : 'Company / Corporate Name'}
                placeholder={orgType === 'university' ? 'e.g. IIT Delhi' : 'e.g. Tata Motors'}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                readOnly={Boolean(selectedInstitution)}
                required
              />
              <Input
                label={orgType === 'university' ? 'AISHE Code' : 'CIN / GST (Optional)'}
                placeholder={orgType === 'university' ? 'e.g. U-0109' : 'L28920MH1945PLC004520'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                readOnly={Boolean(selectedInstitution && selectedInstitution.aishe_code)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={orgType === 'university' ? 'Nodal Officer / Dean Full Name' : 'Point of Contact Name'}
                placeholder="Dr. Rajesh Sharma"
                value={nodalOfficer}
                onChange={(e) => setNodalOfficer(e.target.value)}
                required
              />
              <Input
                label="Official Institutional Email"
                type="email"
                placeholder="nodal@univ.ac.in"
                value={officialEmail}
                onChange={(e) => setOfficialEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Portal Login Email"
                type="email"
                placeholder="admin@univ.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Portal Password (min 8 chars)"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {orgType === 'university' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="State"
                  placeholder="e.g. Maharashtra"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  readOnly={Boolean(selectedInstitution)}
                  required
                />
                <Input
                  label="District"
                  placeholder="e.g. Mumbai"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  readOnly={Boolean(selectedInstitution)}
                  required
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Contact Designation"
                  placeholder="Head of CSR & Innovation"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  required
                />
                <Input
                  label="Focus Sectors (comma separated)"
                  placeholder="CleanTech, Water, AgriTech"
                  value={focusSectors}
                  onChange={(e) => setFocusSectors(e.target.value)}
                />
              </div>
            )}

            <Input
              label="Official Website URL"
              placeholder="https://www.univ.ac.in"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />

            <div className="p-3.5 bg-muted/60 rounded-xl text-xs text-muted-foreground border border-border">
              ℹ️ After verifying email OTP, your application will be verified by the National Governance Desk. You will receive an official activation email once verified.
            </div>

            <Button type="submit" className="w-full font-bold" isLoading={isLoading} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Submit Request for Governance Review
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
