import React, { useCallback, useEffect, useRef, useState } from 'react';
import { VisualHighlightOverlay } from './sidepanel/components/VisualHighlightOverlay';
import { SidePanelView } from './sidepanel/components/SidePanelView';
import { FloatingInPageAssistant } from './sidepanel/components/FloatingInPageAssistant';
import {
  SandboxSiteId,
  WebpageSandbox,
} from './sidepanel/components/WebpageSandbox';
import { OnboardingModal } from './sidepanel/pages/OnboardingModal';
import { SettingsModal } from './sidepanel/components/SettingsModal';
import { ExtensionArchitectureModal } from './sidepanel/components/ExtensionArchitectureModal';
import { ExtensionPopup } from './popup/components/ExtensionPopup';
import { useBrowserAgent } from './sidepanel/hooks/useBrowserAgent';
import { AI_NAME } from './shared/constants';
import aiService from './ai/ai-service';

export default function App() {
  const webpageContainerRef = useRef<HTMLDivElement | null>(null);

  const [activeSite, setActiveSite] = useState<SandboxSiteId>('maroc-stage');
  const activeSiteRef = useRef<SandboxSiteId>(activeSite);
  activeSiteRef.current = activeSite;

  const [virtualMeta, setVirtualMeta] = useState({
    title: 'MarocStage — Portail National des Stages & Comptes',
    url: 'https://marocstage.ma/accueil',
  });

  const [showOnboarding, setShowOnboarding] = useState<boolean>(() => {
    try {
      return localStorage.getItem('m3ak_onboarded') !== 'true';
    } catch {
      return false;
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [showPopupOverlay, setShowPopupOverlay] = useState(false);
  const [showSidePanelDock, setShowSidePanelDock] = useState(false);

  // Primary In-Page Floating Assistant state (toggled when user clicks the M3ak extension icon)
  const [floatingVisible, setFloatingVisible] = useState(true);
  const [floatingMinimized, setFloatingMinimized] = useState(false);

  // Detect if running inside standalone Chrome Extension Popup or SidePanel URL
  const urlParams = new URLSearchParams(
    typeof window !== 'undefined' ? window.location.search : ''
  );
  const standaloneMode = urlParams.get('view'); // 'popup' | 'sidepanel' | null

  const handleToggleExtensionIcon = useCallback(() => {
    if (!floatingVisible) {
      // Initial state when activating from extension icon: Compact Floating M3ak Orb (◉ M3ak)
      setFloatingVisible(true);
      setFloatingMinimized(true);
    } else if (floatingMinimized) {
      // Clicking again expands the JARVIS panel
      setFloatingMinimized(false);
    } else {
      // Clicking while expanded collapses back to the M3ak Orb
      setFloatingMinimized(true);
    }
  }, [floatingVisible, floatingMinimized]);

  /**
   * Automatically routes the Sandbox site to match the user's intent if needed
   * so all 6 Functional Test Scenarios ("bghit n9leb 3la login", "bghit ndir compte hna",
   * "bghit n3ammar had formulaire", "bghit nbdl password", "bghit nchri had produit",
   * "bghit nsift had document") work seamlessly from any starting tab.
   */
  const ensureScenarioForGoal = useCallback(async (goal: string) => {
    const { intentCategory } = aiService.understandUserIntent(goal);
    let targetSite: SandboxSiteId | null = null;

    if (
      intentCategory === 'login' ||
      intentCategory === 'signup' ||
      intentCategory === 'internship'
    ) {
      targetSite = 'maroc-stage';
    } else if (intentCategory === 'shop' || intentCategory === 'price') {
      targetSite = 'souk-artisan';
    } else if (
      intentCategory === 'form' ||
      intentCategory === 'upload' ||
      intentCategory === 'download'
    ) {
      targetSite = 'watiqa-form';
    } else if (intentCategory === 'password') {
      targetSite = 'security-password';
    }

    if (targetSite && targetSite !== activeSiteRef.current) {
      setActiveSite(targetSite);
      if (targetSite === 'maroc-stage') {
        setVirtualMeta({
          title: 'MarocStage — Portail National des Stages & Comptes',
          url: 'https://marocstage.ma/accueil',
        });
      } else if (targetSite === 'souk-artisan') {
        setVirtualMeta({
          title: 'SoukArtisan Maroc — Sac Cuir & Audio Studio Edition',
          url: 'https://soukartisan.ma/produits/sac-cuir-atlas',
        });
      } else if (targetSite === 'watiqa-form') {
        setVirtualMeta({
          title: 'Portail Watiqa — Formulaire & Envoi de Documents',
          url: 'https://watiqa-service.ma/formulaire-demande',
        });
      } else if (targetSite === 'security-password') {
        setVirtualMeta({
          title: 'MonCompte — Paramètres de Sécurité & Mot de Passe',
          url: 'https://moncompte.ma/securite/password',
        });
      }
      // Allow React DOM to commit the new site before DOMAnalyzer inspects it
      await new Promise((r) => setTimeout(r, 120));
    }
  }, []);

  const {
    settings,
    updateSettings,
    messages,
    taskState,
    avatarState,
    micState,
    wakeStandbyActive,
    liveTranscript,
    micPermissionDenied,
    pageContext,
    isAnalyzing,
    inspectCurrentWebpage,
    handleAnalyzePage,
    handleStartTask,
    handleRetryTask,
    handleConfirmSensitiveAction,
    handleStopTask,
    handleToggleVoice,
    handleToggleWakeStandby,
    handleStopSpeaking,
    handleClearHistory,
    speakMessageManually,
  } = useBrowserAgent({
    webpageContainerRef,
    virtualMeta,
    onEnsureScenarioForGoal: ensureScenarioForGoal,
  });

  // Manual element highlight state when clicking an element in the Page Analysis card
  const [manualHighlight, setManualHighlight] = useState<{
    elementId: string;
    instruction: string;
  } | null>(null);

  // Re-inspect webpage whenever activeSite or virtualMeta changes
  useEffect(() => {
    const timer = setTimeout(() => {
      inspectCurrentWebpage();
    }, 100);
    return () => clearTimeout(timer);
  }, [activeSite, virtualMeta, inspectCurrentWebpage]);

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem('m3ak_onboarded', 'true');
    } catch {
      // ignore
    }
  };

  // If opened directly as Chrome Extension Popup (`index.html?view=popup`)
  if (standaloneMode === 'popup') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-2">
        <ExtensionPopup
          avatarState={avatarState}
          micState={micState}
          onStartTask={(goal) => handleStartTask(goal)}
          onAnalyzePage={() => handleAnalyzePage(false)}
          onToggleVoice={handleToggleVoice}
          onOpenSidePanel={() => {
            const chromeGlobal = (globalThis as Record<string, any>).chrome;
            if (chromeGlobal?.runtime?.sendMessage) {
              chromeGlobal.runtime.sendMessage({
                type: 'TOGGLE_M3AK_ASSISTANT',
              });
            }
          }}
          onOpenSettings={() => setShowSettings(true)}
        />
        <SettingsModal
          isOpen={showSettings}
          settings={settings}
          onUpdateSettings={updateSettings}
          onClearHistory={handleClearHistory}
          onReplayOnboarding={() => setShowOnboarding(true)}
          onClose={() => setShowSettings(false)}
        />
      </div>
    );
  }

  // Determine active highlight target (either from active TaskState or manual element click)
  const activeHighlightId =
    taskState.targetElement || manualHighlight?.elementId || null;
  const activeHighlightInstruction =
    taskState.currentInstruction ||
    manualHighlight?.instruction ||
    'كليكي على هاد العنصر';

  return (
    <div
      id="m3ak-sandbox-viewport"
      className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100"
    >
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-3 shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setShowPopupOverlay(false);
          }}
          className="text-base font-bold tracking-tight text-white whitespace-nowrap"
        >
          {AI_NAME} Browser Assistant
        </a>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-400">
          <button
            type="button"
            onClick={() => {
              setFloatingVisible(true);
              setFloatingMinimized(false);
              handleStartTask('bghit n9leb 3la login');
            }}
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Demo: Login Flow
          </button>
          <button
            type="button"
            onClick={() => {
              setFloatingVisible(true);
              setFloatingMinimized(false);
              handleStartTask('bghit ndir compte hna');
            }}
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Demo: Sign Up
          </button>
          <button
            type="button"
            onClick={() => setShowSidePanelDock((prev) => !prev)}
            className={`hover:text-white transition-colors whitespace-nowrap ${
              showSidePanelDock
                ? 'text-emerald-400 underline underline-offset-4'
                : ''
            }`}
          >
            Side Panel Fallback
          </button>
          <button
            type="button"
            onClick={() => setShowInspector(true)}
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            DOM & Manifest V3
          </button>
          <button
            type="button"
            onClick={() => setShowOnboarding(true)}
            className="hover:text-white transition-colors whitespace-nowrap"
          >
            Onboarding
          </button>
        </nav>

        {/* Zone 3: 1–2 primary actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setFloatingVisible(true);
              setFloatingMinimized(false);
              handleAnalyzePage(false);
            }}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            Analyze Active Page
          </button>
          <button
            type="button"
            onClick={handleToggleExtensionIcon}
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
            title="Simulates clicking the M3ak Chrome Extension Icon (cycles between Compact Orb and Expanded JARVIS Panel)"
          >
            {!floatingVisible
              ? 'Activate M3ak Orb (◉)'
              : floatingMinimized
              ? 'Expand JARVIS Panel'
              : 'Collapse to M3ak Orb (◉)'}
          </button>
        </div>
      </header>

      {/* Main Workspace: Live Webpage Viewport + In-Page Floating M3ak Assistant */}
      <main className="relative flex flex-1 overflow-hidden">
        {/* Optional Popup Preview */}
        {showPopupOverlay && (
          <div className="absolute top-3 right-6 z-50">
            <ExtensionPopup
              avatarState={avatarState}
              micState={micState}
              onStartTask={(goal) => {
                setManualHighlight(null);
                setFloatingVisible(true);
                setFloatingMinimized(false);
                handleStartTask(goal);
              }}
              onAnalyzePage={() => {
                setFloatingVisible(true);
                setFloatingMinimized(false);
                handleAnalyzePage(false);
              }}
              onToggleVoice={handleToggleVoice}
              onOpenSidePanel={() => {
                setShowPopupOverlay(false);
                setFloatingVisible(true);
                setFloatingMinimized(false);
              }}
              onOpenSettings={() => {
                setShowPopupOverlay(false);
                setShowSettings(true);
              }}
            />
          </div>
        )}

        {/* Interactive Webpage Sandbox where Content Script + Visual Highlight Overlay + Floating Assistant run */}
        <WebpageSandbox
          activeSite={activeSite}
          onSelectSite={(site) => {
            setManualHighlight(null);
            handleStopTask();
            setActiveSite(site);
          }}
          containerRef={webpageContainerRef}
          onMetaChange={setVirtualMeta}
          overlayNode={
            <VisualHighlightOverlay
              targetElementId={activeHighlightId}
              instruction={activeHighlightInstruction}
              action={taskState.actionType || 'click'}
              requiresConfirmation={taskState.requiresConfirmation}
              stepNumber={taskState.currentStep || 1}
              containerRef={webpageContainerRef}
            />
          }
        />

        {/* Primary User Experience: In-Page Floating Draggable & Minimizable M3ak Assistant */}
        <FloatingInPageAssistant
          isVisible={floatingVisible}
          isMinimized={floatingMinimized}
          onMinimize={() => setFloatingMinimized(true)}
          onExpand={() => {
            setFloatingVisible(true);
            setFloatingMinimized(false);
          }}
          onHide={() => setFloatingVisible(false)}
          messages={messages}
          taskState={taskState}
          avatarState={avatarState}
          micState={micState}
          wakeStandbyActive={wakeStandbyActive}
          liveTranscript={liveTranscript}
          micPermissionDenied={micPermissionDenied}
          pageContext={pageContext}
          isAnalyzing={isAnalyzing}
          onSendMessage={(txt, opts) => {
            setManualHighlight(null);
            handleStartTask(txt, opts);
          }}
          onAnalyzePage={(withScreenshot) => {
            setManualHighlight(null);
            handleAnalyzePage(withScreenshot);
          }}
          onToggleVoice={handleToggleVoice}
          onToggleWakeStandby={handleToggleWakeStandby}
          onStopSpeaking={handleStopSpeaking}
          onConfirmSensitiveAction={handleConfirmSensitiveAction}
          onRetryTask={handleRetryTask}
          onStopTask={() => {
            setManualHighlight(null);
            handleStopTask();
          }}
          onOpenSettings={() => setShowSettings(true)}
          onSpeakText={speakMessageManually}
          onHighlightElementManual={(elementId, label) => {
            setManualHighlight({
              elementId,
              instruction: label,
            });
          }}
        />

        {/* Optional Fallback Docked Side Panel (when toggled via "Side Panel Fallback") */}
        {showSidePanelDock && (
          <div className="h-full w-full max-w-[420px] shrink-0">
            <SidePanelView
              messages={messages}
              taskState={taskState}
              avatarState={avatarState}
              micState={micState}
              pageContext={pageContext}
              isAnalyzing={isAnalyzing}
              onSendMessage={(txt, opts) => {
                setManualHighlight(null);
                handleStartTask(txt, opts);
              }}
              onAnalyzePage={(withScreenshot) => {
                setManualHighlight(null);
                handleAnalyzePage(withScreenshot);
              }}
              onToggleVoice={handleToggleVoice}
              onConfirmSensitiveAction={handleConfirmSensitiveAction}
              onRetryTask={handleRetryTask}
              onStopTask={() => {
                setManualHighlight(null);
                handleStopTask();
              }}
              onOpenSettings={() => setShowSettings(true)}
              onSpeakText={speakMessageManually}
              onHighlightElementManual={(elementId, label) => {
                setManualHighlight({
                  elementId,
                  instruction: label,
                });
              }}
            />
          </div>
        )}
      </main>

      {/* Modals: First-Time Onboarding, Privacy/Voice Settings, DOM & Manifest V3 Inspector */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleCompleteOnboarding}
      />

      <SettingsModal
        isOpen={showSettings}
        settings={settings}
        onUpdateSettings={updateSettings}
        onClearHistory={handleClearHistory}
        onReplayOnboarding={() => setShowOnboarding(true)}
        onClose={() => setShowSettings(false)}
      />

      <ExtensionArchitectureModal
        isOpen={showInspector}
        onClose={() => setShowInspector(false)}
        pageContext={pageContext}
        taskState={taskState}
      />
    </div>
  );
}
