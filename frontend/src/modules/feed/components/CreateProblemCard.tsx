import React, { useState } from 'react';
import { Problem, ProblemCategory } from '../../../types/problem';
import { useAuthStore } from '../../../store/authStore';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Image, MapPin, PlusCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export const CreateProblemCard: React.FC<{ onCreated?: (problem: Problem) => void }> = ({ onCreated }) => {
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProblemCategory>('Water & Sanitation');
  const [location, setLocation] = useState('New Delhi');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const newProblem: Problem = {
      id: `prob-${Date.now()}`,
      title,
      description,
      category,
      state: 'Delhi',
      district: location,
      location: `${location}, Delhi`,
      impactLevel: 'high',
      status: 'reported',
      author: {
        id: user?.id || 'citizen-1',
        name: user?.email ? user.email.split('@')[0] : 'Community Member',
        role: user?.role || 'citizen',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
        location: `${location}, Delhi`,
        verified: true,
      },
      tags: [category.split(' ')[0], 'Community'],
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      savesCount: 0,
      activeTeamsCount: 0,
      interestedUniversitiesCount: 0,
      industrySponsorsCount: 0,
      createdAt: 'Just now',
      isLiked: false,
      isSaved: false,
    };

    if (onCreated) onCreated(newProblem);
    toast.success('Problem published to community feed!');
    setTitle('');
    setDescription('');
    setIsOpen(false);
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
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
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Ranchi, Jharkhand)"
              className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px]"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border flex-wrap gap-2">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <button type="button" className="p-2 rounded-xl hover:bg-muted hover:text-foreground min-h-[40px] min-w-[40px] flex items-center justify-center" aria-label="Add photo">
                <Image className="w-4 h-4 text-emerald-500" />
              </button>
              <button type="button" className="p-2 rounded-xl hover:bg-muted hover:text-foreground min-h-[40px] min-w-[40px] flex items-center justify-center" aria-label="Add location">
                <MapPin className="w-4 h-4 text-rose-500" />
              </button>
              <span className="text-xs text-primary flex items-center gap-1 font-medium hidden sm:inline-flex">
                <Sparkles className="w-3.5 h-3.5" /> AI Analysis
              </span>
            </div>

            <Button type="submit" size="sm" className="min-h-[40px] px-5 font-bold text-sm">
              Publish Challenge
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};
