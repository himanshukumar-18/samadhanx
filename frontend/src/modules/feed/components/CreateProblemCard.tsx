import React, { useState } from 'react';
import { ProblemCategory } from '../../../types/problem';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Image as ImageIcon, MapPin, PlusCircle, Sparkles, Loader2, Video } from 'lucide-react';
import { problemsApi } from '../../../api/problems';
import toast from 'react-hot-toast';

export const CreateProblemCard: React.FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProblemCategory>('Water & Sanitation');
  const [district, setDistrict] = useState('New Delhi');
  const [stateName, setStateName] = useState('Delhi');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    try {
      setIsUploading(true);
      const res = await problemsApi.uploadMedia(file);
      setMediaUrl(res.url);
      toast.success('Media uploaded to Cloudinary.');
    } catch {
      toast.error('Failed to upload media.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFetchLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        setDistrict(`GPS (${lat}, ${lng})`);
        setIsLocating(false);
        toast.success(`GPS Location tagged: ${lat}, ${lng}`);
      },
      () => {
        setIsLocating(false);
        toast.error('Unable to retrieve GPS location.');
      }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    try {
      setIsLoading(true);
      await problemsApi.createProblem({
        title,
        description,
        category,
        district,
        state: stateName,
        location: `${district}, ${stateName}`,
        impact_level: 'high',
        tags: [category.split(' ')[0], 'Community'],
        media_urls: mediaUrl ? [mediaUrl] : [],
      });

      toast.success('Problem challenge published to community feed!');
      setTitle('');
      setDescription('');
      setMediaUrl(null);
      setIsOpen(false);
      if (onCreated) onCreated();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(errorObj.response?.data?.error?.message || 'Failed to publish problem submission.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 shadow-xs border-border rounded-2xl">
      {!isOpen ? (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm uppercase flex-shrink-0">
            {user?.email ? user.email.slice(0, 2) : 'SX'}
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className="flex-1 text-left bg-muted/70 hover:bg-muted text-muted-foreground px-4 py-2.5 rounded-full text-sm font-medium transition-all min-h-[44px] flex items-center"
          >
            What societal problem or challenge are you seeing?
          </button>
          <Button variant="primary" size="sm" className="min-h-[44px] px-4 font-bold text-sm" onClick={() => setIsOpen(true)} leftIcon={<PlusCircle className="w-4 h-4" />} aria-label="Report problem">
            Report
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5 animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-sm font-bold text-foreground">Report Societal Challenge</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground min-h-[36px] px-2 font-medium"
            >
              Cancel
            </button>
          </div>

          <input
            type="text"
            placeholder="Problem Title (e.g. Broken drainage causing monsoon waterlogging in Ward 4)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-background rounded-xl px-4 py-2.5 text-sm font-bold border border-border focus:border-primary focus:outline-none min-h-[44px]"
            required
          />

          <textarea
            placeholder="Describe the issue, who is affected, and what solution would help..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full h-28 bg-background rounded-xl p-3.5 text-sm border border-border focus:border-primary focus:outline-none leading-relaxed"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-sm">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProblemCategory)}
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px]"
            >
              <option value="Water & Sanitation">Water & Sanitation</option>
              <option value="Clean Energy & Solar">Clean Energy & Solar</option>
              <option value="Waste Management">Waste Management</option>
              <option value="Agriculture & Rural Tech">Agriculture & Rural Tech</option>
              <option value="Healthcare & Medical Devices">Healthcare & Medical Devices</option>
              <option value="Smart Infrastructure & Roads">Smart Infrastructure & Roads</option>
            </select>

            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="District / GPS Location"
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px]"
              required
            />

            <input
              type="text"
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              placeholder="State (e.g. Rajasthan)"
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px]"
              required
            />
          </div>

          {mediaUrl && (
            <div className="p-2 border border-border rounded-xl bg-muted/30 flex items-center justify-between text-xs">
              <span className="text-emerald-600 font-semibold truncate max-w-[250px]">Cloudinary Image Attached</span>
              <button type="button" onClick={() => setMediaUrl(null)} className="text-destructive text-[11px]">Remove</button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border flex-wrap gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <label className="p-2 rounded-xl hover:bg-muted hover:text-foreground min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer">
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <ImageIcon className="w-4 h-4 text-emerald-500" />}
                <input type="file" accept="image/*,video/*" onChange={handleMediaUpload} className="hidden" />
              </label>
              <Video className="w-4 h-4 text-primary" />
              <button
                type="button"
                onClick={handleFetchLocation}
                className="p-2 rounded-xl hover:bg-muted hover:text-foreground min-h-[40px] min-w-[40px] flex items-center justify-center"
                aria-label="Add location"
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> : <MapPin className="w-4 h-4 text-rose-500" />}
              </button>
              <span className="text-xs text-primary flex items-center gap-1 font-medium hidden sm:inline-flex">
                <Sparkles className="w-3.5 h-3.5" /> Cloudinary Media Enabled
              </span>
            </div>

            <Button type="submit" size="sm" isLoading={isLoading} className="min-h-[40px] px-5 font-bold text-sm">
              Publish Challenge
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};
