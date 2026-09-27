import React, { useEffect, useState } from 'react';
import {
  Globe,
  Lock,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Search,
  ExternalLink,
  CheckCircle2,
  Briefcase,
  ShoppingBag,
  FileText,
  KeyRound,
  Upload,
  Sparkles,
} from 'lucide-react';
import productShowcaseImg from '../../assets/images/artisan_product_showcase_1790461520770.jpg';
import {
  BrowserNavigationEventDetail,
} from '../../browser-agent/browser-agent';
import { ResearchSourceItem } from '../../shared/types';

export type SandboxSiteId =
  | 'maroc-stage'
  | 'souk-artisan'
  | 'watiqa-form'
  | 'security-password'
  | 'web-research';

interface WebpageSandboxProps {
  activeSite: SandboxSiteId;
  onSelectSite: (site: SandboxSiteId) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  overlayNode: React.ReactNode;
  onMetaChange: (meta: { title: string; url: string }) => void;
}

export const WebpageSandbox: React.FC<WebpageSandboxProps> = ({
  activeSite,
  onSelectSite,
  containerRef,
  overlayNode,
  onMetaChange,
}) => {
  // Sub-views inside Site 1 (MarocStage Portal)
  const [portalSubpage, setPortalSubpage] = useState<
    'home' | 'login' | 'signup' | 'stages'
  >('home');

  // Form states & completion banners
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Signup state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPass, setSignupPass] = useState('');

  // Stage search state
  const [stageQuery, setStageQuery] = useState('');
  const [stageCity, setStageCity] = useState('');

  // E-Commerce state
  const [productOption, setProductOption] = useState('');
  const [cartAdded, setCartAdded] = useState(false);
  const [buyerCity, setBuyerCity] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [productImgError, setProductImgError] = useState(false);

  // Watiqa Form & Document state
  const [formFullName, setFormFullName] = useState('');
  const [formCin, setFormCin] = useState('');
  const [formDocType, setFormDocType] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');

  // Security Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Site 5: Interactive Web Research & Browser Agent Viewport State
  const [webViewMode, setWebViewMode] = useState<
    'google-home' | 'youtube-home' | 'search-results' | 'inspected-page'
  >('google-home');
  const [webSearchQuery, setWebSearchQuery] = useState(
    'AI courses Morocco official programs'
  );
  const [webCustomUrl, setWebCustomUrl] = useState('https://www.google.com');
  const [webCustomTitle, setWebCustomTitle] = useState(
    'Google — Search & Web Research'
  );
  const [webSources, setWebSources] = useState<ResearchSourceItem[]>([
    {
      title: 'UM6P — College of Computing & AI Programs (Benguerir / Rabat)',
      url: 'https://cc.um6p.ma/ai-programs',
      domain: 'cc.um6p.ma',
      snippet:
        'Official academic & executive programs in Machine Learning, Data Science, and Applied AI in Morocco.',
      isOfficial: true,
      inspected: true,
      freshnessNote: 'Verified 2025/2026 academic catalog',
    },
    {
      title: '1337 & YouCode Morocco — Free Peer-to-Peer AI & Software Tracks',
      url: 'https://1337.ma/en/curriculum',
      domain: '1337.ma',
      snippet:
        '100% tuition-free coding and AI specialization campuses in Khouribga, Benguerir, Tetouan, and Rabat.',
      isOfficial: true,
      inspected: true,
      freshnessNote: 'Official admission portal',
    },
    {
      title: 'MoroccoAI — Community Workshops, Bootcamps & Summer Schools',
      url: 'https://morocco.ai/initiatives',
      domain: 'morocco.ai',
      snippet:
        'Non-profit organization led by Moroccan AI researchers offering annual Data & AI schools and mentoring.',
      isOfficial: true,
      inspected: true,
      freshnessNote: 'Active community initiatives',
    },
  ]);
  const [inspectedSource, setInspectedSource] =
    useState<ResearchSourceItem | null>(null);

  // Browser navigation history stack for Back / Forward / Reload
  const [navHistory, setNavHistory] = useState<
    Array<{ site: SandboxSiteId; url: string; title: string }>
  >([
    {
      site: 'maroc-stage',
      url: 'https://marocstage.ma/accueil',
      title: 'MarocStage — Portail National des Stages & Comptes',
    },
  ]);
  const [navIndex, setNavIndex] = useState(0);

  const pushHistoryEntry = (
    site: SandboxSiteId,
    url: string,
    title: string
  ) => {
    setNavHistory((prev) => {
      const sliced = prev.slice(0, navIndex + 1);
      return [...sliced, { site, url, title }];
    });
    setNavIndex((prev) => prev + 1);
    onMetaChange({ title, url });
  };

  useEffect(() => {
    const handleBrowserAgentEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<BrowserNavigationEventDetail>;
      const detail = customEv.detail;
      if (!detail) return;

      if (detail.browserAction === 'go_back') {
        setNavIndex((prevIdx) => {
          if (prevIdx > 0) {
            const target = navHistory[prevIdx - 1];
            if (target) {
              onSelectSite(target.site);
              onMetaChange({ title: target.title, url: target.url });
              setStatusBanner(`Navigated back to ${target.url}`);
            }
            return prevIdx - 1;
          }
          return prevIdx;
        });
        return;
      }

      if (detail.browserAction === 'go_forward') {
        setNavIndex((prevIdx) => {
          if (prevIdx < navHistory.length - 1) {
            const target = navHistory[prevIdx + 1];
            if (target) {
              onSelectSite(target.site);
              onMetaChange({ title: target.title, url: target.url });
              setStatusBanner(`Navigated forward to ${target.url}`);
            }
            return prevIdx + 1;
          }
          return prevIdx;
        });
        return;
      }

      if (detail.browserAction === 'reload') {
        setStatusBanner('Page reloaded successfully · تم تحديث الصفحة بنجاح');
        return;
      }

      if (detail.browserAction === 'switch_tab') {
        const order: SandboxSiteId[] = [
          'maroc-stage',
          'souk-artisan',
          'watiqa-form',
          'security-password',
          'web-research',
        ];
        const nextSite =
          order[(order.indexOf(activeSite) + 1) % order.length];
        switchSite(nextSite);
        return;
      }

      if (detail.browserAction === 'open_tab' && detail.targetUrl) {
        onSelectSite('web-research');
        const lowerUrl = detail.targetUrl.toLowerCase();
        if (lowerUrl.includes('youtube.com')) {
          setWebViewMode('youtube-home');
          setWebCustomUrl('https://www.youtube.com');
          setWebCustomTitle('YouTube — Videos, Courses & Tech Channels');
          pushHistoryEntry(
            'web-research',
            'https://www.youtube.com',
            'YouTube — Videos, Courses & Tech Channels'
          );
        } else if (lowerUrl.includes('google.com') && !detail.searchQuery) {
          setWebViewMode('google-home');
          setWebCustomUrl('https://www.google.com');
          setWebCustomTitle('Google — Search & Web Research');
          pushHistoryEntry(
            'web-research',
            'https://www.google.com',
            'Google — Search & Web Research'
          );
        } else {
          const customSrc: ResearchSourceItem = {
            title: `${detail.targetUrl.replace(/^https?:\/\/(www\.)?/, '')} — Official Portal`,
            url: detail.targetUrl,
            domain: detail.targetUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0],
            snippet: `Opened ${detail.targetUrl} via M3ak Browser Agent.`,
            isOfficial: true,
            inspected: true,
          };
          setInspectedSource(customSrc);
          setWebViewMode('inspected-page');
          setWebCustomUrl(detail.targetUrl);
          setWebCustomTitle(customSrc.title);
          pushHistoryEntry('web-research', detail.targetUrl, customSrc.title);
        }
        return;
      }

      if (
        detail.browserAction === 'search_query' ||
        detail.browserAction === 'open_search_engine'
      ) {
        const q = detail.searchQuery || 'AI courses Morocco';
        onSelectSite('web-research');
        setWebSearchQuery(q);
        setWebViewMode('search-results');
        if (detail.plan?.sources && detail.plan.sources.length > 0) {
          setWebSources(detail.plan.sources);
        }
        const url =
          detail.targetUrl ||
          `https://www.google.com/search?q=${encodeURIComponent(q)}`;
        const title = `Google Search — ${q}`;
        setWebCustomUrl(url);
        setWebCustomTitle(title);
        pushHistoryEntry('web-research', url, title);
        return;
      }

      if (detail.browserAction === 'open_search_result' && detail.targetUrl) {
        onSelectSite('web-research');
        const matched =
          webSources.find((s) => s.url === detail.targetUrl) ||
          detail.plan?.sources?.find((s) => s.url === detail.targetUrl) || {
            title: detail.targetUrl,
            url: detail.targetUrl,
            domain: detail.targetUrl.replace(/^https?:\/\/(www\.)?/, '').split('/')[0],
            snippet: 'Inspected page content verified by M3ak Browser Agent.',
            isOfficial: true,
            inspected: true,
          };
        setInspectedSource(matched);
        setWebViewMode('inspected-page');
        setWebCustomUrl(matched.url);
        setWebCustomTitle(matched.title);
        pushHistoryEntry('web-research', matched.url, matched.title);
      }
    };

    window.addEventListener(
      'm3ak:browser-agent-navigate',
      handleBrowserAgentEvent
    );
    return () => {
      window.removeEventListener(
        'm3ak:browser-agent-navigate',
        handleBrowserAgentEvent
      );
    };
  }, [activeSite, navHistory, navIndex, onMetaChange, onSelectSite, webSources]);

  const switchSite = (site: SandboxSiteId) => {
    setStatusBanner(null);
    onSelectSite(site);
    if (site === 'maroc-stage') {
      setPortalSubpage('home');
      onMetaChange({
        title: 'MarocStage — Portail National des Stages & Comptes',
        url: 'https://marocstage.ma/accueil',
      });
    } else if (site === 'souk-artisan') {
      onMetaChange({
        title: 'SoukArtisan Maroc — Sac Cuir & Audio Studio Edition',
        url: 'https://soukartisan.ma/produits/sac-cuir-atlas',
      });
    } else if (site === 'watiqa-form') {
      onMetaChange({
        title: 'Portail Watiqa — Formulaire & Envoi de Documents',
        url: 'https://watiqa-service.ma/formulaire-demande',
      });
    } else if (site === 'security-password') {
      onMetaChange({
        title: 'MonCompte — Paramètres de Sécurité & Mot de Passe',
        url: 'https://moncompte.ma/securite/password',
      });
    } else if (site === 'web-research') {
      onMetaChange({
        title: webCustomTitle,
        url: webCustomUrl,
      });
    }
  };

  const navigatePortalSubpage = (
    sub: 'home' | 'login' | 'signup' | 'stages'
  ) => {
    setStatusBanner(null);
    setPortalSubpage(sub);
    const metaMap = {
      home: {
        title: 'MarocStage — Portail National des Stages & Comptes',
        url: 'https://marocstage.ma/accueil',
      },
      login: {
        title: 'MarocStage — Page de Connexion (Login)',
        url: 'https://marocstage.ma/login',
      },
      signup: {
        title: 'MarocStage — Créer un Compte (Sign Up)',
        url: 'https://marocstage.ma/register',
      },
      stages: {
        title: 'MarocStage — Recherche d’Offres de Stage PFE',
        url: 'https://marocstage.ma/stages-pfe',
      },
    };
    onMetaChange(metaMap[sub]);
  };

  const currentUrl =
    activeSite === 'maroc-stage'
      ? `https://marocstage.ma/${portalSubpage === 'home' ? 'accueil' : portalSubpage}`
      : activeSite === 'souk-artisan'
      ? 'https://soukartisan.ma/produits/sac-cuir-atlas'
      : activeSite === 'watiqa-form'
      ? 'https://watiqa-service.ma/formulaire-demande'
      : activeSite === 'security-password'
      ? 'https://moncompte.ma/securite/password'
      : webCustomUrl;

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-950">
      {/* Simulated Chrome Browser Address Bar & Scenario Switcher */}
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Scenario Tabs (Interactive Websites to test the Extension on) */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => switchSite('maroc-stage')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeSite === 'maroc-stage'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>1. Auth & Stages</span>
            </button>

            <button
              type="button"
              onClick={() => switchSite('souk-artisan')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeSite === 'souk-artisan'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>2. E-Commerce</span>
            </button>

            <button
              type="button"
              onClick={() => switchSite('watiqa-form')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeSite === 'watiqa-form'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>3. Formulaire & Doc</span>
            </button>

            <button
              type="button"
              onClick={() => switchSite('security-password')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeSite === 'security-password'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>4. Password</span>
            </button>

            <button
              type="button"
              onClick={() => switchSite('web-research')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeSite === 'web-research'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              <span>5. Web & Search</span>
            </button>
          </div>

          {/* Simulated URL Bar + Back / Forward / Reload Controls */}
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 min-w-[220px]">
            <button
              type="button"
              disabled={navIndex <= 0}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('m3ak:browser-agent-navigate', {
                    detail: { browserAction: 'go_back' },
                  })
                )
              }
              className="text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Go Back (رجع للور)"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={navIndex >= navHistory.length - 1}
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent('m3ak:browser-agent-navigate', {
                    detail: { browserAction: 'go_forward' },
                  })
                )
              }
              className="text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              title="Go Forward (زيد لقدام)"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <Lock className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <Globe className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate font-mono-tabular text-xs text-slate-300">
              {currentUrl}
            </span>
            <button
              type="button"
              onClick={() => switchSite(activeSite)}
              className="ml-auto text-slate-500 hover:text-slate-200 transition-colors"
              title="Reload current page (عاود شارجي الصفحة)"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Webpage Viewport Container (Inspected by DOMAnalyzer & Highlighted by VisualHighlightOverlay) */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto bg-white text-slate-900 p-6 sm:p-8"
      >
        {/* Visual Highlight Overlay injected over the active webpage */}
        {overlayNode}

        {/* Status / Success Banner (Detected by DOMAnalyzer on task completion) */}
        {statusBanner && (
          <div
            data-status-banner="true"
            role="alert"
            className="mb-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>{statusBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              className="text-xs font-semibold text-emerald-700 hover:underline"
            >
              Fermer
            </button>
          </div>
        )}

        {/* =========================================================
            SITE 1: MAROCSTAGE PORTAL (Login, Sign Up, Stage Search)
           ========================================================= */}
        {activeSite === 'maroc-stage' && (
          <div className="mx-auto max-w-3xl">
            {/* Website Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <button
                type="button"
                onClick={() => navigatePortalSubpage('home')}
                className="text-lg font-bold tracking-tight text-slate-900"
              >
                MarocStage.ma
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => navigatePortalSubpage('stages')}
                  className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                    portalSubpage === 'stages'
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Offres de Stage
                </button>

                <button
                  type="button"
                  onClick={() => navigatePortalSubpage('login')}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                    portalSubpage === 'login'
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  Login / Se connecter
                </button>

                <button
                  type="button"
                  onClick={() => navigatePortalSubpage('signup')}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Sign Up / حساب جديد
                </button>
              </div>
            </div>

            {/* Subpage 1A: Home Landing */}
            {portalSubpage === 'home' && (
              <div className="mt-8 space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <p className="text-xs font-medium text-emerald-700">
                    Portail National des Stages & Jeunes Talents
                  </p>
                  <h1 className="mt-2 text-2xl font-bold text-slate-900">
                    Trouvez votre stage PFE ou créez votre compte candidat
                  </h1>
                  <p
                    data-page-summary="true"
                    className="mt-2 text-sm text-slate-600 leading-relaxed"
                  >
                    Bienvenue sur MarocStage. Vous pouvez vous connecter via le
                    bouton Login, créer un nouveau compte via Sign Up en haut à
                    droite, ou parcourir les offres de stage disponibles.
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigatePortalSubpage('stages')}
                      className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                    >
                      Chercher un Stage (سطاج)
                    </button>
                    <button
                      type="button"
                      onClick={() => navigatePortalSubpage('signup')}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
                    >
                      Créer un Compte Candidat
                    </button>
                  </div>
                </div>

                {/* Quick Test Guide Box for the user */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold text-slate-700">
                    💡 جرب تقول للمساعد M3ak على اليمين:
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>• &quot;bghit n9leb 3la login&quot;</span>
                    <span>·</span>
                    <span>• &quot;bghit ndir compte hna&quot;</span>
                    <span>·</span>
                    <span>• &quot;bghit n9leb 3la stage&quot;</span>
                  </div>
                </div>
              </div>
            )}

            {/* Subpage 1B: Login Page */}
            {portalSubpage === 'login' && (
              <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-bold text-slate-900">
                  Connexion à votre compte (Login)
                </h1>
                <p
                  data-page-summary="true"
                  className="mt-1 text-xs text-slate-500"
                >
                  Page de connexion MarocStage avec deux champs: Email et
                  Password, puis le bouton Se connecter.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setStatusBanner(
                      `تم بنجاح! مرحبا بيك فحسابك (${loginEmail || 'youssef@marocstage.ma'}).`
                    );
                  }}
                  className="mt-5 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="login-email-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Adresse Email (البريد الإلكتروني)
                    </label>
                    <input
                      id="login-email-input"
                      name="email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="exemple@email.ma"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Mot de passe (كلمة السر - Password)
                    </label>
                    <input
                      id="login-password-input"
                      name="password"
                      type="password"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                  >
                    Login / Se connecter
                  </button>
                </form>
              </div>
            )}

            {/* Subpage 1C: Sign Up / Registration Page */}
            {portalSubpage === 'signup' && (
              <div className="mx-auto mt-8 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-bold text-slate-900">
                  Créer un nouveau compte (Sign Up)
                </h1>
                <p
                  data-page-summary="true"
                  className="mt-1 text-xs text-slate-500"
                >
                  Formulaire d’inscription pour créer un compte candidat: Nom
                  complet, Email, Password, et bouton Confirmer l’inscription.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setStatusBanner(
                      `Compte créé avec succès ! تم إنشاء الحساب ديالك بنجاح (${signupName || 'Candidat'}).`
                    );
                  }}
                  className="mt-5 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="signup-name-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Nom Complet (الإسم الكامل)
                    </label>
                    <input
                      id="signup-name-input"
                      name="fullName"
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      placeholder="Ex: Youssef El Amrani"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-email-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Adresse Email (الإيميل ديالك)
                    </label>
                    <input
                      id="signup-email-input"
                      name="email"
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      placeholder="youssef@etudiant.ma"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="signup-pass-input"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Choisir un Mot de passe (كلمة السر)
                    </label>
                    <input
                      id="signup-pass-input"
                      name="password"
                      type="password"
                      value={signupPass}
                      onChange={(e) => setSignupPass(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    Créer mon compte (تأكيد التسجيل)
                  </button>
                </form>
              </div>
            )}

            {/* Subpage 1D: Internship Search & Application */}
            {portalSubpage === 'stages' && (
              <div className="mt-8 space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h1 className="text-xl font-bold text-slate-900">
                    Rechercher un Stage PFE / Pré-embauche
                  </h1>
                  <p
                    data-page-summary="true"
                    className="mt-1 text-xs text-slate-500"
                  >
                    Recherchez une offre de stage par domaine (Informatique,
                    Finance, Marketing) et ville, puis cliquez sur Postuler.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="stage-domain-input"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Domaine ou Spécialité (التخصص أو الميدان)
                      </label>
                      <input
                        id="stage-domain-input"
                        name="stageDomain"
                        type="text"
                        value={stageQuery}
                        onChange={(e) => setStageQuery(e.target.value)}
                        placeholder="Ex: Développement Web, Finance..."
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="stage-city-select"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Ville (المدينة)
                      </label>
                      <select
                        id="stage-city-select"
                        name="city"
                        value={stageCity}
                        onChange={(e) => setStageCity(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                      >
                        <option value="">Choisir la ville...</option>
                        <option value="Casablanca">Casablanca (الدار البيضاء)</option>
                        <option value="Rabat">Rabat (الرباط)</option>
                        <option value="Tanger">Tanger (طنجة)</option>
                        <option value="Marrakech">Marrakech (مراكش)</option>
                      </select>
                    </div>
                  </div>

                  {/* Featured Stage Result Card */}
                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          Stage PFE — Ingénieur Full-Stack & IA ({stageCity || 'Casablanca'})
                        </h2>
                        <p className="mt-0.5 text-xs text-slate-600">
                          AtlasTech Maroc · Durée: 4 à 6 mois · Indemnité: 4 500 MAD/mois
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setStatusBanner(
                            'Candidature envoyée ! تم إرسال طلب السطاج ديالك بنجاح.'
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors whitespace-nowrap"
                      >
                        Submit Application · Postuler للسطاج
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================
            SITE 2: SOUKARTISAN E-COMMERCE ("bghit nchri had produit")
           ========================================================= */}
        {activeSite === 'souk-artisan' && (
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                SoukArtisan Maroc
              </span>
              <span className="text-xs font-medium text-slate-600">
                Panier ({cartAdded ? '1 article' : '0'}) · Livraison Partout au Maroc
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Product Image with Zero-Broken-Image Fallback */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                {!productImgError ? (
                  <img
                    src={productShowcaseImg}
                    alt="Sac Cuir Artisanal Atlas & Casque Studio"
                    referrerPolicy="no-referrer"
                    onError={() => setProductImgError(true)}
                    className="h-64 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-64 w-full flex-col items-center justify-center bg-slate-200 p-6 text-center text-slate-700">
                    <ShoppingBag className="h-10 w-10 text-emerald-700" />
                    <span className="mt-2 text-sm font-semibold">
                      Pack Artisan Cuir & Audio
                    </span>
                  </div>
                )}
              </div>

              {/* Product Details & Step-by-Step Purchase Controls */}
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-medium text-emerald-700">
                    Édition Limitée · Fait Main à Fès
                  </span>
                  <h1 className="mt-1 text-xl font-bold text-slate-900">
                    Sacoche Cuir Véritable Atlas
                  </h1>
                  <p
                    data-page-summary="true"
                    className="mt-1 text-xs text-slate-600"
                  >
                    Page produit e-commerce SoukArtisan. Prix: 890 MAD. Choisissez
                    la couleur/finition, ajoutez au panier, puis confirmez la
                    commande.
                  </p>
                  <div className="mt-2 font-mono-tabular text-lg font-bold text-slate-900">
                    890 MAD
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="product-color-select"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    1. Choisir la couleur du cuir (اللون)
                  </label>
                  <select
                    id="product-color-select"
                    name="productOption"
                    value={productOption}
                    onChange={(e) => setProductOption(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="">Sélectionner une finition...</option>
                    <option value="cognac">Brun Cognac Classique</option>
                    <option value="ebene">Noir Ébène</option>
                    <option value="sahara">Camel Sahara</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="buyer-phone-input"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    2. Téléphone & Ville de livraison (رقم الهاتف والمدينة)
                  </label>
                  <input
                    id="buyer-phone-input"
                    name="buyerPhone"
                    type="text"
                    value={buyerPhone}
                    onChange={(e) => setBuyerPhone(e.target.value)}
                    placeholder="Ex: 06 61 23 45 67 - Casablanca"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex flex-col gap-2.5">
                  {!cartAdded ? (
                    <button
                      type="button"
                      onClick={() => setCartAdded(true)}
                      className="w-full rounded-xl border border-slate-900 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                    >
                      Ajouter au Panier (زيد فالسلة)
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setStatusBanner(
                          'Commande confirmée ! تم تأكيد الشراء ديالك بنجاح (890 MAD).'
                        )
                      }
                      className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
                    >
                      Commander & Payer 890 MAD (تأكيد الشراء)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SITE 3: WATIQA FORM & DOCUMENT ("bghit n3ammar had formulaire" / "bghit nsift had document")
           ========================================================= */}
        {activeSite === 'watiqa-form' && (
          <div className="mx-auto max-w-xl">
            <div className="border-b border-slate-200 pb-4">
              <span className="text-xs font-semibold text-emerald-700">
                Service Administratif en Ligne
              </span>
              <h1 className="mt-1 text-xl font-bold text-slate-900">
                Formulaire de Demande & Envoi de Document
              </h1>
              <p
                data-page-summary="true"
                className="mt-1 text-xs text-slate-600"
              >
                Formulaire administratif permettant de remplir vos informations
                (Nom complet, Numéro CIN, Type d’attestation), joindre un document
                PDF/Image et envoyer le dossier.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStatusBanner(
                  'Document transmis ! تم إرسال الإستمارة والوثيقة ديالك بنجاح.'
                );
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label
                  htmlFor="form-fullname-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Nom et Prénom (الإسم والنسب)
                </label>
                <input
                  id="form-fullname-input"
                  name="fullName"
                  type="text"
                  value={formFullName}
                  onChange={(e) => setFormFullName(e.target.value)}
                  placeholder="Ex: Salma Bennani"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="form-cin-input"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Numéro de la Carte Nationale CIN (رقم البطاقة الوطنية)
                </label>
                <input
                  id="form-cin-input"
                  name="cin"
                  type="text"
                  value={formCin}
                  onChange={(e) => setFormCin(e.target.value)}
                  placeholder="Ex: BE849201"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="form-doctype-select"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Type de Document (نوع الوثيقة)
                </label>
                <select
                  id="form-doctype-select"
                  name="docType"
                  value={formDocType}
                  onChange={(e) => setFormDocType(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                >
                  <option value="">Choisir le type de document...</option>
                  <option value="attestation-scolarite">
                    Attestation de Scolarité / Stage
                  </option>
                  <option value="dossier-bourse">
                    Dossier de Bourse Universitaire
                  </option>
                  <option value="legalisation">
                    Copie Conforme & Justificatif
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Joindre le Document PDF / Scanné (إرفاق الوثيقة)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setUploadedFileName('Justificatif_Candidat_2026.pdf')
                  }
                  className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-400 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <Upload className="h-4 w-4 text-emerald-600" />
                  <span>
                    {uploadedFileName
                      ? `Fichier joint: ${uploadedFileName} ✅`
                      : 'Choisir un fichier / Upload Document (كليكي باش تزيد الوثيقة)'}
                  </span>
                </button>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                Submit & Envoyer le Document (إرسال الوثيقة والإستمارة)
              </button>
            </form>
          </div>
        )}

        {/* =========================================================
            SITE 4: SECURITY PASSWORD ("bghit nbdl password")
           ========================================================= */}
        {activeSite === 'security-password' && (
          <div className="mx-auto max-w-md">
            <div className="border-b border-slate-200 pb-4">
              <span className="text-xs font-semibold text-amber-700">
                Paramètres de Sécurité du Compte
              </span>
              <h1 className="mt-1 text-xl font-bold text-slate-900">
                Changer votre Mot de Passe (Password)
              </h1>
              <p
                data-page-summary="true"
                className="mt-1 text-xs text-slate-600"
              >
                Page de sécurité permettant de modifier votre mot de passe:
                entrez le mot de passe actuel, le nouveau mot de passe, puis
                cliquez sur Mettre à jour le mot de passe.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStatusBanner(
                  'Mot de passe mis à jour ! تم تبديل كلمة السر ديالك بنجاح.'
                );
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label
                  htmlFor="sec-current-pass"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Mot de passe actuel (كلمة السر الحالية)
                </label>
                <input
                  id="sec-current-pass"
                  name="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Entrez votre mot de passe actuel"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sec-new-pass"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Nouveau mot de passe (كلمة السر الجديدة)
                </label>
                <input
                  id="sec-new-pass"
                  name="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sec-confirm-pass"
                  className="block text-xs font-semibold text-slate-700"
                >
                  Confirmer le nouveau mot de passe (تأكيد كلمة السر الجديدة)
                </label>
                <input
                  id="sec-confirm-pass"
                  name="confirmPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Répétez le nouveau mot de passe"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Update Password · تأكيد تغيير كلمة السر
              </button>
            </form>
          </div>
        )}

        {/* =========================================================
            SITE 5: INTERACTIVE WEB RESEARCH & BROWSER AGENT VIEWPORT
           ========================================================= */}
        {activeSite === 'web-research' && (
          <div className="mx-auto max-w-3xl">
            {/* Sub-Navigation Bar for Google / YouTube / Search Results */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-semibold text-emerald-700">
                  M3ak Browser Agent & Multi-Source Web Research
                </span>
                <h1 className="text-xl font-bold text-slate-900">
                  {webViewMode === 'youtube-home'
                    ? 'YouTube — Educational & Tech Video Portal'
                    : webViewMode === 'inspected-page' && inspectedSource
                    ? inspectedSource.title
                    : webViewMode === 'search-results'
                    ? `Google Search Results: "${webSearchQuery}"`
                    : 'Google — Web Search & Research Engine'}
                </h1>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setWebViewMode('google-home');
                    setWebCustomUrl('https://www.google.com');
                    setWebCustomTitle('Google — Search & Web Research');
                    pushHistoryEntry(
                      'web-research',
                      'https://www.google.com',
                      'Google — Search & Web Research'
                    );
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    webViewMode === 'google-home'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWebViewMode('search-results');
                    const url = `https://www.google.com/search?q=${encodeURIComponent(webSearchQuery)}`;
                    setWebCustomUrl(url);
                    setWebCustomTitle(`Google Search — ${webSearchQuery}`);
                    pushHistoryEntry(
                      'web-research',
                      url,
                      `Google Search — ${webSearchQuery}`
                    );
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    webViewMode === 'search-results'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Search Results
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWebViewMode('youtube-home');
                    setWebCustomUrl('https://www.youtube.com');
                    setWebCustomTitle('YouTube — Videos, Courses & Tech Channels');
                    pushHistoryEntry(
                      'web-research',
                      'https://www.youtube.com',
                      'YouTube — Videos, Courses & Tech Channels'
                    );
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    webViewMode === 'youtube-home'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  YouTube
                </button>
              </div>
            </div>

            {/* Interactive Search Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setWebViewMode('search-results');
                const url = `https://www.google.com/search?q=${encodeURIComponent(webSearchQuery)}`;
                setWebCustomUrl(url);
                setWebCustomTitle(`Google Search — ${webSearchQuery}`);
                pushHistoryEntry(
                  'web-research',
                  url,
                  `Google Search — ${webSearchQuery}`
                );
              }}
              className="mb-6 flex items-center gap-2"
            >
              <input
                id="web-search-query-input"
                type="text"
                value={webSearchQuery}
                onChange={(e) => setWebSearchQuery(e.target.value)}
                placeholder="Search the web (e.g. AI courses Morocco, universities in Spain marketing)..."
                aria-label="Search query"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search Web</span>
              </button>
            </form>

            {/* VIEW A: GOOGLE HOME */}
            {webViewMode === 'google-home' && (
              <div className="space-y-4">
                <p
                  data-page-summary="true"
                  className="text-sm leading-relaxed text-slate-600"
                >
                  Google Search Engine ready. Say &ldquo;9leb lia 3la AI courses
                  f Morocco&rdquo;, &ldquo;qleb lia 3la chi laptop gaming
                  mzyan&rdquo;, or &ldquo;9leb lia 3la 3 universities f Spain li
                  3andhom bachelor marketing&rdquo; to let M3ak run a multi-step
                  web research workflow.
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWebSearchQuery('AI courses Morocco official programs');
                      setWebViewMode('search-results');
                    }}
                    className="rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-500 transition-colors"
                  >
                    <div className="text-xs font-semibold text-emerald-700">
                      Trending Research 01
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-900">
                      AI Courses & Bootcamps in Morocco
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      UM6P, 1337 Coding School, MoroccoAI & Coursera
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWebSearchQuery(
                        'universities in Spain with Bachelor in Marketing'
                      );
                      setWebViewMode('search-results');
                    }}
                    className="rounded-xl border border-slate-200 p-4 text-left hover:border-emerald-500 transition-colors"
                  >
                    <div className="text-xs font-semibold text-emerald-700">
                      Trending Research 02
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-900">
                      Spain Universities — Bachelor in Marketing
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      UC3M Madrid, ESIC University & UPF Barcelona (240 ECTS)
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* VIEW B: YOUTUBE PORTAL ("7ell YouTube") */}
            {webViewMode === 'youtube-home' && (
              <div className="space-y-4">
                <p
                  data-page-summary="true"
                  className="text-sm leading-relaxed text-slate-600"
                >
                  YouTube video platform opened by M3ak Browser Agent. Features
                  educational courses in Moroccan Darija, Computer Science
                  tutorials, and AI engineering lectures.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold text-rose-600">
                      Darija Tech Channel · 42 min
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      تعلّم الذكاء الاصطناعي و Machine Learning بالدارجة المغربية
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      شرح تطبيقي لـ Python، Neural Networks، وكيفاش تبدا مشاريع
                      حقيقية من الصفر.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setStatusBanner(
                          'Playing video: تعلّم الذكاء الاصطناعي بالدارجة المغربية ▶️'
                        )
                      }
                      className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Watch Video · تفرج فـ الفيديو
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-xs font-semibold text-rose-600">
                      Web Dev & APIs · 28 min
                    </div>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      Full-Stack React, TypeScript & REST APIs Crash Course
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      Step-by-step guide to building modern web applications and
                      understanding backend APIs.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setStatusBanner(
                          'Playing video: Full-Stack React & REST APIs Course ▶️'
                        )
                      }
                      className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-500"
                    >
                      Watch Video · تفرج فـ الفيديو
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW C: ORGANIC SEARCH RESULTS (With Sponsored Ad Filtering) */}
            {webViewMode === 'search-results' && (
              <div className="space-y-4">
                <div
                  data-page-summary="true"
                  className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3.5 py-2 text-xs text-emerald-900"
                >
                  <span>
                    M3ak Search Quality Guard: Filtered out sponsored ads and
                    prioritized {webSources.length} authoritative sources for{' '}
                    <strong>&ldquo;{webSearchQuery}&rdquo;</strong>.
                  </span>
                </div>

                <div className="space-y-3">
                  {webSources.map((src, idx) => (
                    <div
                      key={src.url}
                      className="rounded-xl border border-slate-200 p-4 hover:border-emerald-500 transition-colors"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          0{idx + 1}. {src.domain}
                          {src.isOfficial ? ' · Official Website' : ' · Independent Source'}
                        </span>
                        {src.freshnessNote && (
                          <span className="text-emerald-700">
                            {src.freshnessNote}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 text-base font-bold text-slate-900">
                        {src.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {src.snippet}
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedSource(src);
                            setWebViewMode('inspected-page');
                            setWebCustomUrl(src.url);
                            setWebCustomTitle(src.title);
                            pushHistoryEntry('web-research', src.url, src.title);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Inspect Source Page · فحص هاد الصفحة</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW D: INSPECTED SOURCE PAGE CONTENT */}
            {webViewMode === 'inspected-page' && inspectedSource && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="text-xs text-slate-500">
                    Domain: <strong>{inspectedSource.domain}</strong> ·{' '}
                    {inspectedSource.isOfficial
                      ? 'Verified Official Website'
                      : 'Verified Reference Page'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setWebViewMode('search-results')}
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    ← Back to Search Results
                  </button>
                </div>

                <div
                  data-page-summary="true"
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3"
                >
                  <h2 className="text-lg font-bold text-slate-900">
                    {inspectedSource.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {inspectedSource.snippet}
                  </p>
                  {inspectedSource.freshnessNote && (
                    <p className="text-xs text-emerald-700">
                      Verification Note: {inspectedSource.freshnessNote}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
