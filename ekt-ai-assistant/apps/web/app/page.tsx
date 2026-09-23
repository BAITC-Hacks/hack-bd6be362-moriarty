import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Box,
  CircuitBoard,
  FileSpreadsheet,
  Layers3,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { DEMO_MODE } from "@/lib/api";
export default function Page() {
  return (
    <main className="site-shell">
      <header className="site-header">
        <a className="brand" href="/" aria-label="EKT басты бет">
          <span className="brand-symbol">
            <Zap size={25} fill="currentColor" />
          </span>
          <b>
            ekt<span>.</span>
          </b>
          <span className="brand-divider" />
          <span className="brand-descriptor">
            ЭЛЕКТРОТЕХНИКА
            <br />
            ЖӘНЕ ШЕШІМДЕР
          </span>
        </a>
        <nav>
          <a href="#possibilities">Мүмкіндіктер</a>
          <a href="#how-it-works">Қалай жұмыс істейді</a>
          <span className="project-badge">
            HACKALEM <b>AI</b>
          </span>
        </nav>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="small-dot" /> ЭЛЕКТРОТЕХНИКА. ЕНДІ ОҢАЙЫРАҚ.
          </span>
          <h1>
            Дұрыс тауар.
            <br />
            Нақты жауап.
            <br />
            <span>Бір диалогта.</span>
          </h1>
          <p>
            Тауар іздеуден спецификация есебіне дейін —
            <br className="desktop-break" /> EKT AI көмекшісімен бірге.
          </p>
          <a className="hero-link" href="#how-it-works">
            Көмекшімен танысу <ArrowDownRight size={20} />
          </a>
          <div className="hero-assurance">
            <ShieldCheck size={18} />
            <span>Корзинаға қосу — тек сіздің растауыңызбен</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="AI көмекшісінің мүмкіндіктері">
          <div className="visual-grid" />
          <div className="visual-topline">
            <span>INTELLIGENT ASSISTANCE</span>
            <span>01 / EKT</span>
          </div>
          <div className="circuit-orbit orbit-outer" />
          <div className="circuit-orbit orbit-inner" />
          <div className="core">
            <CircuitBoard size={82} strokeWidth={1} />
            <span>
              EKT <b>AI</b>
            </span>
          </div>
          <div className="float-card float-one">
            <Box size={23} />
            <div>
              <small>КАТАЛОГ</small>
              <b>Іздеу және таңдау</b>
            </div>
            <ArrowUpRight size={16} />
          </div>
          <div className="float-card float-two">
            <Layers3 size={23} />
            <div>
              <small>БАЛАМА ШЕШІМДЕР</small>
              <b>Түсінікті салыстыру</b>
            </div>
          </div>
          <div className="float-card float-three">
            <FileSpreadsheet size={23} />
            <div>
              <small>СПЕЦИФИКАЦИЯ</small>
              <b>Бір файл. Толық тізім.</b>
            </div>
          </div>
          <div className="visual-bottom">
            <Sparkles size={15} />
            <span>Сұраңыз. Салыстырыңыз. Таңдаңыз.</span>
          </div>
        </div>
      </section>
      <section className="capabilities" id="possibilities">
        <div className="section-heading">
          <span className="eyebrow">СІЗДІҢ МІНДЕТІҢІЗГЕ АРНАЛҒАН</span>
          <h2>Сатып алудың әр қадамында.</h2>
        </div>
        <div className="capability-grid">
          {[
            {
              icon: Box,
              index: "01",
              title: "Тауар туралы бәрі",
              text: "Сипаттамалар, қолжетімді сертификаттар және қоймадағы қалдық.",
            },
            {
              icon: Layers3,
              index: "02",
              title: "Саналы таңдау",
              text: "Ұсынылған аналогтардың ұқсастықтары мен айырмашылықтары.",
            },
            {
              icon: FileSpreadsheet,
              index: "03",
              title: "Тізімнен есепке",
              text: "Excel, PDF немесе фотосуретті жүктеп, спецификация есебін алыңыз.",
            },
          ].map((item) => (
            <article key={item.index}>
              <div>
                <item.icon size={25} strokeWidth={1.6} />
                <span>{item.index}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="how-it-works" className="how-it-works">
        <BadgeCheck size={28} />
        <div>
          <h2>Сұрағыңыздан бастаңыз.</h2>
          <p>
            Төмендегі «AI консультант» батырмасын басыңыз. Қазақша немесе орысша
            жазыңыз.
          </p>
        </div>
        <ArrowDownRight size={30} />
      </section>
      <footer className="site-footer">
        <span>© HACKALEM AI · Hackathon frontend</span>
        <span>
          {DEMO_MODE
            ? "Demo · Үлгі деректер / пример данных"
            : "Қолданба backend-іне қосылатын интерфейс"}
        </span>
      </footer>
      <ChatLauncher />
    </main>
  );
}
