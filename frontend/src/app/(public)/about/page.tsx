import type { Metadata } from "next";
import { Users, Target, Zap, Award, Mic2, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us | SpeakArena",
  description: "The mission and story behind SpeakArena — where English fluency meets cutting-edge live learning.",
};

const STATS = [
  { value: "50,000+", label: "Active Learners" },
  { value: "4.9 / 5", label: "Average Rating" },
  { value: "60+", label: "Countries" },
  { value: "98%", label: "Satisfaction Rate" },
];

const VALUES = [
  { icon: Target, title: "Outcome-First", desc: "Every lesson is designed around measurable real-world improvements — accents, fluency scores, and confidence.", color: "#3b82f6" },
  { icon: Users, title: "Community-Driven", desc: "Cohort-based sessions and peer practice groups keep you accountable and socially engaged.", color: "#10b981" },
  { icon: Zap, title: "Live & Interactive", desc: "Google Meet powered sessions with real instructors. Not pre-recorded. Not bots. Real human coaching.", color: "#f59e0b" },
  { icon: Award, title: "Certification", desc: "Verifiable certificates recognized by top companies, linked directly to your LinkedIn profile.", color: "#818cf8" },
];

const TEAM = [
  { name: "Dr. Eleanor Chen", role: "Head of Curriculum · Edinburgh M.A.", initials: "EC", color: "#4f46e5" },
  { name: "James Okafor", role: "Product Lead · Ex-Coursera", initials: "JO", color: "#059669" },
  { name: "Priya Sharma", role: "Head of Engineering · IIT Delhi", initials: "PS", color: "#d97706" },
  { name: "Lucas Mendes", role: "Head of Partnerships", initials: "LM", color: "#dc2626" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="glow-indigo absolute" style={{ width: 400, height: 400, top: -100, left: "50%", transform: "translateX(-50%)" }} />
        <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />

        <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 text-center max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
            <Mic2 className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Our Story</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-foreground tracking-tight leading-tight mb-6">
            Built for people who <br />
            <span className="text-primary">mean it.</span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-12">
            SpeakArena was founded on one belief: that language fluency is a life-changing skill that deserves the same rigor and interactivity as any elite professional program.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 justify-center">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-black text-foreground tracking-tight leading-none">{s.value}</div>
                <div className="text-sm text-muted-foreground font-medium mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mission ───────────────────────────────────────────── */}
      <section className="bg-card border-y border-border py-24">
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 lg:gap-20 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                <span className="text-xs font-bold text-primary uppercase tracking-widest">Our Mission</span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight leading-tight mb-6">
                Premium English education. For everyone.
              </h2>
              <div className="flex flex-col gap-4">
                <p className="text-base text-muted-foreground leading-relaxed">
                  We believe that premium language education should be accessible, interactive, and beautifully designed. SpeakArena bridges the gap between passive self-study and expensive private tutors.
                </p>
                <p className="text-base text-muted-foreground leading-relaxed">
                  Through real-time Google Meet sessions, structured cohort programs, and expert certified coaches, we create a classroom experience that transcends physical limits.
                </p>
              </div>
              <Link href="/register" className="btn-primary mt-8 inline-flex press-scale">
                Join SpeakArena <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </div>

            {/* Visual block */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {VALUES.map(v => (
                <div key={v.title} className="card-glass p-6 hover-lift">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${v.color}18` }}>
                    <v.icon className="w-5 h-5" style={{ color: v.color }} />
                  </div>
                  <h4 className="text-base font-bold text-foreground mb-2">{v.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Team ──────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-4">
              Meet the team
            </h2>
            <p className="text-base text-muted-foreground max-w-2xl mx-auto">
              Educators, engineers, and linguists who are obsessed with transforming how English is taught.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
            {TEAM.map(m => (
              <div key={m.name} className="card-glass p-8 text-center hover-lift">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-extrabold text-white mx-auto mb-4" style={{ background: m.color, boxShadow: `0 0 24px ${m.color}40` }}>
                  {m.initials}
                </div>
                <div className="text-base font-bold text-foreground mb-1">{m.name}</div>
                <div className="text-sm text-muted-foreground">{m.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="bg-card border-t border-border py-24">
        <div className="w-full px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight mb-4">
            Ready to speak with confidence?
          </h2>
          <p className="text-base text-muted-foreground mb-10">Join 50,000+ learners transforming their English today.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary press-scale">
              Get started free <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
            <Link href="/#courses" className="btn-ghost press-scale">
              View courses
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
