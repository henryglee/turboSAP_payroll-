/**
 * ConfigurationManagementPage - Central hub for managing SAP module configurations
 *
 * This is the shell page that contains the tab navigation.
 * Each tab is in its own file for team collaboration:
 *
 * - ModulesTab.tsx     (Henry)  - Module CRUD, drag-and-drop ordering
 * - QuestionsTab.tsx   (Wendy)  - Question editing across modules
 * - DecisionTreeTab.tsx (TBD)   - Visual routing editor
 *
 * DO NOT add tab-specific code to this file.
 * Add it to the appropriate tab component instead.
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { apiFetch } from '../../api/utils';
import { Boxes, HelpCircle, GitBranch } from 'lucide-react';
import { cn } from '../../lib/utils';

// Import tab components from separate files
import { ModulesTab } from './config/ModulesTab';
import type { ModuleInfo } from './config/ModulesTab';
import { QuestionsTab } from './config/QuestionsTab';
import { DecisionTreeTab } from './config/DecisionTreeTab';

// ============================================
// Tab Configuration
// ============================================

type TabKey = 'modules' | 'questions' | 'decision-tree';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'modules', label: 'Modules', icon: Boxes },
  { key: 'questions', label: 'Questions', icon: HelpCircle },
  { key: 'decision-tree', label: 'Decision Tree', icon: GitBranch },
];

// ============================================
// Main Component
// ============================================

export function ConfigurationManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as TabKey) || 'modules';

  // Modules data (shared with ModulesTab)
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load modules when on modules tab
  useEffect(() => {
    if (activeTab === 'modules') {
      loadModules();
    }
  }, [activeTab]);

  const loadModules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ modules: ModuleInfo[] }>('/api/config/modules');
      setModules(data.modules);
    } catch (err: any) {
      setError(err.message || 'Failed to load modules');
    } finally {
      setLoading(false);
    }
  };

  const setActiveTab = (tab: TabKey) => {
    setSearchParams({ tab });
  };

  return (
    <AdminLayout
      title="Configuration Management"
      description="Manage SAP modules, questions, and decision logic"
    >
      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="inline-flex rounded-full bg-gray-100 p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-full transition-all duration-200',
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content - Each tab is its own component */}
      {activeTab === 'modules' && (
        <ModulesTab
          modules={modules}
          loading={loading}
          error={error}
          onRefresh={loadModules}
        />
      )}

      {activeTab === 'questions' && <QuestionsTab />}

      {activeTab === 'decision-tree' && <DecisionTreeTab />}
    </AdminLayout>
  );
}
