import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BadgeCheck,
  CheckCircle2,
  Eye,
  Facebook,
  Handshake,
  Instagram,
  Lock,
  MessageSquare,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Wallet,
} from 'lucide-react';

import { FACEBOOK_URL, INSTAGRAM_URL } from '@/shared/config/social';

import '../styles/landing.css';
import { Reveal, RevealGroup, RevealItem } from './Reveal';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Tu pago, bajo resguardo',
    text: 'El dinero no se libera a ciegas: queda protegida hasta que la entrega queda confirmada. Menos miedo, más control.',
  },
  {
    icon: BadgeCheck,
    title: 'El Agente, visible',
    text: 'Elegís a quién confiarle el producto con perfil, historial y reputación a la vista — no a alguien anónimo por un chat.',
  },
  {
    icon: MessageSquare,
    title: 'Todo el mundo en la misma conversación',
    text: 'Comprador, vendedor y Agente comparten un mismo hilo. Lo acordado queda registrado, no perdido en WhatsApp.',
  },
  {
    icon: Wallet,
    title: 'Sabés qué pasa con tu dinero',
    text: 'Estados claros del pago y de la operación. Entendés el momento sin tener que adivinar ni insistir.',
  },
] as const;

const STEPS = [
  {
    icon: Search,
    label: 'Abrís una operación',
    feeling: 'Dejás de improvisar: el acuerdo tiene un lugar.',
  },
  {
    icon: MessageSquare,
    label: 'Acordás con el Agente',
    feeling: 'Cercanía y claridad: cómo, cuándo y dónde se entrega.',
  },
  {
    icon: Lock,
    label: 'Pagás con protección',
    feeling: 'Tranquilidad: el dinero espera a que el producto llegue.',
  },
  {
    icon: CheckCircle2,
    label: 'Entrega confirmada y cierre',
    feeling: 'Alivio: se libera el pago y podés calificar.',
  },
] as const;

const ROLES = [
  {
    icon: ShoppingBag,
    title: 'Comprador',
    text: 'Querés recibir lo que pagaste, sin quedar expuesto.',
    points: [
      'Seguís la operación sin depender solo de un mensaje suelto.',
      'El pago se libera cuando la entrega está confirmada.',
    ],
  },
  {
    icon: Package,
    title: 'Vendedor',
    text: 'Querés entregar y cobrar con la cabeza en paz.',
    points: [
      'Un Agente lleva el producto hasta el comprador.',
      'No entregás a cambio de una promesa vacía.',
    ],
  },
  {
    icon: Handshake,
    title: 'Agente',
    text: 'Sos el puente de confianza entre ambas partes.',
    points: [
      'Tu rol es claro: mediar la entrega con transparencia.',
      'Construís reputación con cada operación bien hecha.',
    ],
  },
] as const;

const SIMPLICITY = [
  {
    icon: Eye,
    title: 'Una operación, un hilo',
    text: 'Todo lo importante vive en un solo lugar: estados, chat y avance.',
  },
  {
    icon: ShieldCheck,
    title: 'Estados que se entienden',
    text: 'Sabés en qué momento está el producto y el pago, sin tecnicismos.',
  },
  {
    icon: MessageSquare,
    title: 'Menos incertidumbre',
    text: 'Lo crítico no queda solo en un chat externo: queda en ConfiApp.',
  },
] as const;

const FAQS = [
  {
    q: '¿Qué es un Agente en ConfiApp?',
    a: 'Es la persona que media la entrega: lleva el producto del vendedor al comprador. En ConfiApp, “Agente” es ese rol de confianza — no un intermediario anónimo.',
  },
  {
    q: '¿Cuándo se libera el pago?',
    a: 'Cuando la entrega queda confirmada en la operación. La idea es simple: el dinero acompaña la confianza del proceso, no la apura.',
  },
  {
    q: '¿Qué pasa si hay un problema?',
    a: 'El historial de la operación, el chat y las evidencias quedan registrados para que el conflicto no dependa de la memoria de nadie.',
  },
  {
    q: '¿Crear cuenta es gratis?',
    a: 'Sí. Podés registrarte sin costo y empezar a explorar el flujo como comprador, vendedor o Agente.',
  },
  {
    q: '¿Ya hay muchos usuarios?',
    a: 'ConfiApp está en etapa de lanzamiento. Preferimos ser honestos: sin números inflados. Tu primer uso y tu feedback construyen el producto.',
  },
] as const;

const HERO_EASE = [0.22, 1, 0.36, 1] as const;

function BrandMark() {
  return (
    <>
      <img
        className="ca-landing__brand-logo"
        src="/landing/ConfiApp-logo.png"
        alt=""
        width={36}
        height={36}
        decoding="async"
      />
      <span className="ca-landing__brand-name">
        <span className="ca-landing__brand-name--dark">Confi</span>
        <span className="ca-landing__brand-name--light">App</span>
      </span>
    </>
  );
}

function SectionIntro({
  title,
  lead,
  titleClassName,
  leadClassName,
}: {
  title: string;
  lead: string;
  titleClassName?: string;
  leadClassName?: string;
}) {
  return (
    <Reveal>
      <h2 className={titleClassName ?? 'ca-landing__section-title'}>{title}</h2>
      <p className={leadClassName ?? 'ca-landing__section-lead'}>{lead}</p>
    </Reveal>
  );
}

/** Landing pública de ConfiApp — lanzamiento honesto y didáctico. */
export function LandingPage() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="ca-landing">
      <header className="ca-landing__nav">
        <a href="#inicio" className="ca-landing__brand">
          <BrandMark />
        </a>

        <ul className="ca-landing__nav-links">
          <li>
            <a href="#por-que">Te cuidamos</a>
          </li>
          <li>
            <a href="#como-funciona">Así funciona</a>
          </li>
          <li>
            <a href="#para-quien">Tres roles</a>
          </li>
          <li>
            <a href="#preguntas">Preguntas frecuentes</a>
          </li>
        </ul>

        <div className="ca-landing__nav-actions">
          <Link className="ca-landing__btn ca-landing__btn--ghost" to="/ingresar">
            Ingresar
          </Link>
          <Link className="ca-landing__btn ca-landing__btn--teal" to="/registro">
            Crear cuenta
          </Link>
        </div>
      </header>

      <section className="ca-landing__hero" id="inicio">
        <motion.div
          className="ca-landing__hero-copy"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: HERO_EASE }}
        >
          <h1>Confianza que conecta, tecnología que protege.</h1>
          <p className="ca-landing__hero-lead">
            Comprá o vendé sin que el miedo a la estafa te frene: un Agente lleva el producto de una
            punta a la otra, y el pago se libera cuando la entrega está confirmada.
          </p>
          <div className="ca-landing__hero-cta">
            <Link className="ca-landing__btn ca-landing__btn--navy" to="/registro">
              Crear mi cuenta
            </Link>
            <Link
              className="ca-landing__btn ca-landing__btn--outline"
              to="/ingresar?next=%2Fagente"
            >
              Quiero ser Agente
            </Link>
          </div>
          <div className="ca-landing__trust-row">
            <span className="ca-landing__trust-item">
              <ShieldCheck size={18} /> Pago protegido hasta la entrega
            </span>
            <span className="ca-landing__trust-item">
              <BadgeCheck size={18} /> Agentes con historial visible
            </span>
            <span className="ca-landing__trust-item">
              <MessageSquare size={18} /> Todo en un mismo hilo
            </span>
          </div>
        </motion.div>

        <motion.div
          className="ca-landing__hero-visual"
          initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.12, ease: HERO_EASE }}
        >
          <img
            className="ca-landing__hero-img"
            src="/landing/Shopping2.png"
            alt="Compra y venta segura con ConfiApp"
            width={512}
            height={512}
            fetchPriority="high"
          />
        </motion.div>
      </section>

      <section className="ca-landing__section" id="problema">
        <div className="ca-landing__section-inner">
          <SectionIntro
            title="Cuando la entrega depende solo de la buena fe, el miedo gana"
            lead="La confianza no debería ser un salto al vacío. Estos son los miedos que ConfiApp aborda de raíz."
          />
          <RevealGroup className="ca-landing__pains" stagger={0.12}>
            <RevealItem className="ca-landing__pain">
              <h3>Pagué y no recibí</h3>
              <p>El dinero salió… y el producto nunca apareció.</p>
            </RevealItem>
            <RevealItem className="ca-landing__pain">
              <h3>Entregué y no cobré</h3>
              <p>Soltaste el producto por una promesa. Después, silencio.</p>
            </RevealItem>
            <RevealItem className="ca-landing__pain">
              <h3>No sé a quién confiarle el envío</h3>
              <p>
                Entre el vendedor y el comprador hace falta alguien — pero ¿quién garantiza el
                proceso?
              </p>
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      <section className="ca-landing__section" id="por-que" style={{ paddingTop: 0 }}>
        <div className="ca-landing__section-inner">
          <SectionIntro
            title="Cómo ConfiApp te cuida en cada paso"
            lead="No prometemos magia: diseñamos un recorrido donde la tranquilidad se construye con claridad."
          />
          <RevealGroup className="ca-landing__features" stagger={0.1}>
            {FEATURES.map((feature) => (
              <RevealItem key={feature.title} className="ca-landing__feature">
                <div className="ca-landing__feature-icon">
                  <feature.icon size={22} strokeWidth={1.75} />
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="ca-landing__section" id="como-funciona" style={{ paddingTop: 0 }}>
        <div className="ca-landing__section-inner">
          <SectionIntro
            title="Así de simple funciona"
            lead="Cuatro momentos. En cada uno sabés qué pasa — y cómo te sentís más seguro."
          />
          <RevealGroup className="ca-landing__steps" stagger={0.1}>
            {STEPS.map((step, index) => (
              <RevealItem key={step.label} className="ca-landing__step">
                <div className="ca-landing__step-num">{index + 1}</div>
                <div className="ca-landing__step-icon">
                  <step.icon size={28} strokeWidth={1.75} />
                </div>
                <p className="ca-landing__step-label">{step.label}</p>
                <p className="ca-landing__step-feeling">{step.feeling}</p>
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal className="ca-landing__flow" delay={0.08} y={36}>
            <figure>
              <img
                src="/landing/flow-agents.png"
                alt="Flujo: vendedor, Agente y comprador en una entrega protegida"
                width={1920}
                height={1080}
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                Vendedor → Agente → Comprador. El Agente es el puente de confianza.
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      <section className="ca-landing__roles" id="para-quien">
        <div className="ca-landing__section-inner">
          <SectionIntro
            title="Tres roles. Un mismo acuerdo."
            lead="Sea cual sea tu lugar en la operación, ConfiApp te da un marco claro."
            titleClassName="ca-landing__section-title ca-landing__section-title--on-dark"
            leadClassName="ca-landing__section-lead ca-landing__section-lead--on-dark"
          />
          <RevealGroup className="ca-landing__roles-grid" stagger={0.12}>
            {ROLES.map((role) => (
              <RevealItem key={role.title} className="ca-landing__role">
                <div className="ca-landing__role-icon">
                  <role.icon size={26} strokeWidth={1.75} />
                </div>
                <h3>{role.title}</h3>
                <p className="ca-landing__role-lead">{role.text}</p>
                <ul>
                  {role.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="ca-landing__section" id="simple">
        <div className="ca-landing__section-inner">
          <SectionIntro
            title="Hecha para entenderse a la primera"
            lead="La mejor protección es la que no te obliga a ser experto. Intuitiva, legible, operativa."
          />
          <RevealGroup className="ca-landing__simple-grid" stagger={0.1}>
            {SIMPLICITY.map((item) => (
              <RevealItem key={item.title} className="ca-landing__simple">
                <item.icon size={22} strokeWidth={1.75} />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className="ca-landing__section" id="preguntas" style={{ paddingTop: 0 }}>
        <div className="ca-landing__section-inner ca-landing__section-inner--narrow">
          <SectionIntro
            title="Preguntas frecuentes"
            lead="Respuestas directas. Sin humo."
          />
          <RevealGroup className="ca-landing__faq" stagger={0.08}>
            {FAQS.map((item) => (
              <RevealItem key={item.q}>
                <details className="ca-landing__faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <div className="ca-landing__cta-wrap">
        <Reveal className="ca-landing__cta" y={32}>
          <div>
            <h2>Empezá con una operación protegida</h2>
            <p>
              Creá tu cuenta y probá el recorrido: comprador, vendedor o Agente. Estamos lanzando —
              tu experiencia cuenta.
            </p>
            <div className="ca-landing__cta-actions">
              <Link className="ca-landing__btn ca-landing__btn--light-teal" to="/registro">
                Crear cuenta gratis
              </Link>
              <Link
                className="ca-landing__btn ca-landing__btn--outline-light"
                to="/ingresar?next=%2Fagente"
              >
                Quiero ser Agente
              </Link>
            </div>
          </div>
          <div className="ca-landing__cta-visual">
            <img
              className="ca-landing__cta-img"
              src="/landing/cta-lifestyle.png"
              alt="Personas coordinando una entrega con confianza"
              width={1200}
              height={900}
              loading="lazy"
              decoding="async"
            />
            <div className="ca-landing__float ca-landing__float--pay">
              <Lock size={16} /> Pago protegido
            </div>
          </div>
        </Reveal>
      </div>

      <footer className="ca-landing__footer">
        <Reveal>
          <div className="ca-landing__footer-grid">
            <div>
              <div className="ca-landing__brand">
                <BrandMark />
              </div>
              <p>
                ConfiApp conecta compradores y vendedores con Agentes que llevan el producto, con pago
                protegido hasta la entrega.
              </p>
            </div>
            <div>
              <h4>Producto</h4>
              <ul>
                <li>
                  <a href="#por-que">Te cuidamos</a>
                </li>
                <li>
                  <a href="#como-funciona">Así funciona</a>
                </li>
                <li>
                  <a href="#para-quien">Tres roles</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Empezar</h4>
              <ul>
                <li>
                  <a href="#preguntas">Preguntas frecuentes</a>
                </li>
                <li>
                  <Link to="/ingresar">Ingresar</Link>
                </li>
                <li>
                  <Link to="/registro">Crear cuenta</Link>
                </li>
                <li>
                  <Link to="/terminos">Términos y Condiciones</Link>
                </li>
                <li>
                  <Link to="/privacidad">Privacidad</Link>
                </li>
                <li>
                  <Link to="/ayuda">Ayuda</Link>
                </li>
              </ul>
            </div>
            <div>
              <h4>Agentes</h4>
              <ul>
                <li>
                  <Link to="/ingresar?next=%2Fagente">Sumarme como Agente</Link>
                </li>
              </ul>
            </div>
            <div className="ca-landing__footer-social">
              <h4>Seguinos</h4>
              <p className="ca-landing__footer-social-lead">
                Novedades, tips y el día a día de ConfiApp. Sumate a la comunidad y enterate
                primero de los lanzamientos.
              </p>
              <nav className="ca-landing__social" aria-label="Redes sociales">
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram de ConfiApp"
                >
                  <Instagram size={18} strokeWidth={1.75} aria-hidden />
                </a>
                {FACEBOOK_URL ? (
                  <a
                    href={FACEBOOK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Facebook de ConfiApp"
                  >
                    <Facebook size={18} strokeWidth={1.75} aria-hidden />
                  </a>
                ) : (
                  <span
                    className="ca-landing__social-pending"
                    title="Facebook próximamente"
                    aria-label="Facebook de ConfiApp (próximamente)"
                  >
                    <Facebook size={18} strokeWidth={1.75} aria-hidden />
                  </span>
                )}
              </nav>
            </div>
          </div>
          <p className="ca-landing__copy">
            © {new Date().getFullYear()} ConfiApp. En lanzamiento — con honestidad y foco en la
            confianza.
          </p>
        </Reveal>
      </footer>
    </div>
  );
}
