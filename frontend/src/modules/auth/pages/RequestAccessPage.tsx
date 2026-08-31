import React, { useState } from 'react';
import { apiClient } from '../../../lib/apiClient';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { Building2, Landmark, ArrowRight, AlertCircle } from 'lucide-react';
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

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (orgType === 'university') {
        await apiClient.post('/auth/register/university-request', {
          email,
          password,
          university_name: orgName,
          aishe_code: identifier || undefined,
          state,
          district,
          nodal_officer_name: nodalOfficer,
          official_email: officialEmail,
          website: website || undefined,
        });
      } else {
        await apiClient.post('/auth/register/industry-request', {
          email,
          password,
          company_name: orgName,
          cin_number: identifier || undefined,
          website: website || undefined,
          point_of_contact_name: nodalOfficer,
          designation,
          focus_sectors: focusSectors.split(',').map((s) => s.trim()).filter(Boolean),
        });
      }

      toast.success('Access request submitted! Please verify OTP.');
      window.location.href = `/verify-otp?email=${encodeURIComponent(email)}`;
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Failed to submit request.';
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
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center mx-auto mb-2">
              <Landmark className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl">Institutional Access Request</CardTitle>
            <CardDescription>
              Government / College / Corporate onboarding workflow requiring governance verification
            </CardDescription>

            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mt-4">
              <button
                type="button"
                onClick={() => setOrgType('university')}
                className={`py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                  orgType === 'university'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Landmark className="w-4 h-4" /> University / Institute
              </button>
              <button
                type="button"
                onClick={() => setOrgType('industry')}
                className={`py-2 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-2 transition-all ${
                  orgType === 'industry'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Building2 className="w-4 h-4" /> Industry Partner / CSR
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
                label={orgType === 'university' ? 'University / College Name' : 'Company / Corporate Name'}
                placeholder={orgType === 'university' ? 'e.g. IIT Delhi' : 'e.g. Tata Motors'}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
              <Input
                label={orgType === 'university' ? 'AISHE Code (Optional)' : 'CIN / GST (Optional)'}
                placeholder={orgType === 'university' ? 'U-0109' : 'L28920MH1945PLC004520'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={orgType === 'university' ? 'Nodal Officer / Dean Name' : 'Point of Contact Name'}
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
                  required
                />
                <Input
                  label="District"
                  placeholder="e.g. Mumbai"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
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
              placeholder="https://..."
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-xs text-slate-500 dark:text-slate-400">
              ℹ️ After verifying email OTP, your application is reviewed by the Platform Admin. You will receive an approval email once granted access.
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading} rightIcon={<ArrowRight className="w-4 h-4" />}>
              Submit Request for Governance Review
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
