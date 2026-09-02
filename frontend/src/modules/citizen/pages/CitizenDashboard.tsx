import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';
import { Card } from '../../../shared/components/ui/Card';
import { Button } from '../../../shared/components/ui/Button';
import { Badge } from '../../../shared/components/ui/Badge';
import { Skeleton } from '../../../shared/components/ui/Skeleton';
import { PlusCircle, MapPin, CheckCircle, Clock, AlertTriangle, FileText } from 'lucide-react';
import { problemsApi } from '../../../api/problems';

interface ProblemItem {
  id: string;
  category: string;
  district: string;
  state: string;
  title: string;
  description: string;
  status: string;
}

export const CitizenDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['citizen-dashboard-metrics'],
    queryFn: () => problemsApi.getCitizenDashboard(),
  });

  const { data: myProblems, isLoading: loadingProblems } = useQuery({
    queryKey: ['my-submitted-problems'],
    queryFn: () => problemsApi.getMyProblems(),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-foreground">
              {language === 'hi' ? 'नागरिक सहयोग हब' : 'Citizen Collaboration Hub'}
            </h1>
            <Badge variant="citizen">
              {language === 'hi' ? 'नागरिक रिपोर्टर' : 'Citizen Submitter'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {language === 'hi' ? 'स्वागत है,' : 'Welcome,'} <strong className="text-foreground">{user?.full_name || user?.email}</strong>. {language === 'hi' ? 'विश्वविद्यालय और छात्र नवाचार के लिए अपने क्षेत्र में सामाजिक समस्याओं की रिपोर्ट करें।' : 'Report societal problems in your area for university & student innovation.'}
          </p>
        </div>
        <Button onClick={() => (window.location.href = '/')} leftIcon={<PlusCircle className="w-4 h-4" />}>
          {t('report_issue')}
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              {loadingMetrics ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{metrics?.solved_problems_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground font-semibold">{t('stat_solved')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              {loadingMetrics ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{metrics?.active_teams_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground font-semibold">
                {language === 'hi' ? 'सक्रिय समाधान पॉड्स' : 'Active Solution Pods'}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 rounded-2xl border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              {loadingMetrics ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <div className="text-2xl font-black text-foreground">{metrics?.pending_review_count ?? 0}</div>
              )}
              <div className="text-xs text-muted-foreground font-semibold">{t('stat_pending')}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* My Submitted Problems List */}
      <div className="space-y-4">
        <h2 className="text-base sm:text-lg font-extrabold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> {t('my_problems')}
        </h2>

        {loadingProblems ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : Array.isArray(myProblems) && myProblems.length > 0 ? (
          <div className="grid grid-cols-1 gap-3.5">
            {myProblems.map((prob: ProblemItem) => (
              <Card key={prob.id} className="p-4 hover:border-primary/50 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 rounded-2xl">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                      {prob.category}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-500" /> {prob.district}, {prob.state}
                    </span>
                  </div>
                  <a href={`/problems/${prob.id}`} className="font-bold text-foreground text-sm sm:text-base hover:text-primary transition-colors line-clamp-1">
                    {prob.title}
                  </a>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{prob.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={prob.status === 'verified' ? 'approved' : 'pending'}>
                    {prob.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => (window.location.href = `/problems/${prob.id}`)}>
                    {t('view_details')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12 border-border rounded-2xl">
            <MapPin className="w-12 h-12 text-primary mx-auto mb-3 opacity-60" />
            <h3 className="text-base font-bold text-foreground">
              {language === 'hi' ? 'अभी तक कोई दर्ज समस्या नहीं है' : 'No community issues reported yet'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
              {language === 'hi' 
                ? 'छात्र नवप्रवर्तकों के साथ मिलान प्राप्त करने के लिए सड़क के खतरों, पानी की गुणवत्ता के मुद्दों, या स्थानीय नगर निगम की चुनौतियों की रिपोर्ट करें।'
                : 'Report road hazards, water quality issues, or local municipal challenges to get matched with student innovators.'
              }
            </p>
            <Button onClick={() => (window.location.href = '/')} leftIcon={<PlusCircle className="w-4 h-4" />}>
              {t('report_issue')}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
};
