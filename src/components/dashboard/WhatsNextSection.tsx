/**
 * WhatsNextSection - Vertical list of upcoming categories
 */

import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Banknote, Receipt } from 'lucide-react';

interface NextCategory {
  id: string;
  name: string;
  route: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface WhatsNextSectionProps {
  isUnlocked: boolean;
  nextCategories?: NextCategory[];
}

const defaultNextCategories: NextCategory[] = [
  {
    id: 'C006',
    name: 'Tax Configuration',
    route: '/tax-company',
    icon: Receipt,
    description: 'Set up tax companies and authorities',
  },
  {
    id: 'C009',
    name: 'Banking',
    route: '/payment-methods',
    icon: Banknote,
    description: 'Configure payment methods and house banks',
  },
];

export function WhatsNextSection({
  isUnlocked,
  nextCategories = defaultNextCategories,
}: WhatsNextSectionProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-8 max-w-2xl">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-foreground">What's Next</h2>
        {!isUnlocked && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
            <Lock className="h-3 w-3" />
            Complete above first
          </span>
        )}
      </div>

      <div className="space-y-2">
        {nextCategories.map((category) => {
          const Icon = category.icon ?? Receipt;
          return (
            <button
              key={category.id}
              onClick={() => isUnlocked && navigate(category.route)}
              disabled={!isUnlocked}
              className={`w-full flex items-center gap-4 p-4 rounded-lg text-left transition-all duration-200 ${
                isUnlocked
                  ? 'bg-card border border-border hover:border-primary/50 hover:bg-secondary/50 cursor-pointer group'
                  : 'bg-muted/30 border border-border/50 opacity-50 cursor-not-allowed'
              }`}
            >
              <div
                className={`flex-shrink-0 p-2 rounded-lg ${
                  isUnlocked ? 'bg-secondary' : 'bg-muted'
                }`}
              >
                <Icon
                  className={`h-5 w-5 ${
                    isUnlocked
                      ? 'text-muted-foreground group-hover:text-primary'
                      : 'text-muted-foreground/50'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {category.description}
                  </p>
                )}
              </div>

              {isUnlocked && (
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
