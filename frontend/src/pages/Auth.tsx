import { createClient } from "@/lib/supabase/client";
import { Sparkles, Linkedin } from "lucide-react";

const supabase = createClient();

export default function Auth() {

    async function login(provider: "google" | "github") {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider
        });

        if (error) {
            alert("Error while signing in: " + error.message);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 relative overflow-hidden">
            {/* Animated gradient background orbs */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[100px] animate-float" />
                <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-chart-2/8 rounded-full blur-[100px]" style={{ animationDelay: '1.5s', animation: 'float 4s ease-in-out infinite' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-chart-4/5 rounded-full blur-[80px]" style={{ animationDelay: '3s', animation: 'float 5s ease-in-out infinite' }} />
            </div>
            
            <div className="relative z-10 w-full max-w-md">
                {/* Logo / Branding */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary via-chart-2 to-chart-4 rounded-2xl mb-6 shadow-2xl shadow-primary/30 pulse-glow animate-float">
                        <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight gradient-text">
                        LLM Powered Search
                    </h1>
                    <p className="text-muted-foreground mt-2.5 text-sm">
                        AI-powered search that understands you
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-card/80 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl shadow-primary/5 relative overflow-hidden">
                    {/* Subtle gradient accent at top of card */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />
                    
                    <h2 className="text-lg font-semibold text-center mb-6 text-foreground">
                        Sign in to continue
                    </h2>
                    
                    <div className="space-y-3">
                        <button 
                            onClick={() => login("google")}
                            className="w-full flex items-center justify-center gap-3 bg-card hover:bg-muted text-foreground font-medium py-3.5 px-4 rounded-xl transition-all duration-300 border border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 card-hover group"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                            Continue with Google
                        </button>
                        
                        <button 
                            onClick={() => login("github")}
                            className="w-full flex items-center justify-center gap-3 bg-foreground hover:bg-foreground/90 text-background font-medium py-3.5 px-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-black/20 card-hover"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                            Continue with GitHub
                        </button>
                    </div>
                </div>

                <div className="text-center mt-8 space-y-3">
                    <p className="text-xs text-muted-foreground/50">
                        By continuing, you agree to our Terms of Service
                    </p>
                    <a 
                        href="https://www.linkedin.com/in/himanshu-k-4522b2297/" 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary/60 hover:text-primary transition-colors text-xs font-medium"
                    >
                        <Linkedin size={12} />
                        Built by Himanshu K     
                    </a>
                </div>
            </div>
        </div>
    );
}