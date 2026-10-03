import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  CloudOff,
  Download,
  FileDown,
  FolderOpen,
  GraduationCap,
  Layers,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sun,
  Trash2,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  CloudBackupSnapshot,
  LessonPlan,
  LessonSection,
  PedagogicalModelId,
  STANDARD_SUBJECTS,
} from './types/lesson';
import {
  createCloudBackupSnapshot,
  flushOfflineCloudQueue,
  loadCloudSnapshots,
} from './utils/cloudSync';
import { exportLessonPlanToPDF } from './utils/pdfExport';
import {
  adjustSectionMinutesPreservingTotal,
  buildSectionsFromModel,
  formatMinuteWindow,
  INITIAL_DEFAULT_PLAN,
  PEDAGOGICAL_MODELS,
  rebalanceSectionsToTotal,
  SAMPLE_PRESET_PLANS,
} from './utils/timeAllocation';

const ACTIVE_PLAN_STORAGE_KEY = 'lessonflow_active_plan_v1';
const SAVED_LIBRARY_STORAGE_KEY = 'lessonflow_saved_library_v1';
const THEME_STORAGE_KEY = 'lessonflow_theme_preference_v1';

type ActiveTab = 'workspace' | 'ledger' | 'library' | 'cloud';

function loadValidPlanFromStorage(): LessonPlan {
  try {
    const raw =
      localStorage.getItem(ACTIVE_PLAN_STORAGE_KEY) ||
      localStorage.getItem('cadence_active_lesson_plan_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as LessonPlan;
      if (
        parsed &&
        typeof parsed.totalMinutes === 'number' &&
        parsed.totalMinutes > 0 &&
        Array.isArray(parsed.sections) &&
        parsed.sections.length > 0
      ) {
        const sum = parsed.sections.reduce((acc, s) => acc + Number(s.minutes || 0), 0);
        if (sum !== parsed.totalMinutes) {
          parsed.sections = rebalanceSectionsToTotal(parsed.sections, parsed.totalMinutes);
        }
        return parsed;
      }
    }
  } catch {
    // Fallback to initial plan
  }

  try {
    localStorage.setItem(ACTIVE_PLAN_STORAGE_KEY, JSON.stringify(INITIAL_DEFAULT_PLAN));
  } catch {
    // Ignore storage quota
  }
  return INITIAL_DEFAULT_PLAN;
}

function loadLibraryFromStorage(): LessonPlan[] {
  try {
    const raw =
      localStorage.getItem(SAVED_LIBRARY_STORAGE_KEY) ||
      localStorage.getItem('cadence_saved_library_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore error
  }
  try {
    localStorage.setItem(SAVED_LIBRARY_STORAGE_KEY, JSON.stringify(SAMPLE_PRESET_PLANS));
  } catch {
    // Ignore storage quota
  }
  return SAMPLE_PRESET_PLANS;
}

export default function App() {
  // Theme state (Light / Dark) with persistence
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // Default light
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  // Active valid plan loaded from localStorage on mount/reload
  const [activePlan, setActivePlan] = useState<LessonPlan>(() => loadValidPlanFromStorage());
  const [savedLibrary, setSavedLibrary] = useState<LessonPlan[]>(() => loadLibraryFromStorage());

  // Raw string for total minutes input so empty, 0, or negative values trigger instantaneous validation
  const [minutesInput, setMinutesInput] = useState<string>(() =>
    String(loadValidPlanFromStorage().totalMinutes)
  );

  // Custom subject flag when subject is not in STANDARD_SUBJECTS or user chooses custom
  const [isCustomSubjectSelected, setIsCustomSubjectSelected] = useState<boolean>(() => {
    const initialSub = loadValidPlanFromStorage().subject;
    return !STANDARD_SUBJECTS.includes(initialSub as any);
  });

  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('workspace');
  const [expandedMobileSections, setExpandedMobileSections] = useState<Record<string, boolean>>({});
  const [statusToast, setStatusToast] = useState<string | null>(null);

  // Offline / PWA & Cloud Sync state
  const browserOnline = useOnlineStatus();
  const [simulateOffline, setSimulateOffline] = useState(false);
  const isEffectiveOnline = browserOnline && !simulateOffline;

  const [cloudSnapshots, setCloudSnapshots] = useState<CloudBackupSnapshot[]>(() =>
    loadCloudSnapshots()
  );
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [autoCloudSync, setAutoCloudSync] = useState(true);
  const [lastLocalSaveTime, setLastLocalSaveTime] = useState<string>(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Validation: empty, zero, or negative minutes
  const durationValidation = useMemo(() => {
    const trimmed = minutesInput.trim();
    if (trimmed === '') {
      return {
        isValid: false,
        reason: 'empty' as const,
        parsedMinutes: 0,
        message:
          'No plan shown: The minutes are empty. If the minute are empty, zero or negative, no plan is displayed. Please enter a positive number of minutes (at least 1 minute) to view the sectioned lesson plan.',
      };
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num) || Number.isNaN(num)) {
      return {
        isValid: false,
        reason: 'invalid' as const,
        parsedMinutes: 0,
        message:
          'No plan shown: The minutes must be a valid positive number greater than 0. If the minute are empty, zero or negative, no plan is displayed.',
      };
    }
    if (num === 0) {
      return {
        isValid: false,
        reason: 'zero' as const,
        parsedMinutes: 0,
        message:
          'No plan shown: The minutes are zero (0). If the minute are empty, zero or negative, no plan is displayed. Please enter a positive number of minutes (greater than 0) to view the sectioned lesson plan.',
      };
    }
    if (num < 0) {
      return {
        isValid: false,
        reason: 'negative' as const,
        parsedMinutes: num,
        message: `No plan shown: The minutes are negative (${num} min). If the minute are empty, zero or negative, no plan is displayed. Please enter a positive number of minutes (greater than 0) to view the sectioned lesson plan.`,
      };
    }
    const cleanInt = Math.floor(num);
    if (cleanInt <= 0) {
      return {
        isValid: false,
        reason: 'zero' as const,
        parsedMinutes: 0,
        message:
          'No plan shown: If the minute are empty, zero or negative, no plan is displayed. Total minutes must be at least 1 full minute.',
      };
    }
    return {
      isValid: true,
      reason: 'valid' as const,
      parsedMinutes: Math.min(cleanInt, 600),
      message: '',
    };
  }, [minutesInput]);

  // Synchronize on mount to ensure plan is always shown after page reload from local storage
  useEffect(() => {
    const saved = loadValidPlanFromStorage();
    if (saved && saved.totalMinutes > 0) {
      setActivePlan(saved);
      setMinutesInput(String(saved.totalMinutes));
    }
  }, []);

  // Persist valid active plan (including subject and minutes) automatically to local storage
  useEffect(() => {
    if (activePlan && activePlan.totalMinutes > 0 && activePlan.sections.length > 0) {
      try {
        localStorage.setItem(ACTIVE_PLAN_STORAGE_KEY, JSON.stringify(activePlan));
        setLastLocalSaveTime(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } catch {
        // Ignore quota
      }
    }
  }, [activePlan]);

  // Persist library
  useEffect(() => {
    try {
      localStorage.setItem(SAVED_LIBRARY_STORAGE_KEY, JSON.stringify(savedLibrary));
    } catch {
      // Ignore quota
    }
  }, [savedLibrary]);

  // Ensure initial cloud snapshot exists
  useEffect(() => {
    if (cloudSnapshots.length === 0 && activePlan.totalMinutes > 0) {
      createCloudBackupSnapshot(activePlan, isEffectiveOnline).then((snap) => {
        setCloudSnapshots([snap]);
      });
    }
  }, []);

  // Flush queued offline backups when connectivity returns
  useEffect(() => {
    if (isEffectiveOnline) {
      const hasQueued = cloudSnapshots.some((s) => s.status === 'queued-offline');
      if (hasQueued) {
        const flushed = flushOfflineCloudQueue(cloudSnapshots);
        setCloudSnapshots(flushed);
        showTemporaryStatus('Offline cloud backup queue synchronized.');
      }
    }
  }, [isEffectiveOnline]);

  const showTemporaryStatus = (msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // Subject dropdown change handler: persists subject to local storage with plan
  const handleSubjectDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__custom__') {
      setIsCustomSubjectSelected(true);
      // Keep current subject or placeholder
      if (STANDARD_SUBJECTS.includes(activePlan.subject as any)) {
        setActivePlan((prev) => ({
          ...prev,
          subject: 'Custom Subject',
          updatedAt: new Date().toISOString(),
        }));
      }
      showTemporaryStatus('Selected custom subject. You can enter a custom name below.');
    } else {
      setIsCustomSubjectSelected(false);
      setActivePlan((prev) => ({
        ...prev,
        subject: selected,
        updatedAt: new Date().toISOString(),
      }));
      showTemporaryStatus(`Subject updated to "${selected}" and saved to local storage.`);
    }
  };

  const handleCustomSubjectInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const customValue = e.target.value;
    setActivePlan((prev) => ({
      ...prev,
      subject: customValue,
      updatedAt: new Date().toISOString(),
    }));
  };

  // Minutes input change handler
  const handleMinutesInputChange = (rawValue: string) => {
    setMinutesInput(rawValue);
    const trimmed = rawValue.trim();
    if (trimmed === '') return;
    const num = Number(trimmed);
    if (Number.isFinite(num) && Math.floor(num) > 0) {
      const validMinutes = Math.min(Math.floor(num), 600);
      setActivePlan((prev) => ({
        ...prev,
        totalMinutes: validMinutes,
        sections: rebalanceSectionsToTotal(prev.sections, validMinutes),
        updatedAt: new Date().toISOString(),
      }));
    }
  };

  // Main Show/Generate Plan button
  const handleGeneratePlanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!durationValidation.isValid) {
      showTemporaryStatus('Cannot generate plan: duration must be greater than 0 minutes.');
      return;
    }

    const validMinutes = durationValidation.parsedMinutes;
    const generatedSections = buildSectionsFromModel(
      activePlan.modelId,
      activePlan.title,
      validMinutes
    );

    const updatedPlan: LessonPlan = {
      ...activePlan,
      totalMinutes: validMinutes,
      sections: generatedSections,
      updatedAt: new Date().toISOString(),
    };

    setActivePlan(updatedPlan);
    setMinutesInput(String(validMinutes));
    setActiveTab('workspace');

    // Update library entry or add it
    setSavedLibrary((prev) => {
      const exists = prev.some((p) => p.id === updatedPlan.id);
      if (exists) {
        return prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p));
      }
      return [updatedPlan, ...prev];
    });

    if (autoCloudSync) {
      const snap = await createCloudBackupSnapshot(updatedPlan, isEffectiveOnline);
      setCloudSnapshots(loadCloudSnapshots());
      showTemporaryStatus(
        `Sectioned plan generated (${validMinutes} min exact, ${updatedPlan.subject}) & ${
          snap.status === 'synced' ? 'backed up to cloud' : 'queued for offline sync'
        }.`
      );
    } else {
      showTemporaryStatus(`Sectioned plan generated with exact ${validMinutes}-minute allocation.`);
    }
  };

  // Restore saved plan
  const handleRestoreValidPlan = () => {
    const saved = loadValidPlanFromStorage();
    setActivePlan(saved);
    setMinutesInput(String(saved.totalMinutes));
    setIsCustomSubjectSelected(!STANDARD_SUBJECTS.includes(saved.subject as any));
    showTemporaryStatus(`Restored saved lesson plan (${saved.totalMinutes} min, ${saved.subject}).`);
  };

  // Switch pedagogical model
  const handleSelectModel = (modelId: PedagogicalModelId) => {
    const targetMinutes = durationValidation.isValid
      ? durationValidation.parsedMinutes
      : activePlan.totalMinutes;
    const newSections = buildSectionsFromModel(modelId, activePlan.title, targetMinutes);
    setActivePlan((prev) => ({
      ...prev,
      modelId,
      totalMinutes: targetMinutes,
      sections: newSections,
      updatedAt: new Date().toISOString(),
    }));
  };

  // Adjust single section minutes maintaining exact total
  const handleAdjustSectionMinutes = (sectionId: string, desiredMinutes: number) => {
    setActivePlan((prev) => ({
      ...prev,
      sections: adjustSectionMinutesPreservingTotal(
        prev.sections,
        sectionId,
        desiredMinutes,
        prev.totalMinutes
      ),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Update section text field
  const handleUpdateSectionField = (
    sectionId: string,
    field: keyof Pick<
      LessonSection,
      'phaseName' | 'learningObjective' | 'instructionalActivities' | 'formativeCheck'
    >,
    value: string
  ) => {
    setActivePlan((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, [field]: value } : s)),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Add section
  const handleAddSection = () => {
    setActivePlan((prev) => {
      const nextIndex = prev.sections.length + 1;
      const newSec: LessonSection = {
        id: `sec-custom-${Date.now().toString(36)}`,
        index: nextIndex,
        phaseName: `Section ${nextIndex}: Synthesis & Extension`,
        minutes: Math.max(1, Math.round(prev.totalMinutes / nextIndex)),
        weight: 1 / nextIndex,
        learningObjective: `Students will synthesize key concepts from ${prev.title || 'the lesson'} in ${prev.subject} and demonstrate independent mastery.`,
        instructionalActivities: `Guided extension activity and collaborative discussion on ${prev.title || 'the lesson topic'}.`,
        formativeCheck: 'Student reflection log and instructor spot-check.',
      };
      const combined = [...prev.sections, newSec];
      return {
        ...prev,
        sections: rebalanceSectionsToTotal(combined, prev.totalMinutes),
        updatedAt: new Date().toISOString(),
      };
    });
    showTemporaryStatus('Added section and rebalanced minutes to match exact total.');
  };

  // Remove section
  const handleRemoveSection = (sectionId: string) => {
    if (activePlan.sections.length <= 2) {
      showTemporaryStatus('A structured lesson plan requires at least 2 sections.');
      return;
    }
    setActivePlan((prev) => {
      const filtered = prev.sections.filter((s) => s.id !== sectionId);
      return {
        ...prev,
        sections: rebalanceSectionsToTotal(filtered, prev.totalMinutes),
        updatedAt: new Date().toISOString(),
      };
    });
    showTemporaryStatus('Removed section and rebalanced remaining minutes to exact total.');
  };

  // PDF export
  const handleExportPDF = () => {
    if (!durationValidation.isValid) {
      showTemporaryStatus('Please enter a positive minute duration before exporting to PDF.');
      return;
    }
    const filename = exportLessonPlanToPDF(activePlan);
    showTemporaryStatus(`Exported "${filename}" directly to PDF.`);
  };

  // Manual cloud sync
  const handleManualCloudSync = async () => {
    if (!durationValidation.isValid) {
      showTemporaryStatus('Enter a valid positive duration before backing up to cloud.');
      return;
    }
    setIsSyncingCloud(true);
    try {
      const snap = await createCloudBackupSnapshot(activePlan, isEffectiveOnline);
      setCloudSnapshots(loadCloudSnapshots());
      showTemporaryStatus(
        snap.status === 'synced'
          ? `Cloud backup verified (SHA-256: ${snap.checksum.slice(0, 8)}).`
          : 'Saved to local encrypted queue (will sync when online).'
      );
    } finally {
      window.setTimeout(() => setIsSyncingCloud(false), 250);
    }
  };

  // Export JSON backup
  const handleDownloadBackupFile = () => {
    const dataStr = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        activePlan,
        savedLibrary,
        cloudSnapshots,
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lessonflow-cloud-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showTemporaryStatus('Downloaded encrypted-ready JSON backup archive.');
  };

  // Import JSON backup
  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const importedPlan: LessonPlan | undefined = parsed.activePlan || parsed;
        if (
          importedPlan &&
          typeof importedPlan.totalMinutes === 'number' &&
          importedPlan.totalMinutes > 0 &&
          Array.isArray(importedPlan.sections)
        ) {
          const rebalanced = {
            ...importedPlan,
            sections: rebalanceSectionsToTotal(importedPlan.sections, importedPlan.totalMinutes),
          };
          setActivePlan(rebalanced);
          setMinutesInput(String(rebalanced.totalMinutes));
          setIsCustomSubjectSelected(!STANDARD_SUBJECTS.includes(rebalanced.subject as any));
          showTemporaryStatus(`Restored "${rebalanced.title}" (${rebalanced.subject}) from backup.`);
        }
      } catch {
        showTemporaryStatus('Could not parse backup file. Ensure it is a valid LessonFlow JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleMobileSectionDetails = (sectionId: string) => {
    setExpandedMobileSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Exact sum of section minutes
  const allocatedSectionSum = useMemo(
    () => activePlan.sections.reduce((acc, s) => acc + s.minutes, 0),
    [activePlan.sections]
  );

  // Cumulative start/end windows
  const sectionsWithWindows = useMemo(() => {
    let elapsed = 0;
    return activePlan.sections.map((sec) => {
      const startMin = elapsed;
      const endMin = elapsed + sec.minutes;
      const windowStr = formatMinuteWindow(startMin, sec.minutes);
      const percentage =
        activePlan.totalMinutes > 0
          ? Math.round((sec.minutes / activePlan.totalMinutes) * 100)
          : 0;
      elapsed = endMin;
      return {
        ...sec,
        startMin,
        endMin,
        windowStr,
        percentage,
      };
    });
  }, [activePlan.sections, activePlan.totalMinutes]);

  const latestCloudSnapshot = cloudSnapshots[0] || null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-150">
      {/* Skip Navigation Link */}
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-emerald-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
      >
        Skip to lesson plan workspace
      </a>

      {/* Top Bar (Single Row, <= 15% mobile viewport height) */}
      <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md no-print">
        <div className="max-w-[1360px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#main-workspace"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('workspace');
            }}
            className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white font-display whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-sm"
          >
            LessonFlow
          </a>

          {/* Zone 2: Navigation Links */}
          <nav
            aria-label="Primary workspace navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              aria-current={activeTab === 'workspace' ? 'page' : undefined}
              className={`min-h-[44px] px-1 inline-flex items-center border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'workspace'
                  ? 'border-emerald-600 text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Lesson Builder
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              aria-current={activeTab === 'ledger' ? 'page' : undefined}
              className={`min-h-[44px] px-1 inline-flex items-center border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'border-emerald-600 text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Time Ledger
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              aria-current={activeTab === 'library' ? 'page' : undefined}
              className={`min-h-[44px] px-1 inline-flex items-center border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'library'
                  ? 'border-emerald-600 text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Saved Plans
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cloud')}
              aria-current={activeTab === 'cloud' ? 'page' : undefined}
              className={`min-h-[44px] px-1 inline-flex items-center border-b-2 transition-colors whitespace-nowrap ${
                activeTab === 'cloud'
                  ? 'border-emerald-600 text-slate-900 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Cloud Backup
            </button>
          </nav>

          {/* Zone 3: Actions (Theme Toggle, Export PDF, PWA Install) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
              aria-pressed={theme === 'dark'}
              className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
                  <span className="hidden sm:inline">Light</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!durationValidation.isValid}
              aria-label="Export current lesson plan to PDF format"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <FileDown className="w-4 h-4" aria-hidden="true" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Tab Switcher */}
      <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2 no-print">
        <div
          role="tablist"
          aria-label="Mobile view sections"
          className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1"
        >
          {(
            [
              { id: 'workspace', label: 'Plan' },
              { id: 'ledger', label: 'Summary' },
              { id: 'library', label: 'Saved' },
              { id: 'cloud', label: 'Cloud' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[40px] rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      <main
        id="main-workspace"
        className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8"
      >
        {/* Status Bar */}
        <section
          aria-label="Persistence and connectivity status"
          className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              {isEffectiveOnline ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              )}
              <span>
                {isEffectiveOnline
                  ? 'Offline-Ready PWA · Active Connection'
                  : 'Offline Mode Active · Running from Local Cache'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Auto-saved to LocalStorage at {lastLocalSaveTime}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span className="hidden sm:inline">
              Subject: <strong className="text-slate-800 dark:text-slate-200">{activePlan.subject}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSimulateOffline((prev) => !prev)}
              aria-pressed={simulateOffline}
              className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              {simulateOffline ? 'Exit Offline Test' : 'Test Offline Mode'}
            </button>

            <button
              type="button"
              onClick={handleManualCloudSync}
              disabled={isSyncingCloud || !durationValidation.isValid}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>{isSyncingCloud ? 'Syncing...' : 'Sync Cloud Backup'}</span>
            </button>
          </div>
        </section>

        {/* Live Status Toast Announcement */}
        {statusToast && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 rounded-lg border border-emerald-600/30 bg-emerald-50/90 dark:bg-emerald-950/50 px-4 py-3 text-xs sm:text-sm font-medium text-emerald-950 dark:text-emerald-200"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span>{statusToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusToast(null)}
              className="text-xs underline hover:no-underline ml-4 whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: WORKSPACE */}
        {activeTab === 'workspace' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Lesson Parameters & Generator Controls */}
            <section
              aria-labelledby="lesson-parameters-heading"
              className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5"
            >
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <h1
                  id="lesson-parameters-heading"
                  className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight text-balance"
                >
                  Lesson Plan Setup
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Select your subject, configure class minutes, and choose a pedagogical structure.
                </p>
              </div>

              <form onSubmit={handleGeneratePlanSubmit} className="space-y-4" noValidate>
                {/* Total Lesson Duration Input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="total-minutes-input"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Total Class Duration (Minutes)
                    </label>
                    <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      Required (&gt; 0 min)
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <Clock
                      className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="total-minutes-input"
                      name="totalMinutes"
                      type="number"
                      inputMode="numeric"
                      step="1"
                      placeholder="e.g. 50"
                      value={minutesInput}
                      onChange={(e) => handleMinutesInputChange(e.target.value)}
                      aria-invalid={!durationValidation.isValid}
                      aria-describedby="minutes-helper-text"
                      className={`w-full min-h-[44px] pl-10 pr-16 py-2.5 rounded-lg border text-base font-mono tabular-nums font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 ${
                        durationValidation.isValid
                          ? 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus-visible:ring-emerald-600'
                          : 'border-red-600 dark:border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-900 dark:text-red-200 focus-visible:ring-red-600'
                      }`}
                    />
                    <span className="absolute right-3.5 text-xs font-mono text-slate-500 dark:text-slate-400 pointer-events-none">
                      min
                    </span>
                  </div>

                  <p id="minutes-helper-text" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Quick duration presets:
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {[30, 45, 50, 60, 75, 90].map((presetMin) => (
                      <button
                        key={presetMin}
                        type="button"
                        onClick={() => handleMinutesInputChange(String(presetMin))}
                        className={`min-h-[40px] px-2.5 py-1 rounded-md text-xs font-mono tabular-nums font-medium border transition-colors whitespace-nowrap ${
                          durationValidation.isValid && durationValidation.parsedMinutes === presetMin
                            ? 'border-emerald-600 bg-emerald-600 text-white font-semibold'
                            : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                        }`}
                      >
                        {presetMin}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Area Dropdown Menu (Persisted to Local Storage) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="lesson-subject-select"
                      className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      Subject Area (Select from Menu)
                    </label>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      Auto-saved
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      id="lesson-subject-select"
                      name="subject"
                      value={isCustomSubjectSelected ? '__custom__' : activePlan.subject}
                      onChange={handleSubjectDropdownChange}
                      aria-label="Select subject area for lesson plan"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      <optgroup label="Core Academic Disciplines">
                        {STANDARD_SUBJECTS.slice(0, 12).map((subj) => (
                          <option key={subj} value={subj}>
                            {subj}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Electives, Arts & Applied Skills">
                        {STANDARD_SUBJECTS.slice(12, 18).map((subj) => (
                          <option key={subj} value={subj}>
                            {subj}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Other">
                        <option value="__custom__">Custom / Other Subject...</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Secondary input if custom subject is selected */}
                  {isCustomSubjectSelected && (
                    <div className="mt-2.5">
                      <label
                        htmlFor="custom-subject-input"
                        className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                      >
                        Specify Custom Subject Name
                      </label>
                      <input
                        id="custom-subject-input"
                        type="text"
                        value={activePlan.subject}
                        onChange={handleCustomSubjectInputChange}
                        placeholder="e.g. Robotics & Automation, French III, Latin Literature"
                        className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      />
                    </div>
                  )}
                </div>

                {/* Lesson Topic / Title */}
                <div>
                  <label
                    htmlFor="lesson-title-input"
                    className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                  >
                    Lesson Topic or Title
                  </label>
                  <input
                    id="lesson-title-input"
                    type="text"
                    value={activePlan.title}
                    onChange={(e) =>
                      setActivePlan((prev) => ({
                        ...prev,
                        title: e.target.value,
                        updatedAt: new Date().toISOString(),
                      }))
                    }
                    placeholder="e.g. Cellular Respiration & ATP Energy Transfer"
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                {/* Grade Level */}
                <div>
                  <label
                    htmlFor="lesson-grade-input"
                    className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                  >
                    Grade Level / Target Audience
                  </label>
                  <input
                    id="lesson-grade-input"
                    type="text"
                    value={activePlan.gradeLevel}
                    onChange={(e) =>
                      setActivePlan((prev) => ({
                        ...prev,
                        gradeLevel: e.target.value,
                        updatedAt: new Date().toISOString(),
                      }))
                    }
                    placeholder="e.g. Grade 10 · Honors"
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                {/* Pedagogical Structure Selector */}
                <div>
                  <label
                    htmlFor="pedagogical-model-select"
                    className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                  >
                    Instructional Pacing Model
                  </label>
                  <select
                    id="pedagogical-model-select"
                    value={activePlan.modelId}
                    onChange={(e) => handleSelectModel(e.target.value as PedagogicalModelId)}
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    {Object.values(PEDAGOGICAL_MODELS).map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} ({model.phases.length} Sections)
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {PEDAGOGICAL_MODELS[activePlan.modelId]?.description}
                  </p>
                </div>

                {/* Essential Question */}
                <div>
                  <label
                    htmlFor="essential-question-input"
                    className="block text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5"
                  >
                    Essential Guiding Question
                  </label>
                  <textarea
                    id="essential-question-input"
                    rows={2}
                    value={activePlan.essentialQuestion}
                    onChange={(e) =>
                      setActivePlan((prev) => ({
                        ...prev,
                        essentialQuestion: e.target.value,
                        updatedAt: new Date().toISOString(),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                {/* Primary Button to show/generate plan split into sections */}
                <button
                  id="generate-plan-btn"
                  data-testid="show-plan-btn"
                  type="submit"
                  aria-label="Show plan split into sections"
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <Layers className="w-4 h-4" aria-hidden="true" />
                  <span>Show Sectioned Lesson Plan</span>
                </button>
              </form>
            </section>

            {/* Right Column: Sectioned Lesson Plan Display OR Validation Message */}
            <section
              aria-labelledby="sectioned-plan-heading"
              className="lg:col-span-8 space-y-6"
            >
              {!durationValidation.isValid ? (
                /* INVALID MINUTES: Show message and NO plan */
                <div
                  role="alert"
                  aria-live="assertive"
                  data-testid="invalid-minutes-message"
                  id="no-plan-alert"
                  className="rounded-xl border-2 border-red-600 dark:border-red-500 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-5"
                >
                  <div className="flex items-start gap-3.5">
                    <AlertTriangle
                      className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-2">
                      <h2
                        id="sectioned-plan-heading"
                        data-testid="no-plan-heading"
                        className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white"
                      >
                        No plan shown: The minutes are empty, zero or negative
                      </h2>
                      <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {durationValidation.message}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        If the minute are empty, zero or negative, no plan is shown. Your previous plan (
                        <strong className="font-semibold text-slate-900 dark:text-white">
                          {activePlan.title} · {activePlan.subject} · {activePlan.totalMinutes} min
                        </strong>
                        ) remains safely saved in local storage and will still show after the page is reloaded.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handleRestoreValidPlan}
                      className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" aria-hidden="true" />
                      <span>Restore Saved Plan ({activePlan.totalMinutes} min)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMinutesInputChange('45')}
                      className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span>Set to 45 Minutes</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* VALID MINUTES: Show Full Sectioned Lesson Plan */
                <div
                  data-testid="lesson-plan-container"
                  id="sectioned-lesson-plan"
                  role="region"
                  aria-label="Sectioned lesson plan"
                  className="space-y-6"
                >
                  {/* Summary & Exact Minute Verification Header */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                      <div className="space-y-1">
                        {/* Unboxed Metadata Line with Persisted Subject */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {activePlan.subject}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{activePlan.gradeLevel || 'All Grades'}</span>
                          <span aria-hidden="true">·</span>
                          <span>{PEDAGOGICAL_MODELS[activePlan.modelId]?.shortLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{activePlan.date}</span>
                        </div>

                        <h2
                          id="sectioned-plan-heading"
                          className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight text-balance"
                        >
                          {activePlan.title || 'Untitled Classroom Lesson Plan'}
                        </h2>
                      </div>

                      {/* Exact Total Readout */}
                      <div className="flex items-center gap-3 self-start rounded-lg border border-emerald-600/30 bg-emerald-50/70 dark:bg-emerald-950/40 px-3.5 py-2">
                        <div>
                          <div className="text-[11px] font-medium text-emerald-900 dark:text-emerald-300">
                            Exact Time Allocation
                          </div>
                          <div className="text-base sm:text-lg font-mono tabular-nums font-bold text-emerald-800 dark:text-emerald-200">
                            {allocatedSectionSum} / {activePlan.totalMinutes} min
                          </div>
                        </div>
                        <CheckCircle2
                          className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {/* Proportional Segment Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-medium">
                          Section Pacing Distribution ({sectionsWithWindows.length} Segments)
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-200">
                          { sectionsWithWindows.map((s) => `${s.minutes}m`).join(' + ') } = {allocatedSectionSum}m
                        </span>
                      </div>

                      <div
                        className="h-3 w-full rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex gap-0.5 p-0.5"
                        role="img"
                        aria-label={`Time distribution across ${sectionsWithWindows.length} sections summing to ${allocatedSectionSum} minutes`}
                      >
                        {sectionsWithWindows.map((sec, idx) => {
                          const barColors = [
                            'bg-emerald-600 dark:bg-emerald-500',
                            'bg-slate-700 dark:bg-slate-400',
                            'bg-teal-600 dark:bg-teal-400',
                            'bg-slate-500 dark:bg-slate-500',
                            'bg-emerald-800 dark:bg-emerald-300',
                          ];
                          return (
                            <div
                              key={sec.id}
                              style={{ width: `${Math.max(4, (sec.minutes / activePlan.totalMinutes) * 100)}%` }}
                              className={`h-full first:rounded-l-sm last:rounded-r-sm transition-opacity ${
                                barColors[idx % barColors.length]
                              }`}
                              title={`${sec.phaseName}: ${sec.minutes} min (${sec.percentage}%)`}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAddSection}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Add Section</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleGeneratePlanSubmit()}
                          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                        >
                          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Reset Model Weights</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleExportPDF}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white/90 px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap"
                      >
                        <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Download Lesson PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Section-by-Section Cards */}
                  <div className="space-y-4" role="list" aria-label="Lesson plan sections">
                    {sectionsWithWindows.map((sec, idx) => {
                      const isExpandedMobile = !!expandedMobileSections[sec.id];
                      return (
                        <article
                          key={sec.id}
                          role="listitem"
                          data-testid={`lesson-section-${idx + 1}`}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 transition-colors"
                        >
                          {/* Section Header: Title & Exact Minute Steppers */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                <span>Section 0{idx + 1}</span>
                                <span aria-hidden="true">·</span>
                                <span>Window {sec.windowStr}</span>
                                <span aria-hidden="true">·</span>
                                <span>{sec.percentage}% of class</span>
                              </div>

                              <input
                                type="text"
                                aria-label={`Section ${idx + 1} title`}
                                value={sec.phaseName}
                                onChange={(e) =>
                                  handleUpdateSectionField(sec.id, 'phaseName', e.target.value)
                                }
                                className="w-full text-base sm:text-lg font-semibold text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-600 focus:outline-none py-0.5"
                              />
                            </div>

                            {/* Section Minute Display with Controls */}
                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-1 sm:pt-0">
                              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1">
                                <button
                                  type="button"
                                  onClick={() => handleAdjustSectionMinutes(sec.id, sec.minutes - 1)}
                                  disabled={sec.minutes <= 1}
                                  aria-label={`Decrease minutes for section ${idx + 1}`}
                                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-sm font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                                >
                                  −
                                </button>

                                <div
                                  className="px-3 text-center"
                                  aria-label={`Section ${idx + 1} allocated time: ${sec.minutes} minutes`}
                                >
                                  <span
                                    data-testid={`section-minutes-${idx + 1}`}
                                    className="text-base font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400"
                                  >
                                    {sec.minutes}
                                  </span>
                                  <span className="ml-1 text-xs font-mono text-slate-600 dark:text-slate-400">
                                    min
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAdjustSectionMinutes(sec.id, sec.minutes + 1)}
                                  disabled={sec.minutes >= activePlan.totalMinutes - (activePlan.sections.length - 1)}
                                  aria-label={`Increase minutes for section ${idx + 1}`}
                                  className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-md text-sm font-mono font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors"
                                >
                                  +
                                </button>
                              </div>

                              {activePlan.sections.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSection(sec.id)}
                                  aria-label={`Remove section ${idx + 1}`}
                                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Learning Objective for Segment */}
                          <div className="mt-4 space-y-1.5">
                            <label
                              htmlFor={`objective-${sec.id}`}
                              className="block text-xs font-semibold text-emerald-800 dark:text-emerald-400"
                            >
                              Segment Learning Objective
                            </label>
                            <textarea
                              id={`objective-${sec.id}`}
                              rows={2}
                              value={sec.learningObjective}
                              onChange={(e) =>
                                handleUpdateSectionField(sec.id, 'learningObjective', e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            />
                          </div>

                          {/* Mobile Clutter-Free Disclosure Toggle */}
                          <div className="mt-3 sm:hidden">
                            <button
                              type="button"
                              onClick={() => toggleMobileSectionDetails(sec.id)}
                              aria-expanded={isExpandedMobile}
                              className="min-h-[40px] w-full inline-flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-800/70 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300"
                            >
                              <span>
                                {isExpandedMobile
                                  ? 'Hide Activities & Formative Check'
                                  : 'Show Activities & Formative Check'}
                              </span>
                              {isExpandedMobile ? (
                                <ChevronUp className="w-4 h-4" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>

                          {/* Activities & Formative Check */}
                          <div
                            className={`mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 ${
                              isExpandedMobile ? 'block' : 'hidden sm:grid'
                            }`}
                          >
                            <div>
                              <label
                                htmlFor={`activity-${sec.id}`}
                                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                              >
                                Classroom Activities & Pacing Notes
                              </label>
                              <textarea
                                id={`activity-${sec.id}`}
                                rows={2}
                                value={sec.instructionalActivities}
                                onChange={(e) =>
                                  handleUpdateSectionField(
                                    sec.id,
                                    'instructionalActivities',
                                    e.target.value
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              />
                            </div>

                            <div>
                              <label
                                htmlFor={`check-${sec.id}`}
                                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                              >
                                Formative Check / Evidence of Mastery
                              </label>
                              <textarea
                                id={`check-${sec.id}`}
                                rows={2}
                                value={sec.formativeCheck}
                                onChange={(e) =>
                                  handleUpdateSectionField(sec.id, 'formativeCheck', e.target.value)
                                }
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Bottom Precision Summary Footer */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:px-6 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Classroom Time Summary:
                      </span>{' '}
                      {sectionsWithWindows.length} sections for{' '}
                      <strong className="text-slate-900 dark:text-white">{activePlan.subject}</strong> totaling{' '}
                      <strong className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {allocatedSectionSum} minutes
                      </strong>{' '}
                      out of{' '}
                      <strong className="font-mono tabular-nums">
                        {activePlan.totalMinutes} minutes
                      </strong>{' '}
                      scheduled (100% exact match).
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleManualCloudSync}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        <span>Back Up Now</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportPDF}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors"
                      >
                        <FileDown className="w-4 h-4" aria-hidden="true" />
                        <span>Export PDF</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: PRECISION TIME LEDGER */}
        {activeTab === 'ledger' && (
          <section
            aria-labelledby="time-ledger-heading"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h1
                  id="time-ledger-heading"
                  className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white"
                >
                  Precision Time Allocation Ledger
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Subject: <strong className="text-slate-900 dark:text-white">{activePlan.subject}</strong> · Lesson:{' '}
                  <strong className="text-slate-900 dark:text-white">{activePlan.title}</strong>.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportPDF}
                disabled={!durationValidation.isValid}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white transition-colors"
              >
                <FileDown className="w-4 h-4" aria-hidden="true" />
                <span>Export Ledger PDF</span>
              </button>
            </div>

            {!durationValidation.isValid ? (
              <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-50/50 dark:bg-red-950/30 p-5 text-sm text-red-900 dark:text-red-200"
              >
                {durationValidation.message}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-3">Seg</th>
                      <th className="py-3 px-3">Lesson Section</th>
                      <th className="py-3 px-3">Learning Objective</th>
                      <th className="py-3 px-3 text-right">Clock Window</th>
                      <th className="py-3 px-3 text-right">Share</th>
                      <th className="py-3 px-3 text-right">Minutes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {sectionsWithWindows.map((sec, idx) => (
                      <tr
                        key={sec.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3.5 px-3 font-mono tabular-nums text-xs text-slate-500">
                          0{idx + 1}
                        </td>
                        <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-white">
                          {sec.phaseName}
                        </td>
                        <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300 max-w-md">
                          {sec.learningObjective}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {sec.windowStr}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400">
                          {sec.percentage}%
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {sec.minutes} min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 font-semibold">
                      <td colSpan={4} className="py-3.5 px-3 text-xs sm:text-sm text-slate-900 dark:text-white">
                        Total Classroom Schedule Allocation (100% Exact Match)
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300">
                        100%
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono tabular-nums text-sm font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {allocatedSectionSum} / {activePlan.totalMinutes} min
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: SAVED LESSON PLANS LIBRARY */}
        {activeTab === 'library' && (
          <section
            aria-labelledby="saved-library-heading"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h1
                  id="saved-library-heading"
                  className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white"
                >
                  Offline-Cached Lesson Plan Library
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Saved plans by subject stored locally for instant classroom access without internet.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {savedLibrary.map((planItem) => {
                const isCurrent = planItem.id === activePlan.id;
                const sumMin = planItem.sections.reduce((acc, s) => acc + s.minutes, 0);
                return (
                  <article
                    key={planItem.id}
                    className={`rounded-xl border p-5 flex flex-col justify-between space-y-4 transition-colors ${
                      isCurrent
                        ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-400">
                          {planItem.subject}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{planItem.gradeLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums font-semibold">
                          {sumMin} min
                        </span>
                      </div>

                      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        {planItem.title}
                      </h2>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {planItem.essentialQuestion}
                      </p>

                      <div className="pt-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {planItem.sections.length} sections ({planItem.sections.map((s) => `${s.minutes}m`).join(' + ')})
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setActivePlan(planItem);
                          setMinutesInput(String(planItem.totalMinutes));
                          setIsCustomSubjectSelected(!STANDARD_SUBJECTS.includes(planItem.subject as any));
                          setActiveTab('workspace');
                          showTemporaryStatus(`Loaded "${planItem.title}" (${planItem.subject}, ${planItem.totalMinutes} min).`);
                        }}
                        className="min-h-[40px] flex-1 rounded-lg bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-white transition-colors"
                      >
                        {isCurrent ? 'Active in Workspace' : 'Load Plan'}
                      </button>

                      <button
                        type="button"
                        onClick={() => exportLessonPlanToPDF(planItem)}
                        aria-label={`Export ${planItem.title} to PDF`}
                        className="min-h-[40px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        PDF
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 4: SECURE CLOUD SYNC & BACKUP VAULT */}
        {activeTab === 'cloud' && (
          <section
            aria-labelledby="cloud-sync-heading"
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <h1
                  id="cloud-sync-heading"
                  className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white"
                >
                  Secure Cloud Sync & Encrypted Backup Vault
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  Back up your classroom schedules and selected subjects with SHA-256 integrity verification.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleManualCloudSync}
                  disabled={isSyncingCloud || !durationValidation.isValid}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-colors"
                >
                  <Cloud className="w-4 h-4" aria-hidden="true" />
                  <span>{isSyncingCloud ? 'Syncing Snapshot...' : 'Create Cloud Backup Now'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadBackupFile}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  <span>Export Backup (.json)</span>
                </button>

                <label className="min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>Restore File</span>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={handleImportBackupFile}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Cloud Sync Configuration */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span>Automatic Cloud Backup on Plan Generation</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  When offline, snapshots queue locally and synchronize automatically as soon as connectivity returns.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={autoCloudSync}
                onClick={() => setAutoCloudSync((prev) => !prev)}
                className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  autoCloudSync
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {autoCloudSync ? 'Auto-Sync Enabled' : 'Auto-Sync Paused'}
              </button>
            </div>

            {/* Snapshot History Table */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Verified Cloud Backup Restore Points ({cloudSnapshots.length})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-3">Timestamp</th>
                      <th className="py-3 px-3">Lesson Plan</th>
                      <th className="py-3 px-3">Subject</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-3">SHA-256 Checksum</th>
                      <th className="py-3 px-3">Sync Status</th>
                      <th className="py-3 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
                    {cloudSnapshots.map((snap) => (
                      <tr key={snap.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-500 whitespace-nowrap">
                          {new Date(snap.syncedAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">
                          {snap.planTitle}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">
                          {snap.payload.subject || 'General'}
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-600 dark:text-slate-300">
                          {snap.totalMinutes} min ({snap.sectionCount} sections)
                        </td>
                        <td className="py-3 px-3 font-mono tabular-nums text-xs text-slate-500">
                          {snap.checksum}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {snap.status === 'synced' ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Synced · {snap.encryptionMode}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium">
                              <CloudOff className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Queued Offline</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePlan(snap.payload);
                              setMinutesInput(String(snap.payload.totalMinutes));
                              setIsCustomSubjectSelected(!STANDARD_SUBJECTS.includes(snap.payload.subject as any));
                              setActiveTab('workspace');
                              showTemporaryStatus(
                                `Restored "${snap.planTitle}" (${snap.payload.subject}, ${snap.totalMinutes} min) from cloud backup.`
                              );
                            }}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            Restore Plan
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-slate-400 no-print">
        <div className="max-w-[1360px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            LessonFlow · Precision Classroom Lesson Planner with Subject Selection & Cloud Backup
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Workspace
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cloud')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Cloud Sync
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!durationValidation.isValid}
              className="hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
