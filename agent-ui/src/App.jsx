import { createElement, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Copy,
  Cpu,
  FileSearch,
  FileText,
  Globe2,
  Layers3,
  LoaderCircle,
  MessageSquareText,
  Network,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Terminal,
  X,
  Zap,
} from 'lucide-react';

const AGENTS = [
  {
    name: 'Search Agent',
    role: 'INTELLIGENCE GATHERING',
    icon: FileSearch,
    accent: 'indigo',
    telemetry: [
      'Querying live search indices...',
      'Ranking relevant sources...',
      'Mapping source coverage...',
    ],
  },
  {
    name: 'Reader Agent',
    role: 'HTML + JINA EXTRACTION',
    icon: BookOpenText,
    accent: 'cyan',
    telemetry: [
      'Resolving top source URLs...',
      'Running BeautifulSoup extraction...',
      'Jina Reader fallback if blocked...',
    ],
  },
  {
    name: 'Writer Agent',
    role: 'INTELLIGENCE SYNTHESIS',
    icon: Layers3,
    accent: 'violet',
    telemetry: [
      'Organizing key findings...',
      'Connecting evidence across sources...',
      'Drafting the research brief...',
    ],
  },
  {
    name: 'Critic Agent',
    role: 'ADVERSARIAL REVIEW',
    icon: ShieldAlert,
    accent: 'emerald',
    telemetry: [
      'Cross-verifying citations...',
      'Checking claims and reasoning...',
      'Reviewing the final report...',
    ],
  },
];

const SUGGESTIONS = [
  'What changed in AI this week?',
  'The future of quantum computing',
  'Breakthroughs in clean energy',
];

const API_URL = 'http://127.0.0.1:8000/api/research';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const MarkdownReport = lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);
  const components = {
    blockquote: ({ children }) => createElement('blockquote', { className: 'briefing-callout' }, children),
    pre: ({ children }) => createElement('pre', { className: 'briefing-code' }, children),
    table: ({ children }) => createElement(
      'div',
      { className: 'briefing-table-wrap' },
      createElement('table', null, children),
    ),
  };
  return {
    default: ({ children }) => createElement(
      'article',
      { className: 'briefing-markdown' },
      createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], components }, children),
    ),
  };
});

function getQualityScore(feedback) {
  const match = feedback.match(/(?:score|rating)\s*[:-]?\s*(\d{1,2})(?:\s*\/\s*10)?/i)
    || feedback.match(/\b(\d{1,2})\s*\/\s*10\b/i);
  if (!match) return null;
  return clamp(Number(match[1]), 0, 10);
}

function getReviewSignals(feedback, score) {
  const text = feedback.toLowerCase();
  const base = score === null ? 68 : score * 10;
  const signal = (positive, negative, offset = 0) => {
    const hasPositive = positive.some((word) => text.includes(word));
    const hasNegative = negative.some((word) => text.includes(word));
    return clamp(Math.round(base + (hasPositive ? 7 : 0) - (hasNegative ? 12 : 0) + offset), 24, 98);
  };

  return [
    {
      label: 'Factual grounding',
      value: signal(['accurate', 'factually sound', 'well-supported', 'verified'], ['inaccurate', 'unsupported', 'unverified', 'factual error']),
      color: 'emerald',
    },
    {
      label: 'Analytical depth',
      value: signal(['thorough', 'detailed', 'in-depth', 'comprehensive'], ['shallow', 'lacks depth', 'superficial'], -2),
      color: 'amber',
    },
    {
      label: 'Balance & neutrality',
      value: signal(['balanced', 'neutral', 'objective', 'multiple perspectives'], ['biased', 'one-sided', 'unbalanced'], 2),
      color: 'rose',
    },
  ];
}

function AgentNode({ agent, index, state, telemetryIndex, elapsed }) {
  const Icon = agent.icon;
  const isActive = state === 'active';
  const isComplete = state === 'complete';
  const isError = state === 'error';
  const microState = agent.telemetry[telemetryIndex % agent.telemetry.length];

  return (
    <motion.article
      className={`agent-card accent-${agent.accent} ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''} ${isError ? 'is-error' : ''}`}
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <div className="agent-card-top">
        <span className="agent-index">0{index + 1}</span>
        <span className="agent-state-label">
          {isComplete ? 'COMPLETE' : isActive ? 'RUNNING' : isError ? 'INTERRUPTED' : 'STANDBY'}
        </span>
      </div>

      <div className="agent-icon-wrap">
        {isActive && <span className="radar-ring" />}
        <span className="agent-icon">
          {isComplete ? <CheckCircle2 size={21} /> : <Icon size={21} />}
        </span>
      </div>

      <h3>{agent.name}</h3>
      <p className="agent-role">{agent.role}</p>

      <div className={`agent-telemetry ${isActive ? 'telemetry-live' : ''}`}>
        <Terminal size={12} />
        <span>{isActive ? microState : isComplete ? 'Stage complete.' : isError ? 'Pipeline stopped.' : 'Awaiting handoff...'}</span>
        {isActive && <i className="terminal-cursor" />}
      </div>
      <div className="agent-card-footer">
        <span><Activity size={12} /> {isActive ? `T+${elapsed}s` : isComplete ? 'Signal secured' : 'On standby'}</span>
        {isActive && <LoaderCircle className="agent-spinner" size={13} />}
      </div>
    </motion.article>
  );
}

export default function App() {
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('idle');
  const [activeStage, setActiveStage] = useState(-1);
  const [telemetryIndex, setTelemetryIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState({ report: '', feedback: '' });
  const [activeTab, setActiveTab] = useState('report');
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState('');
  const inputRef = useRef(null);
  const isProcessing = status === 'processing';
  const qualityScore = getQualityScore(results.feedback);
  const reviewSignals = getReviewSignals(results.feedback, qualityScore);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (!isProcessing) return undefined;
    const clock = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    const telemetry = window.setInterval(() => setTelemetryIndex((index) => index + 1), 2400);
    const progression = window.setInterval(
      () => setActiveStage((stage) => Math.min(stage + 1, AGENTS.length - 1)),
      3200,
    );
    return () => {
      window.clearInterval(clock);
      window.clearInterval(telemetry);
      window.clearInterval(progression);
    };
  }, [isProcessing]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const runResearch = async (event) => {
    event.preventDefault();
    const query = topic.trim();
    if (!query || isProcessing) return;

    setStatus('processing');
    setActiveStage(0);
    setTelemetryIndex(0);
    setElapsed(0);
    setResults({ report: '', feedback: '' });
    setErrorMessage('');
    setActiveTab('report');

    try {
      const response = await axios.post(API_URL, { topic: query }, { timeout: 180000 });
      setResults({
        report: response.data.report || '',
        feedback: response.data.feedback || '',
      });
      setActiveStage(AGENTS.length);
      setStatus('complete');
      window.setTimeout(() => {
        document.querySelector('#results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.detail
          || error.message
          || 'The research request could not be completed.',
      );
      setStatus('error');
    }
  };

  const resetResearch = () => {
    setStatus('idle');
    setActiveStage(-1);
    setTopic('');
    setResults({ report: '', feedback: '' });
    setErrorMessage('');
    inputRef.current?.focus();
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(results.report);
      setToast('Markdown copied to clipboard');
    } catch {
      setToast('Clipboard unavailable — select the report text to copy');
    }
  };

  const exportPdf = () => window.print();

  const resultText = activeTab === 'report' ? results.report : results.feedback;
  const activeStageForDisplay = isProcessing
    ? activeStage
    : status === 'complete'
      ? AGENTS.length - 1
      : -1;

  return (
    <div className="research-app">
      <div className="aurora aurora-primary" aria-hidden="true" />
      <div className="aurora aurora-secondary" aria-hidden="true" />
      <div className="grid-overlay" aria-hidden="true" />

      <header className="app-header">
        <a className="product-brand" href="#top" aria-label="Atlas Research home">
          <span className="brand-symbol"><Network size={18} /></span>
          <span className="brand-name">ATLAS<span>/</span>RESEARCH</span>
        </a>
        <div className="header-center">
          <span className="header-live-dot" />
          AUTONOMOUS DEEP RESEARCH
        </div>
        <div className="header-actions">
          <span className="system-health"><span /> SYSTEM OPERATIONAL</span>
          <span className="header-rule" />
          <button className="header-help" type="button" aria-label="About this research system" onClick={() => document.querySelector('#swarm')?.scrollIntoView({ behavior: 'smooth' })}>
            <CircleHelp size={17} />
          </button>
          <div className="user-chip"><span>A</span><ChevronDown size={13} /></div>
        </div>
      </header>

      <main className="workspace" id="top">
        <section className="command-section">
          <motion.div
            className="command-intro"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="eyebrow"><span /> YOUR PERSONAL INTELLIGENCE ENGINE</div>
            <h1>Research at the <span>speed of thought.</span></h1>
            <p>One question. Four specialized agents. A clearer picture of what matters.</p>
          </motion.div>

          <motion.form
            className="command-form"
            onSubmit={runResearch}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.55 }}
          >
            <label className="sr-only" htmlFor="research-query">Your research question</label>
            <div className="command-input-row">
              <Search className="command-search-icon" size={19} />
              <input
                id="research-query"
                ref={inputRef}
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="What would you like to understand?"
                autoComplete="off"
                disabled={isProcessing}
              />
              <kbd className="shortcut-key"><span>⌘</span><span>+</span><span>K</span></kbd>
              <button className="deploy-button" type="submit" disabled={!topic.trim() || isProcessing}>
                {isProcessing ? <LoaderCircle className="agent-spinner" size={15} /> : <Zap size={15} />}
                <span>{isProcessing ? 'Deploying' : 'Deploy swarm'}</span>
                {!isProcessing && <ArrowRight size={15} />}
                <span className="button-shimmer" aria-hidden="true" />
              </button>
            </div>
            <div className="command-foot">
              <span><Sparkles size={13} /> Specific questions lead to sharper intelligence.</span>
              <span>ENTER TO DEPLOY <span className="enter-key">↵</span></span>
            </div>
          </motion.form>

          {status === 'idle' && (
            <div className="suggestion-row">
              <span>QUICK START</span>
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setTopic(suggestion)}>
                  {suggestion}<ArrowRight size={11} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="swarm-section" id="swarm" aria-labelledby="swarm-heading">
          <div className="section-head">
            <div>
              <div className="section-overline"><span className="overline-mark" /> MULTI-AGENT ORCHESTRATION</div>
              <h2 id="swarm-heading">Intelligence pipeline</h2>
            </div>
            <div className={`pipeline-status ${isProcessing ? 'status-running' : status === 'error' ? 'status-error' : status === 'complete' ? 'status-done' : ''}`}>
              <span />
              {isProcessing ? `SWARM ACTIVE · ${elapsed}s` : status === 'error' ? 'RUN INTERRUPTED' : status === 'complete' ? 'RUN COMPLETE' : 'AWAITING QUERY'}
            </div>
          </div>

          <div className={`pipeline-frame ${isProcessing ? 'pipeline-running' : ''}`}>
            <div className="pipeline-meta">
              <span><Cpu size={13} /> ORCHESTRATOR <b>ATLAS-01</b></span>
              <span><Globe2 size={13} /> LIVE WEB INTELLIGENCE</span>
            </div>
            <div className="pipeline-scroll">
              <div className="pipeline-canvas">
                <svg className="connection-layer" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="beamGradient" x1="0" x2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
                      <stop offset="50%" stopColor="#818cf8" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.8" />
                    </linearGradient>
                    <filter id="beamGlow" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  {[0, 1, 2].map((connector) => {
                    const start = 125 + connector * 250;
                    const end = start + 250;
                    const reached = activeStageForDisplay > connector;
                    return (
                      <g key={connector}>
                        <path className="connection-track" d={`M ${start} 30 L ${end} 30`} />
                        {reached && (
                          <motion.path
                            className="connection-beam"
                            d={`M ${start} 30 L ${end} 30`}
                            stroke="url(#beamGradient)"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                          />
                        )}
                        {isProcessing && connector === activeStageForDisplay && (
                          <motion.circle
                            r="3"
                            fill="#a5b4fc"
                            filter="url(#beamGlow)"
                            initial={{ cx: start }}
                            animate={{ cx: end }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear' }}
                          >
                            <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" />
                          </motion.circle>
                        )}
                      </g>
                    );
                  })}
                </svg>
                <div className="agent-grid">
                  {AGENTS.map((agent, index) => {
                    const state = status === 'error' && index === Math.max(activeStage, 0)
                      ? 'error'
                      : status === 'complete' || index < activeStage
                        ? 'complete'
                        : index === activeStage && isProcessing
                          ? 'active'
                          : 'idle';
                    return (
                      <AgentNode
                        key={agent.name}
                        agent={agent}
                        index={index}
                        state={state}
                        telemetryIndex={telemetryIndex}
                        elapsed={elapsed}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="pipeline-foot">
              <span><span className="telemetry-dot" /> TELEMETRY STREAM <b>{isProcessing ? 'STREAMING' : 'READY'}</b></span>
              <span><Clock3 size={12} /> {isProcessing ? `ELAPSED ${elapsed}s` : 'END-TO-END ORCHESTRATION'}</span>
              <span className="simulated-label">UI STAGE INDICATORS · API RETURNS FINAL RESULT</span>
            </div>
          </div>
        </section>

        <AnimatePresence mode="wait">
          {isProcessing && (
            <motion.div
              className="processing-banner"
              key="processing"
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -8, height: 0 }}
            >
              <span className="processing-pulse"><LoaderCircle size={16} /></span>
              <span><strong>Agents are working on your brief</strong><small>Research can take a minute. You can keep this tab open while the swarm runs.</small></span>
              <span className="processing-live">LIVE</span>
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div
              className="error-banner"
              key="error"
              role="alert"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <span className="error-icon"><X size={17} /></span>
              <span><strong>Research run failed</strong><small>{errorMessage}</small></span>
              <button type="button" onClick={runResearch}>Retry <ArrowRight size={13} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'complete' && (
            <motion.section
              className="results-section"
              id="results"
              key="results"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.42 }}
            >
              <div className="results-title-row">
                <div>
                  <div className="section-overline"><span className="overline-mark" /> EXECUTIVE INTELLIGENCE</div>
                  <h2>Research brief</h2>
                  <p className="results-topic">{topic}</p>
                </div>
                <button className="new-query-button" type="button" onClick={resetResearch}>
                  <Plus size={14} /> New query
                </button>
              </div>

              <div className="results-bento">
                <div className="briefing-card">
                  <div className="briefing-toolbar">
                    <div className="briefing-toolbar-left">
                      <span className="briefing-doc-icon"><FileText size={16} /></span>
                      <span><strong>INTELLIGENCE MEMO</strong><small>Prepared by Atlas Research</small></span>
                    </div>
                    <div className="briefing-actions">
                      <span className={`quality-badge ${qualityScore !== null && qualityScore >= 7 ? 'quality-good' : 'quality-review'}`}>
                        <Sparkles size={13} />
                        {qualityScore === null ? 'QUALITY REVIEW' : `QUALITY ${qualityScore}/10`}
                      </span>
                      <button type="button" onClick={copyMarkdown}><Copy size={14} /> <span>Copy Markdown</span></button>
                      <button type="button" onClick={exportPdf}><ArrowDownToLine size={14} /> <span>Export PDF</span></button>
                    </div>
                  </div>

                  <div className="briefing-tabs" role="tablist" aria-label="Research brief sections">
                    <button className={activeTab === 'report' ? 'brief-tab selected' : 'brief-tab'} type="button" role="tab" aria-selected={activeTab === 'report'} onClick={() => setActiveTab('report')}>
                      <FileText size={14} /> Executive brief
                    </button>
                    <button className={activeTab === 'review' ? 'brief-tab selected' : 'brief-tab'} type="button" role="tab" aria-selected={activeTab === 'review'} onClick={() => setActiveTab('review')}>
                      <MessageSquareText size={14} /> Peer review
                    </button>
                  </div>

                  <div className="briefing-content" role="tabpanel">
                    {resultText ? (
                      <Suspense fallback={<div className="markdown-loading">Preparing intelligence brief…</div>}>
                        <MarkdownReport>{resultText}</MarkdownReport>
                      </Suspense>
                    ) : (
                      <div className="empty-review"><ShieldAlert size={18} /> The research critic did not return written feedback for this run.</div>
                    )}
                  </div>
                  <div className="briefing-foot">
                    <span><CheckCircle2 size={14} /> SYNTHESIS COMPLETE</span>
                    <span>AI-GENERATED ANALYSIS · VERIFY IMPORTANT CLAIMS AGAINST ORIGINAL SOURCES</span>
                  </div>
                </div>

                <aside className="review-card">
                  <div className="review-card-heading">
                    <span className="review-icon"><ShieldAlert size={16} /></span>
                    <span><strong>Peer review &amp; audit</strong><small>Critic agent assessment</small></span>
                    <span className="review-live"><span /> REVIEWED</span>
                  </div>
                  <div className="review-score-row">
                    <div className="score-orb">
                      <span>{qualityScore === null ? '—' : qualityScore.toFixed(1)}</span>
                      <small>/ 10</small>
                    </div>
                    <span className="score-summary">
                      <strong>{qualityScore === null ? 'Score unavailable' : qualityScore >= 8 ? 'Strong assessment' : qualityScore >= 6 ? 'Solid foundation' : 'Needs another pass'}</strong>
                      <small>{qualityScore === null ? 'No numeric score found' : 'From critic feedback'}</small>
                    </span>
                  </div>
                  <div className="review-signals-heading">
                    <span>REVIEW SIGNALS</span>
                    <span>INDICATIVE</span>
                  </div>
                  <div className="review-signals">
                    {reviewSignals.map((signal, index) => (
                      <div className="signal-row" key={signal.label}>
                        <div className="signal-label"><span>{signal.label}</span><b>{signal.value}%</b></div>
                        <div className="signal-track">
                          <motion.span
                            className={`signal-fill signal-${signal.color}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${signal.value}%` }}
                            transition={{ duration: 0.75, delay: 0.18 + index * 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="signals-disclaimer">Directional estimates from critic wording—not independently measured metrics.</p>
                  <div className="audit-note">
                    <Zap size={14} />
                    <span>Use cited sources to verify decisions that depend on this analysis.</span>
                  </div>
                </aside>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <footer className="app-footer">
          <span><span className="footer-mark"><Network size={13} /></span> ATLAS AUTONOMOUS RESEARCH</span>
          <span>Grounded in sources. Designed for better questions.</span>
          <a href="#swarm">SYSTEM ARCHITECTURE <ArrowDownToLine size={12} /></a>
        </footer>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast-message"
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <Check size={15} /> {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
