import { FileSearch, HandCoins, Link2, Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useHistory } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { ActionCard } from '@/components/ActionCard';
import { PendingChecks } from '@/components/PendingChecks';
import { RiskBadge } from '@/components/ui/RiskCard';
import { formatDateTime } from '@/lib/format';

export default function Home() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const history = useHistory();
  const recent = history.data?.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl leading-tight font-extrabold">{t('home.title')}</h1>
        <p className="text-muted">
          {session?.kind === 'user'
            ? t('home.signedIn', { email: session.email })
            : t('home.guestHint')}
        </p>
      </header>

      <PendingChecks />

      <div className="flex flex-col gap-3">
        <ActionCard
          to="/app/scan/notice"
          icon={FileSearch}
          title={t('home.notice')}
          description={t('home.noticeDesc')}
        />
        <ActionCard
          to="/app/scan/link"
          icon={Link2}
          title={t('home.link')}
          description={t('home.linkDesc')}
        />
        <ActionCard
          to="/app/scan/voice"
          icon={Mic}
          title={t('home.voice')}
          description={t('home.voiceDesc')}
          tag={t('home.soon')}
        />
        <ActionCard
          to="/app/sent-money"
          icon={HandCoins}
          tone="danger"
          title={t('home.sentMoney')}
          description={t('home.sentMoneyDesc')}
        />
      </div>

      {recent.length > 0 && (
        <section aria-labelledby="recent-title" className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 id="recent-title" className="text-lg font-extrabold">
              {t('home.recent')}
            </h2>
            <Link
              to="/app/history"
              className="min-h-11 content-center text-sm font-bold text-primary"
            >
              {t('home.seeAll')}
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/app/scan/${item.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-2"
                >
                  <span className="flex flex-col">
                    <span className="font-semibold">{t(`kinds.${item.kind}`)}</span>
                    <span className="text-xs text-muted">
                      {formatDateTime(item.createdAt, i18n.language)}
                    </span>
                  </span>
                  {item.riskLevel && <RiskBadge level={item.riskLevel} />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
