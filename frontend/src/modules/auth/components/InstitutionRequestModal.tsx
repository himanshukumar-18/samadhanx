import React, { useState } from 'react';
import { X, Building, AlertCircle, Send } from 'lucide-react';
import { Button } from '../../../shared/components/ui/Button';
import { Input } from '../../../shared/components/ui/Input';
import { Card, CardTitle, CardDescription } from '../../../shared/components/ui/Card';
import { institutionsApi, InstitutionVerificationRequestItem } from '../../../api/institutions';
import toast from 'react-hot-toast';

interface InstitutionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail: string;
  defaultName?: string;
  onRequestSubmitted: (request: InstitutionVerificationRequestItem) => void;
}

const INSTITUTION_TYPES = [
  'College',
  'University',
  'Institute',
  'Autonomous College',
  'Polytechnic',
  'Other',
];

export const InstitutionRequestModal: React.FC<InstitutionRequestModalProps> = ({
  isOpen,
  onClose,
  defaultEmail,
  defaultName = '',
  onRequestSubmitted,
}) => {
  const [name, setName] = useState(defaultName);
  const [type, setType] = useState('College');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [aisheCode, setAisheCode] = useState('');
  const [ugcCode, setUgcCode] = useState('');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState(defaultEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync default values when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (defaultName) setName(defaultName);
      if (defaultEmail) setEmail(defaultEmail);
    }
  }, [isOpen, defaultName, defaultEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim() || name.trim().length < 3) {
      setErrorMsg('Please enter a valid institution name (at least 3 characters).');
      return;
    }
    if (!state.trim()) {
      setErrorMsg('State is required.');
      return;
    }
    if (!district.trim()) {
      setErrorMsg('District is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('A valid email address is required to track verification.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await institutionsApi.submitVerificationRequest({
        submitted_by_email: email.trim().toLowerCase(),
        requested_name: name.trim(),
        institution_type: type,
        state: state.trim(),
        district: district.trim(),
        city: city.trim() || undefined,
        official_website: website.trim() || undefined,
        aishe_code: aisheCode.trim() || undefined,
        ugc_code: ugcCode.trim() || undefined,
        additional_notes: notes.trim() || undefined,
      });

      toast.success('Institution verification request submitted! You can now proceed with registration.');
      if (res.data) {
        onRequestSubmitted(res.data);
      }
      onClose();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: { message?: string } | string; message?: string } } };
      const detail = errorObj.response?.data?.detail;
      const msg = (typeof detail === 'object' ? detail?.message : detail) || errorObj.response?.data?.message || 'Failed to submit institution request. Please try again.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg my-8">
        <Card className="shadow-2xl border-border">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                <Building className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-black">Request Institution Verification</CardTitle>
                <CardDescription className="text-xs">
                  Submit unlisted college/university for official verification
                </CardDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <Input
              label="Official Institution / College Name *"
              placeholder="e.g. St. Xavier's Institute of Rural Technology"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
                  Institution Type *
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none min-h-[42px]"
                >
                  {INSTITUTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Your Email Address *"
                type="email"
                placeholder="student@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="State *"
                placeholder="e.g. Jharkhand"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              />
              <Input
                label="District *"
                placeholder="e.g. Ranchi"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="City / Town (Optional)"
                placeholder="e.g. Namkum"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
              <Input
                label="Official Website (Optional)"
                placeholder="https://..."
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="AISHE Code (Optional)"
                placeholder="e.g. C-12345"
                value={aisheCode}
                onChange={(e) => setAisheCode(e.target.value)}
              />
              <Input
                label="UGC Code (Optional)"
                placeholder="e.g. UGC-9876"
                value={ugcCode}
                onChange={(e) => setUgcCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">
                Additional Notes / Reason (Optional)
              </label>
              <textarea
                placeholder="Provide any affiliation details, college website links or registration context..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs text-foreground focus:ring-2 focus:ring-primary/40 focus:border-primary focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="font-bold"
                isLoading={isLoading}
                rightIcon={<Send className="w-3.5 h-3.5" />}
              >
                Submit & Continue Registration
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
