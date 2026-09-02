import React, { useState } from 'react';
import { Problem } from '../../../types/problem';
import { Card } from '../../../shared/components/ui/Card';
import { ProblemStatusBadge, ImpactBadge } from './ProblemStatusBadge';
import { PostHeader } from './PostHeader';
import { AIInsightCard } from './AIInsightCard';
import { PostActions } from './PostActions';
import { PostComments } from './PostComments';
import { Users, GraduationCap, Building2, Languages } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useLanguageStore } from '../../../store/languageStore';
import { getTranslation } from '../../../lib/translations';
import { problemsApi } from '../../../api/problems';
import { socialApi } from '../../../api/social';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../shared/components/ui/Button';
import toast from 'react-hot-toast';

const DEFAULT_POST_IMAGE_FALLBACK = 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg';

export const ProblemPost: React.FC<{ problem: Problem }> = ({ problem }) => {
  const { user } = useAuthStore();
  const { language } = useLanguageStore();
  const t = (key: string) => getTranslation(language, key);

  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(problem.description);
  const [translated, setTranslated] = useState(false);

  const client = useQueryClient();
  const isOwner = user?.id === problem.author.id;

  const saveEdit = async () => {
    try {
      await problemsApi.updateProblem(problem.id, { description: editText });
      client.invalidateQueries({ queryKey: ['problems'] });
      client.invalidateQueries({ queryKey: ['my-problems'] });
      setEditing(false);
      toast.success(language === 'hi' ? 'समस्या अपडेट की गई।' : 'Challenge updated.');
    } catch {
      toast.error('Failed to update challenge.');
    }
  };

  const deletePost = async () => {
    if (!window.confirm(language === 'hi' ? 'क्या आप इस समस्या को स्थायी रूप से हटाना चाहते हैं?' : 'Delete this challenge permanently?')) return;
    try {
      await problemsApi.deleteProblem(problem.id);
      client.invalidateQueries({ queryKey: ['problems'] });
      client.invalidateQueries({ queryKey: ['my-problems'] });
      toast.success(language === 'hi' ? 'समस्या हटाई गई।' : 'Challenge deleted.');
    } catch {
      toast.error('Failed to delete challenge.');
    }
  };

  const reportPost = async () => {
    const reason = window.prompt(language === 'hi' ? 'आप इस समस्या की रिपोर्ट क्यों कर रहे हैं?' : 'Why are you reporting this challenge?');
    if (!reason) return;
    try {
      const result = await socialApi.reportProblem(problem.id, reason);
      toast.success(result.reported ? (language === 'hi' ? 'रिपोर्ट दर्ज की गई।' : 'Report submitted.') : (language === 'hi' ? 'आप पहले ही रिपोर्ट कर चुके हैं।' : 'You have already reported this challenge.'));
    } catch {
      toast.error('Failed to submit report.');
    }
  };

  const firstMedia = problem.images && problem.images.length > 0 ? problem.images[0] : null;
  const isVideoMedia = Boolean(
    firstMedia && (firstMedia.match(/\.(mp4|webm|mov|mkv)($|\?)/i) || firstMedia.includes('/video/upload/') || firstMedia.startsWith('data:video/'))
  );

  const categoryTranslationMap: Record<string, string> = {
    'Water & Sanitation': t('cat_water'),
    'Clean Energy & Solar': t('cat_energy'),
    'Waste Management': t('cat_waste'),
    'Agriculture & Rural Tech': t('cat_agri'),
    'Healthcare & Medical Devices': t('cat_health'),
    'Smart Infrastructure & Roads': t('cat_infra'),
  };

  const displayCategory = categoryTranslationMap[problem.category] || problem.category;

  const isHindiMode = language === 'hi' || translated;

  return (
    <Card className="p-5 sm:p-6 border-border shadow-xs hover:border-border/80 transition-all space-y-4 rounded-2xl">
      {/* 1. Header (Author Avatar, Location, Timestamp) */}
      <PostHeader
        author={problem.author}
        createdAt={problem.createdAt}
        location={`${problem.district}, ${problem.state}`}
        isOwner={isOwner}
        onEdit={() => setEditing(true)}
        onDelete={deletePost}
        onReport={reportPost}
      />

      {/* 2. Title & Status Badges */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <ProblemStatusBadge status={problem.status} />
            <ImpactBadge impact={problem.impactLevel} />
            <span className="text-xs uppercase font-bold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-md">
              {displayCategory}
            </span>
          </div>

          {/* Quick Post Translation Button */}
          <button
            onClick={() => setTranslated(!translated)}
            className="flex items-center gap-1 text-[11px] font-bold text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-md"
            title="Translate post text"
          >
            <Languages className="w-3 h-3" />
            <span>{isHindiMode ? 'English' : 'अनुवाद (Hindi)'}</span>
          </button>
        </div>

        <a href={`/problems/${problem.id}`} className="block group">
          <h2 className="text-lg sm:text-xl font-extrabold text-foreground group-hover:text-primary transition-colors leading-snug">
            {problem.title}
          </h2>
        </a>
      </div>

      {/* 3. Description Content */}
      <p className="text-sm sm:text-base text-foreground/85 leading-relaxed">{problem.description}</p>

      {/* 4. Problem Media (Image or Video) */}
      {firstMedia && (
        <div className="rounded-xl overflow-hidden border border-border/60 max-h-96">
          {isVideoMedia ? (
            <video
              src={firstMedia}
              controls
              className="w-full max-h-96 object-cover rounded-xl"
            />
          ) : (
            <img
              src={firstMedia}
              alt={problem.title}
              onError={(e) => {
                e.currentTarget.src = DEFAULT_POST_IMAGE_FALLBACK;
              }}
              className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-300"
              loading="lazy"
            />
          )}
        </div>
      )}

      {/* 5. Tags */}
      {problem.tags && problem.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {problem.tags.map((tag, idx) => (
            <span
              key={idx}
              className="text-xs font-semibold text-primary bg-primary/5 px-2.5 py-0.5 rounded-md"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 6. Contextual AI Insight */}
      {problem.aiInsight && (
        <AIInsightCard insight={problem.aiInsight} problemId={problem.id} />
      )}

      {/* 7. Real Collaboration Traction Bar */}
      {(problem.activeTeamsCount > 0 || problem.interestedUniversitiesCount > 0 || problem.industrySponsorsCount > 0) && (
        <div className="flex items-center gap-4 py-2 px-3.5 bg-muted/40 rounded-xl text-xs text-muted-foreground flex-wrap">
          {problem.activeTeamsCount > 0 && (
            <div className="flex items-center gap-1.5 text-primary font-semibold">
              <Users className="w-4 h-4" />
              <span>{problem.activeTeamsCount} {language === 'hi' ? 'सक्रिय समाधान पॉड्स' : 'Solution Pods Active'}</span>
            </div>
          )}
          {problem.interestedUniversitiesCount > 0 && (
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <GraduationCap className="w-4 h-4 text-purple-500" />
              <span>{problem.interestedUniversitiesCount} {language === 'hi' ? 'विश्वविद्यालय मेंटर' : 'University Mentors'}</span>
            </div>
          )}
          {problem.industrySponsorsCount > 0 && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
              <Building2 className="w-4 h-4" />
              <span>{problem.industrySponsorsCount} {language === 'hi' ? 'सीएसआर प्रायोजक' : 'CSR Sponsor Bounties'}</span>
            </div>
          )}
        </div>
      )}

      {/* 8. Social Action Buttons */}
      <PostActions
        problemId={problem.id}
        likesCount={problem.likesCount}
        commentsCount={problem.commentsCount}
        isLiked={problem.isLiked}
        isSaved={problem.isSaved}
        onToggleCommentSection={() => setShowComments(!showComments)}
      />

      {/* 9. Inline Comments Thread */}
      {showComments && <PostComments problemId={problem.id} comments={problem.comments} />}
      
      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg space-y-3">
            <h3 className="font-bold">{language === 'hi' ? 'समस्या संपादित करें' : 'Edit challenge'}</h3>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full min-h-28 p-3 bg-background border border-border rounded-xl"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>{t('cancel')}</Button>
              <Button size="sm" onClick={saveEdit}>{t('save')}</Button>
            </div>
          </Card>
        </div>
      )}
    </Card>
  );
};
