import type { Scenario } from '../../items/types';
import { formatUnit } from '../../lib/format';
import s from './Scenario.module.css';

const SOURCE = { post: 'posted', chat: 'said in a chat', message: 'sent a message', speech: 'says' } as const;

/**
 * The problem's context card. Shows only the scenario and the student's OWN earlier
 * entries (e.g. receipt lines they typed). Never a correct value.
 */
export function ScenarioCard({ scenario, own, activeStep }: { scenario: Scenario; own: Record<string, number | null>; activeStep: string }) {
  switch (scenario.layout) {
    case 'priceTag':
      return (
        <div className={s.tag}>
          <div className={s.tagShape}>
            <span className={s.hole} aria-hidden />
            <span className={s.tagItem}>{scenario.item}</span>
            <span className={s.tagPrice}>{formatUnit(scenario.price, 'usd')}</span>
          </div>
          {scenario.badges.map((b) => (
            <span key={b} className={s.badge}>
              {b}
            </span>
          ))}
        </div>
      );
    case 'receipt':
      return (
        <div className={s.receipt} role="table" aria-label="Receipt">
          <div className={`eyebrow ${s.receiptTitle}`}>{scenario.title}</div>
          {scenario.lines.map((l) => {
            const v = l.value ?? (l.fromStep ? own[l.fromStep] : null);
            return (
              <div key={l.label} className={s.line} role="row" data-active={l.fromStep === activeStep}>
                <span role="cell">{l.label}</span>
                <span role="cell" className={v === null || v === undefined ? s.blank : undefined}>
                  {v === null || v === undefined ? '______' : formatUnit(v, 'usd')}
                </span>
              </div>
            );
          })}
        </div>
      );
    case 'situation':
      return (
        <div className={s.situation}>
          <p className={s.situationText}>{scenario.text}</p>
          {scenario.facts && (
            <dl className={s.facts}>
              {scenario.facts.map((f) => (
                <div key={f.label} style={{ display: 'contents' }}>
                  <dt>{f.label}</dt>
                  <dd style={{ margin: 0 }}>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      );
    case 'jars':
      return (
        <div className={s.situation}>
          <p className={s.situationText}>{scenario.text}</p>
          <div className={s.jars}>
            {scenario.labels.map((l, i) => {
              const from = scenario.fromSteps[i];
              const v = from ? own[from] : null;
              return (
                <div key={l} className={s.jarCard} data-active={from === activeStep}>
                  <span className="eyebrow">{l}</span>
                  <svg viewBox="0 0 60 70" className={s.jarSvg} aria-hidden>
                    <path d="M12 6 L12 54 Q12 64 22 64 L38 64 Q48 64 48 54 L48 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  <span className={v === null || v === undefined ? s.blank : s.jarValue}>{v === null || v === undefined ? (from ? '______' : '') : formatUnit(v, 'usd')}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    case 'claim':
      return (
        <figure className={s.claim} style={{ margin: 0 }}>
          <figcaption className={s.who}>
            <span className={s.avatar} aria-hidden />
            {scenario.who} {SOURCE[scenario.source]}:
          </figcaption>
          <blockquote className={s.bubble} style={{ margin: 0 }}>
            “{scenario.claim}”
          </blockquote>
          {scenario.facts && (
            <dl className={s.facts}>
              {scenario.facts.map((f) => (
                <div key={f.label} style={{ display: 'contents' }}>
                  <dt>{f.label}</dt>
                  <dd style={{ margin: 0 }}>{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </figure>
      );
  }
}
