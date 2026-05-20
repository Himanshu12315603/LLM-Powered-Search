import axios from "axios";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js/dist/index.cjs";
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { BACKEND_URL } from "@/lib/config";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search, Plus, MessageSquare, LogOut, Loader2, Globe, Send, Sparkles, Zap, Brain, Linkedin, MessageCircleQuestion, ArrowRight, ChevronDown, Code, History, Copy, Check, Info } from "lucide-react";

const supabase = createClient();

interface Message {
  id?: number | string;
  role: "User" | "Assistant";
  content: string;
  createdAt?: string;
}

interface Conversation {
  id: string;
  title: string;
  slug: string;
}

interface SearchResult {
  title: string;
  url: string;
}

// ─── Parse <ANSWER> and <FOLLOW_UPS> tags from LLM response ────────────────
function parseResponse(raw: string): { answer: string; followUps: string[] } {
  let answer = raw;
  const followUps: string[] = [];

  // Extract content from <ANSWER>...</ANSWER> tags
  const answerMatch = raw.match(/<ANSWER>\s*([\s\S]*?)\s*<\/ANSWER>/i);
  if (answerMatch) {
    answer = answerMatch[1].trim();
  } else {
    // Fallback: strip any stray <ANSWER> or </ANSWER> tags
    answer = raw.replace(/<\/?ANSWER>/gi, '').trim();
  }

  // Extract follow-up questions from <FOLLOW_UPS>...<question>...</question>...</FOLLOW_UPS>
  const followUpsMatch = raw.match(/<FOLLOW_UPS>\s*([\s\S]*?)\s*<\/FOLLOW_UPS>/i);
  if (followUpsMatch) {
    const questionsBlock = followUpsMatch[1];
    const questionRegex = /<question>\s*([\s\S]*?)\s*<\/question>/gi;
    let qMatch;
    while ((qMatch = questionRegex.exec(questionsBlock)) !== null) {
      const q = qMatch[1].trim();
      if (q) followUps.push(q);
    }
    // Remove the entire <FOLLOW_UPS> block from the answer if it leaked through
    answer = answer.replace(/<FOLLOW_UPS>[\s\S]*<\/FOLLOW_UPS>/gi, '').trim();
  }

  // Clean up any remaining stray tags
  answer = answer
    .replace(/<\/?FOLLOW_UPS>/gi, '')
    .replace(/<\/?question>/gi, '')
    .trim();

  return { answer, followUps };
}

// ─── FollowUpQuestions component ────────────────────────────────────────────
function FollowUpQuestions({ questions, onSelect }: { questions: string[]; onSelect: (q: string) => void }) {
  if (questions.length === 0) return null;

  return (
    <div className="mt-5 pt-4 border-t border-border/50 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 rounded-md bg-chart-2/15 flex items-center justify-center">
          <MessageCircleQuestion size={12} className="text-chart-2" />
        </div>
        <span className="text-sm font-semibold gradient-text">Related Questions</span>
      </div>
      <div className="flex flex-col gap-2 stagger-children">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => onSelect(q)}
            className="group w-full text-left flex items-center gap-3 px-4 py-3 bg-card/60 backdrop-blur-sm rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 card-hover animate-fade-in-up"
          >
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/15 to-chart-2/15 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0 group-hover:from-primary/25 group-hover:to-chart-2/25 transition-all">
              {i + 1}
            </div>
            <span className="flex-1 text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
              {q}
            </span>
            <ArrowRight size={14} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── CodeBlock component with copy functionality ───────────────────────────
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0e] shadow-xl">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-white/[0.02] px-4 py-2 border-b border-white/[0.04]">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-white transition-colors py-1 px-2 hover:bg-white/5 rounded-md"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-400 animate-fade-in" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code Area */}
      <div className="p-4 overflow-x-auto custom-scrollbar font-mono text-xs md:text-sm text-white/90 leading-relaxed bg-[#0c0c0e]">
        <pre className="m-0 bg-transparent p-0 border-0 outline-none select-text">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// ─── AssistantContent: parses and renders answer + follow-ups ─────────────────
function AssistantContent({ content, isCurrentlyStreaming, onSelectFollowUp }: {
  content: string;
  isCurrentlyStreaming: boolean;
  onSelectFollowUp: (q: string) => void;
}) {
  const parsed = parseResponse(content);
  const displayContent = parsed.answer || content;

  return (
    <>
      <div className={`prose prose-sm md:prose-base dark:prose-invert prose-headings:font-semibold prose-a:text-primary max-w-none prose-enhanced ${
        isCurrentlyStreaming ? 'typing-cursor' : ''
      }`}>
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const codeVal = String(children).replace(/\n$/, '');
              const isInline = !className && !codeVal.includes('\n');
              return !isInline ? (
                <CodeBlock code={codeVal} language={match ? match[1] : 'code'} />
              ) : (
                <code className="bg-white/10 px-1.5 py-0.5 rounded text-xs text-primary font-mono font-medium" {...props}>
                  {children}
                </code>
              );
            },
            a({ href, children, ...props }) {
              return (
                <a 
                  href={href} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-primary hover:underline underline-offset-4 font-semibold transition-colors"
                  {...props}
                >
                  {children}
                </a>
              );
            }
          }}
        >
          {displayContent}
        </ReactMarkdown>
      </div>
      {!isCurrentlyStreaming && parsed.followUps.length > 0 && (
        <FollowUpQuestions 
          questions={parsed.followUps} 
          onSelect={onSelectFollowUp} 
        />
      )}
    </>
  );
}

// Streaming progress stages
const PROGRESS_STAGES = [
  { icon: Search, label: "Searching the web...", color: "text-blue-400" },
  { icon: Brain, label: "Analyzing sources...", color: "text-purple-400" },
  { icon: Zap, label: "Synthesizing answer...", color: "text-amber-400" },
  { icon: Sparkles, label: "Generating response...", color: "text-emerald-400" },
];

function StreamingProgress({ isActive }: { isActive: boolean }) {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setCurrentStage(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentStage(prev => (prev < PROGRESS_STAGES.length - 1 ? prev + 1 : prev));
    }, 2200);
    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div className="animate-fade-in-up mb-6">
      <div className="progress-bar mb-4 w-full max-w-md mx-auto" />
      <div className="flex flex-col gap-2.5 stagger-children">
        {PROGRESS_STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isCompleted = i < currentStage;
          const isCurrent = i === currentStage;
          return (
            <div 
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-500 animate-fade-in-up ${
                isCurrent ? `${stage.color} font-medium` :
                isCompleted ? 'text-muted-foreground/60 line-through' :
                'text-muted-foreground/30'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-500 ${
                isCurrent ? 'bg-primary/20 pulse-glow scale-110' :
                isCompleted ? 'bg-muted/50' :
                'bg-muted/20'
              }`}>
                {isCurrent ? (
                  <Icon size={13} className="animate-pulse" />
                ) : isCompleted ? (
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <Icon size={13} />
                )}
              </div>
              <span>{stage.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputQuery, setInputQuery] = useState("");
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingSources, setStreamingSources] = useState<SearchResult[]>([]);
    const [hasStartedStreaming, setHasStartedStreaming] = useState(false);

    // Modern UI search modifiers
    const [focusMode, setFocusMode] = useState<"all" | "writing" | "code" | "academic">("all");
    const [isFocusDropdownOpen, setIsFocusDropdownOpen] = useState(false);
    const [proMode, setProMode] = useState(false);
    const [webSearchEnabled, setWebSearchEnabled] = useState(true);
    
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();
    
    // Auto scroll to bottom
    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior
            });
        }
    };

    // Auto-scroll when messages update or streaming changes height
    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => {
            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 250;
            if (isStreaming || isNearBottom) {
                container.scrollTo({
                    top: container.scrollHeight,
                    behavior: isStreaming ? "auto" : "smooth"
                });
            }
        });

        // Observe the first child of the scrollable container (which contains the message list)
        const chatContent = container.firstElementChild;
        if (chatContent) {
            observer.observe(chatContent);
        }

        return () => {
            observer.disconnect();
        };
    }, [isStreaming]);

    // Smooth scroll to bottom when a new query is added (messages length changes)
    useEffect(() => {
        scrollToBottom("smooth");
    }, [messages.length]);

    useEffect(() => {
        async function getInfo() {
            const { data } = await supabase.auth.getUser();
            if(data.user) {
                setUser(data.user);
            } else {
                navigate("/Auth");
            }
        }
        getInfo();
    }, [navigate]);

    const getExistingConversations = async () => {
        if (!user) return;
        const {data: {session}} = await supabase.auth.getSession();
        if (!session) return;
        
        try {
            const response = await axios.get(`${BACKEND_URL}/conversations`, {
                headers: { Authorization: session.access_token }
            });
            setConversations(response.data.conversations || []);
        } catch (e) {
            console.error("Failed to load conversations", e);
        }
    };

    useEffect(() => {
        getExistingConversations();
    }, [user]);

    const loadConversation = async (id: string) => {
        const {data: {session}} = await supabase.auth.getSession();
        if (!session) return;
        
        try {
            const response = await axios.get(`${BACKEND_URL}/conversations/${id}`, {
                headers: { Authorization: session.access_token }
            });
            setMessages(response.data.conversation.message || []);
            setActiveConversation(id);
            setStreamingSources([]); // Reset sources on old thread load
        } catch (e) {
            console.error("Failed to load history", e);
        }
    };

    const handleNewThread = () => {
        setActiveConversation(null);
        setMessages([]);
        setInputQuery("");
        setStreamingSources([]);
    };

    const handleAsk = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!inputQuery.trim() || isStreaming) return;
        
        const query = inputQuery;
        const isFollowUp = !!activeConversation;
        
        // Optimistic UI update
        const userMsg: Message = { role: "User", content: query, id: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInputQuery("");
        setIsStreaming(true);
        setHasStartedStreaming(false);
        setStreamingSources([]);
        
        const { data: { session } } = await supabase.auth.getSession();
        const jwt = session?.access_token;
        
        let url = `${BACKEND_URL}/purplexity_ask`;
        let body: any = { query };
        
        if (isFollowUp) {
            url = `${BACKEND_URL}/purplextiy_ask/follow_up`;
            body = { query, conversationId: activeConversation };
        }
        
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": jwt || ""
                },
                body: JSON.stringify(body)
            });
            
            if (!response.body) throw new Error("No response body");
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            
            const assistantMsgId = Date.now() + 1;
            setMessages(prev => [...prev, { role: "Assistant", content: "", id: assistantMsgId }]);
            
            let assistantMsgContent = "";
            let sourcesData: SearchResult[] = [];
            let parsingState: "answer" | "sources" | "id" = "answer";
            let newConvId = "";
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                if (!hasStartedStreaming && chunk.length > 0) {
                    setHasStartedStreaming(true);
                }
                
                if (parsingState === "answer") {
                    const sourceSeparator = "\n-----------SOURCES-----------\n";
                    const sourceIdx = buffer.indexOf(sourceSeparator);
                    
                    if (sourceIdx !== -1) {
                        assistantMsgContent += buffer.substring(0, sourceIdx);
                        buffer = buffer.substring(sourceIdx + sourceSeparator.length);
                        parsingState = "sources";
                    } else {
                        // Extract complete answer part, leave end in buffer in case it's a partial separator
                        assistantMsgContent += chunk;
                        setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: assistantMsgContent } : m));
                    }
                }
                
                if (parsingState === "sources") {
                    const idSeparator = "\n-----------CONVERSATION_ID-----------\n";
                    const idIdx = buffer.indexOf(idSeparator);
                    
                    if (idIdx !== -1) {
                        const sourcesStr = buffer.substring(0, idIdx);
                        buffer = buffer.substring(idIdx + idSeparator.length);
                        parsingState = "id";
                        
                        const lines = sourcesStr.split('\n').filter(l => l.trim().startsWith('{'));
                        lines.forEach(l => {
                            try { sourcesData.push(JSON.parse(l)); } catch(e){}
                        });
                        setStreamingSources(sourcesData);
                    }
                }
                
                if (parsingState === "id") {
                    newConvId += buffer;
                }
            }
            
            // final refresh logic
            if (newConvId && !activeConversation) {
                const cleanId = newConvId.trim();
                setActiveConversation(cleanId);
                setTimeout(() => {
                    getExistingConversations();
                }, 500);
            }
            
        } catch (error) {
            console.error("Error asking perplexity", error);
        } finally {
            setIsStreaming(false);
            setHasStartedStreaming(false);
        }
    };

    if (!user) return (
        <div className="h-screen bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center pulse-glow">
                    <Loader2 className="animate-spin text-primary w-6 h-6" />
                </div>
                <span className="text-muted-foreground text-sm">Loading...</span>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
            {/* SIDEBAR */}
            <div className="w-64 flex-shrink-0 border-r border-white/[0.04] bg-[#09090b]/80 backdrop-blur-2xl flex flex-col z-10 transition-all">
                <div className="p-5 flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-tr from-primary via-chart-2 to-chart-3 rounded-xl flex items-center justify-center shadow-lg shadow-primary/10 animate-float relative overflow-hidden group">
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight bg-gradient-to-r from-white via-white to-gray-400 bg-clip-text text-transparent">Perplexity AI</span>
                        <span className="text-[9px] text-primary/80 font-bold tracking-widest uppercase">Intelligent Search</span>
                    </div>
                </div>
                
                <div className="px-4 pb-4">
                    <button 
                        onClick={handleNewThread}
                        className="w-full flex items-center justify-center gap-2 bg-white/[0.03] hover:bg-white/[0.07] text-white hover:text-white px-4 py-2.5 rounded-xl transition-all duration-300 text-sm font-semibold border border-white/[0.08] hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 active:scale-98 group shadow-sm"
                    >
                        <Plus size={15} className="group-hover:rotate-90 transition-transform duration-300 text-primary" /> New Thread
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 custom-scrollbar">
                    <h3 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.2em] mb-4 ml-1 flex items-center gap-2">
                        <History size={11} className="text-muted-foreground/50" />
                        History
                    </h3>
                    <div className="space-y-1">
                        {conversations.map(conv => (
                            <button
                                key={conv.id}
                                onClick={() => loadConversation(conv.id)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 transition-all duration-300 ${activeConversation === conv.id ? 'bg-primary/8 text-primary font-medium border border-primary/20 shadow-md shadow-primary/[0.02]' : 'hover:bg-white/[0.03] text-muted-foreground hover:text-foreground hover:translate-x-1 border border-transparent'}`}
                            >
                                <MessageSquare size={14} className={`flex-shrink-0 ${activeConversation === conv.id ? 'text-primary' : 'opacity-40'}`} />
                                <span className="truncate flex-1">{conv.title || "Untitled Conversation"}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-white/[0.04]">
                    <div className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] p-2.5 rounded-xl shadow-inner">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center text-xs font-bold text-white shadow-md shadow-primary/20 flex-shrink-0">
                                {user.email?.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-xs truncate font-semibold text-white/90">
                                {user.email?.split('@')[0]}
                            </div>
                        </div>
                        <button 
                            onClick={() => { supabase.auth.signOut(); setUser(null); }}
                            className="p-2 hover:bg-destructive/10 hover:text-destructive text-muted-foreground rounded-lg transition-all duration-200 active:scale-95"
                            title="Logout"
                        >
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col relative h-full w-full">
                {/* Subtle background gradient orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
                    <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-chart-2/5 rounded-full blur-3xl" />
                </div>

                {messages.length === 0 ? (
                    // EMPTY STATE
                    <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-3xl mx-auto w-full relative z-10">
                        {/* Animated Logo */}
                        <div className="mb-6 animate-float">
                            <div className="w-16 h-16 bg-gradient-to-br from-primary via-chart-2 to-chart-4 rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/30 pulse-glow">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                        </div>

                        <h1 className="text-4xl md:text-5xl font-bold mb-3 text-center gradient-text tracking-tight">
                            LLM Powered Search
                        </h1>
                        <p className="text-muted-foreground text-center mb-10 text-base">
                            Ask anything. Get intelligent, sourced answers instantly.
                        </p>
                        
                        <form onSubmit={handleAsk} className="w-full relative group">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-chart-2/15 to-chart-3/15 rounded-2xl blur-2xl transition-all opacity-0 group-focus-within:opacity-100 duration-500"></div>
                            <div className="relative flex flex-col bg-[#0f0f11]/60 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl focus-within:border-primary/40 focus-within:shadow-primary/5 transition-all duration-300 overflow-hidden">
                                <div className="flex items-center px-4 pt-3.5">
                                    <Search className="w-5 h-5 text-muted-foreground/60 mr-3 flex-shrink-0" />
                                    <input 
                                        type="text" 
                                        value={inputQuery}
                                        onChange={(e) => setInputQuery(e.target.value)}
                                        placeholder="Ask anything..." 
                                        className="flex-1 bg-transparent border-none outline-none text-base md:text-lg placeholder:text-muted-foreground/40 text-foreground py-2"
                                    />
                                </div>

                                {/* Search modifiers row */}
                                <div className="flex items-center justify-between px-3 py-3 mt-3 border-t border-white/[0.04] bg-white/[0.01]">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* Focus Button */}
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setIsFocusDropdownOpen(!isFocusDropdownOpen)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-muted-foreground hover:text-foreground rounded-lg text-xs font-semibold transition-all duration-200"
                                            >
                                                <Globe size={13} className="text-primary" />
                                                <span>Focus: <span className="text-foreground capitalize">{focusMode}</span></span>
                                                <ChevronDown size={12} className="opacity-60" />
                                            </button>
                                            {isFocusDropdownOpen && (
                                                <div className="absolute left-0 bottom-full mb-1.5 w-40 bg-[#0c0c0e] border border-white/[0.08] rounded-xl shadow-2xl p-1 z-30 animate-fade-in-up">
                                                    {(["all", "writing", "code", "academic"] as const).map((mode) => (
                                                        <button
                                                            key={mode}
                                                            type="button"
                                                            onClick={() => { setFocusMode(mode); setIsFocusDropdownOpen(false); }}
                                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${focusMode === mode ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'}`}
                                                        >
                                                            {mode}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Web Search Toggle */}
                                        <button
                                            type="button"
                                            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all duration-200 ${webSearchEnabled ? 'bg-primary/8 border-primary/20 text-primary' : 'bg-white/[0.02] border-white/[0.06] text-muted-foreground'}`}
                                        >
                                            <Globe size={13} />
                                            <span>Web Search</span>
                                        </button>

                                        {/* Pro Mode Toggle */}
                                        <button
                                            type="button"
                                            onClick={() => setProMode(!proMode)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-semibold transition-all duration-200 ${proMode ? 'bg-chart-2/8 border-chart-2/20 text-chart-2' : 'bg-white/[0.02] border-white/[0.06] text-muted-foreground'}`}
                                        >
                                            <Sparkles size={13} />
                                            <span>Pro Mode</span>
                                        </button>
                                    </div>

                                    {/* Submit Button */}
                                    <button 
                                        type="submit" 
                                        disabled={!inputQuery.trim() || isStreaming}
                                        className="p-2 bg-gradient-to-r from-primary to-chart-2 text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:scale-105 active:scale-95 shadow-md flex-shrink-0"
                                    >
                                        <Send size={15} />
                                    </button>
                                </div>
                            </div>
                        </form>
                        
                        {/* Interactive Suggestion Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 w-full stagger-children">
                            {[
                                {
                                    title: "Explain Science",
                                    text: "How does quantum entanglement work?",
                                    desc: "Understand physics concepts easily",
                                    icon: Brain,
                                    color: "text-purple-400 border-purple-500/10 hover:border-purple-500/30 bg-purple-500/2 hover:bg-purple-500/4"
                                },
                                {
                                    title: "Write & Code",
                                    text: "Write a fast search algorithm in TypeScript",
                                    desc: "Generate clean TypeScript algorithms",
                                    icon: Code,
                                    color: "text-amber-400 border-amber-500/10 hover:border-amber-500/30 bg-amber-500/2 hover:bg-amber-500/4"
                                },
                                {
                                    title: "Explore Concept",
                                    text: "What is Artificial General Intelligence?",
                                    desc: "Dive deep into AGI and the future of AI",
                                    icon: Sparkles,
                                    color: "text-emerald-400 border-emerald-500/10 hover:border-emerald-500/30 bg-emerald-500/2 hover:bg-emerald-500/4"
                                }
                            ].map((suggestion, i) => {
                                const Icon = suggestion.icon;
                                return (
                                    <button 
                                        key={i}
                                        onClick={() => { setInputQuery(suggestion.text); }}
                                        type="button"
                                        className={`flex flex-col text-left p-4 rounded-2xl border text-sm transition-all duration-300 hover:shadow-lg hover:translate-y-[-2px] card-hover group ${suggestion.color}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2.5">
                                            <div className="p-1.5 rounded-lg bg-white/5 group-hover:scale-110 transition-transform">
                                                <Icon size={14} className={suggestion.color.split(" ")[0]} />
                                            </div>
                                            <span className="font-semibold text-white/95">{suggestion.title}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground group-hover:text-white/80 transition-colors font-medium mb-1 line-clamp-1">{suggestion.text}</p>
                                        <span className="text-[10px] text-muted-foreground/60">{suggestion.desc}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* LinkedIn Footer */}
                        <div className="mt-16 flex items-center gap-2 text-muted-foreground/60 text-xs">
                            <span>Built by</span>
                            <a 
                                href="https://www.linkedin.com/in/himanshu-k-4522b2297/" 
                                target="_blank" 
                                rel="noreferrer"
                                className="flex items-center gap-1.5 text-primary/70 hover:text-primary transition-colors font-medium group"
                            >
                                <Linkedin size={13} className="group-hover:scale-110 transition-transform" />
                                Himanshu K
                            </a>
                        </div>
                    </div>
                ) : (
                    // CHAT STATE
                    <>
                        <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth pb-40 relative z-10 custom-scrollbar">
                            <div className="max-w-3xl mx-auto space-y-8">
                                {messages.map((msg, idx) => (
                                    <div key={msg.id || idx} className="flex flex-col animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                                        {msg.role === "User" ? (
                                            <div className="mb-2">
                                                <div className="text-2xl md:text-3xl font-semibold tracking-tight leading-tight gradient-text">
                                                    {msg.content}
                                                </div>
                                                <div className="h-px bg-gradient-to-r from-primary/30 via-chart-2/20 to-transparent mt-4" />
                                            </div>
                                        ) : (
                                            <div className="flex gap-4">
                                                <div className="mt-1 flex-shrink-0">
                                                    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br from-primary/25 to-chart-2/25 flex items-center justify-center border border-primary/20 ${
                                                        idx === messages.length - 1 && isStreaming ? 'pulse-glow' : ''
                                                    }`}>
                                                        {idx === messages.length - 1 && isStreaming ? (
                                                            <Loader2 size={13} className="animate-spin text-primary" />
                                                        ) : (
                                                            <Sparkles size={13} className="text-primary" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    {/* Progress indicator - show while waiting for content */}
                                                    {idx === messages.length - 1 && isStreaming && !hasStartedStreaming && (
                                                        <StreamingProgress isActive={true} />
                                                    )}
                                                    
                                                    {msg.content ? (
                                                        <AssistantContent 
                                                            content={msg.content}
                                                            isCurrentlyStreaming={idx === messages.length - 1 && isStreaming}
                                                            onSelectFollowUp={(q) => setInputQuery(q)}
                                                        />
                                                    ) : (
                                                        !hasStartedStreaming && (
                                                            <div className="flex items-center gap-3 py-2">
                                                                 <div className="dot-loading flex gap-1.5">
                                                                     <span /><span /><span />
                                                                 </div>
                                                                 <span className="text-muted-foreground text-sm">Thinking...</span>
                                                            </div>
                                                        )
                                                    )}
                                                    
                                                    {/* Sources */}
                                                    {idx === messages.length - 1 && streamingSources.length > 0 && !isStreaming && (
                                                        <div className="mt-6 pt-5 border-t border-white/[0.04] animate-fade-in-up">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center">
                                                                    <Globe size={12} className="text-primary" />
                                                                </div>
                                                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Sources</span>
                                                            </div>
                                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger-children">
                                                                {streamingSources.map((source, i) => (
                                                                    <a 
                                                                        key={i} 
                                                                        href={source.url} 
                                                                        target="_blank" 
                                                                        rel="noreferrer"
                                                                        className="flex flex-col justify-between p-2.5 bg-white/[0.02] backdrop-blur-md hover:bg-primary/5 rounded-xl text-xs transition-all duration-300 border border-white/[0.06] hover:border-primary/20 hover:shadow-lg hover:shadow-primary/[0.02] group card-hover animate-fade-in-up h-20 min-w-0"
                                                                    >
                                                                        <span className="text-muted-foreground group-hover:text-foreground font-medium transition-colors line-clamp-2 leading-snug break-all">{source.title || new URL(source.url).hostname}</span>
                                                                        <div className="flex items-center gap-1.5 w-full">
                                                                            <div className="w-4 h-4 rounded bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0">
                                                                                {i+1}
                                                                            </div>
                                                                            <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors truncate">{new URL(source.url).hostname}</span>
                                                                        </div>
                                                                    </a>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Sticky Input Area */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background via-background/95 to-transparent pt-16 z-20">
                            <div className="max-w-3xl mx-auto">
                                <form onSubmit={handleAsk} className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/15 via-chart-2/15 to-primary/15 rounded-2xl blur-lg opacity-0 focus-within:opacity-100 transition-opacity duration-500" />
                                    <div className="relative flex flex-col bg-[#0f0f11]/85 backdrop-blur-xl border border-white/[0.06] rounded-2xl shadow-2xl focus-within:border-primary/40 focus-within:shadow-primary/5 transition-all duration-300 overflow-hidden mx-2 md:mx-0">
                                        <div className="flex items-center px-4 pt-3">
                                            <input 
                                                type="text" 
                                                value={inputQuery}
                                                onChange={(e) => setInputQuery(e.target.value)}
                                                placeholder="Ask a follow-up..." 
                                                className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/40 text-foreground py-2"
                                            />
                                        </div>

                                        {/* Search modifiers row */}
                                        <div className="flex items-center justify-between px-3 py-2 mt-2 border-t border-white/[0.04] bg-white/[0.01]">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {/* Focus Button */}
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsFocusDropdownOpen(!isFocusDropdownOpen)}
                                                        className="flex items-center gap-1 px-2 py-1 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-muted-foreground hover:text-foreground rounded-lg text-[10px] font-semibold transition-all duration-200"
                                                    >
                                                        <Globe size={11} className="text-primary" />
                                                        <span>Focus: <span className="text-foreground capitalize">{focusMode}</span></span>
                                                        <ChevronDown size={10} className="opacity-60" />
                                                    </button>
                                                    {isFocusDropdownOpen && (
                                                        <div className="absolute left-0 bottom-full mb-1.5 w-36 bg-[#0c0c0e] border border-white/[0.08] rounded-xl shadow-2xl p-1 z-30 animate-fade-in-up">
                                                            {(["all", "writing", "code", "academic"] as const).map((mode) => (
                                                                <button
                                                                    key={mode}
                                                                    type="button"
                                                                    onClick={() => { setFocusMode(mode); setIsFocusDropdownOpen(false); }}
                                                                    className={`w-full text-left px-2 py-1 rounded-md text-[10px] capitalize transition-colors ${focusMode === mode ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'}`}
                                                                >
                                                                    {mode}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Web Search Toggle */}
                                                <button
                                                    type="button"
                                                    onClick={() => setWebSearchEnabled(!webSearchEnabled)}
                                                    className={`flex items-center gap-1 px-2 py-1 border rounded-lg text-[10px] font-semibold transition-all duration-200 ${webSearchEnabled ? 'bg-primary/8 border-primary/20 text-primary' : 'bg-white/[0.02] border-white/[0.06] text-muted-foreground'}`}
                                                >
                                                    <Globe size={11} />
                                                    <span>Web Search</span>
                                                </button>

                                                {/* Pro Mode Toggle */}
                                                <button
                                                    type="button"
                                                    onClick={() => setProMode(!proMode)}
                                                    className={`flex items-center gap-1 px-2 py-1 border rounded-lg text-[10px] font-semibold transition-all duration-200 ${proMode ? 'bg-chart-2/8 border-chart-2/20 text-chart-2' : 'bg-white/[0.02] border-white/[0.06] text-muted-foreground'}`}
                                                >
                                                    <Sparkles size={11} />
                                                    <span>Pro Mode</span>
                                                </button>
                                            </div>

                                            {/* Submit Button */}
                                            <button 
                                                type="submit" 
                                                disabled={!inputQuery.trim() || isStreaming}
                                                className="p-1.5 bg-gradient-to-r from-primary to-chart-2 text-white rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:scale-105 active:scale-95 shadow-md flex-shrink-0"
                                            >
                                                <Send size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </form>
                                {/* LinkedIn Footer */}
                                <div className="flex items-center justify-center gap-2 text-muted-foreground/50 text-[11px] mt-3">
                                    <span>Built by</span>
                                    <a 
                                        href="https://www.linkedin.com/in/himanshu-k-4522b2297/" 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="flex items-center gap-1 text-primary/60 hover:text-primary transition-colors font-medium"
                                    >
                                        <Linkedin size={11} />
                                        Himanshu K
                                    </a>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
