import React, { useState } from 'react';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { useAuthStore } from '../../../store/authStore';
import { getRoleConfig } from '../../../config/roles';
import { EmptyState } from '../../../shared/components/ui/EmptyState';
import { 
  MapPin, 
  Award, 
  CheckCircle2, 
  Settings,
  User,
  Inbox
} from 'lucide-react';
import toast from 'react-hot-toast';

export const ProfilePage: React.FC = () => {
  const { user } = useAuthStore();
  const activeRole = user?.role || 'citizen';
  const config = getRoleConfig(activeRole);
  const [activeTab, setActiveTab] = useState<'posts' | 'solutions' | 'badges'>('posts');

  const displayName = user?.email ? user.email.split('@')[0] : 'Community Solver';

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header Banner & Avatar Card */}
      <Card className="p-0 overflow-hidden border-border rounded-2xl">
        <div className="h-28 bg-gradient-to-r from-primary to-indigo-700 relative" />
        <div className="p-5 sm:p-6 pt-0 space-y-4">
          <div className="flex items-end justify-between -mt-12 mb-2">
            <div className="w-24 h-24 rounded-2xl ring-4 ring-card shadow-lg bg-primary text-primary-foreground font-black text-2xl flex items-center justify-center uppercase">
              {displayName.slice(0, 2)}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.success('Profile settings')}>
                <Settings className="w-4 h-4 mr-1.5" /> Edit Profile
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold text-foreground">{displayName}</h1>
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <Badge variant="student" className="text-xs uppercase">
                {config.displayName}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {user?.email || 'Active Community Contributor'}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> India
            </span>
            <span className="flex items-center gap-1.5 text-primary font-bold">
              <Award className="w-4 h-4" /> Active Solver
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Profile Tabs */}
      <div className="flex border-b border-border text-sm font-bold">
        <button
          onClick={() => setActiveTab('posts')}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            activeTab === 'posts' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Activity & Challenges
        </button>
        <button
          onClick={() => setActiveTab('solutions')}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            activeTab === 'solutions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Solution Pods
        </button>
        <button
          onClick={() => setActiveTab('badges')}
          className={`pb-3 px-4 border-b-2 transition-colors ${
            activeTab === 'badges' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Badges & Credentials
        </button>
      </div>

      {/* 3. Dynamic Empty States */}
      <div className="space-y-4">
        {activeTab === 'posts' && (
          <EmptyState
            icon={Inbox}
            title="No reported challenges yet"
            description="Challenges and issues you report to the community will appear here."
            actionLabel="Report a Challenge"
            onAction={() => (window.location.href = '/')}
          />
        )}

        {activeTab === 'solutions' && (
          <EmptyState
            icon={User}
            title="No active solution pods"
            description="Join an interdisciplinary team or start your own pod to solve societal problems."
            actionLabel="Explore Pods"
            onAction={() => (window.location.href = '/teams')}
          />
        )}

        {activeTab === 'badges' && (
          <EmptyState
            icon={Award}
            title="No badges earned yet"
            description="Earn verified credentials by contributing validated solutions and collaborating with mentors."
          />
        )}
      </div>
    </div>
  );
};
