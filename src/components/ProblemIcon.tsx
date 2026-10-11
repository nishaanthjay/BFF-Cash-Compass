import { Backpack, BadgePercent, Bird, CalendarDays, Coins, CreditCard, Gem, Gift, Headphones, Hourglass, House, Landmark, Leaf, ListOrdered, PiggyBank, Rocket, Shirt, ShieldAlert, Smartphone, Sparkles, Sprout, Ticket, Timer, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { IconBadge } from './IconBadge';

type Tone = ComponentProps<typeof IconBadge>['tone'];

/** Lucide has no sneaker, so this is a small original one in the same style (stroke 2.5, round caps). */
export const Sneaker = (({ size = 24, strokeWidth = 2.5, ...rest }: { size?: number | string; strokeWidth?: number | string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
    <path d="M2 17.5V11l4 1.5L9 9l2.5 2.5c1.6.9 3.3 1.5 5.2 1.8 2.6.4 4.3 1.6 4.3 3.2V17.5z" />
    <path d="M2 17.5h20" />
    <path d="M9 9l1.2 1.6M11.6 11.4l1.2 1.5" />
  </svg>
)) as unknown as LucideIcon;

/** One picture per problem: what the problem is about, at a glance. */
const ICONS: Record<string, { icon: LucideIcon; tone: Tone }> = {
  S1: { icon: Shirt, tone: 'pink' },
  S2: { icon: Headphones, tone: 'soft' },
  S3: { icon: BadgePercent, tone: 'gold' },
  S4: { icon: Sneaker, tone: 'mint' },
  S5: { icon: PiggyBank, tone: 'pink' },
  S6: { icon: Gift, tone: 'gold' },
  S7: { icon: Timer, tone: 'soft' },
  S8: { icon: CalendarDays, tone: 'mint' },
  S9: { icon: Sprout, tone: 'mint' },
  S10: { icon: Landmark, tone: 'soft' },
  S11A: { icon: Trophy, tone: 'gold' },
  S11B: { icon: Hourglass, tone: 'gold' },
  S12: { icon: Backpack, tone: 'pink' },
  S13: { icon: Coins, tone: 'gold' },
  S14: { icon: CreditCard, tone: 'soft' },
  S15: { icon: Smartphone, tone: 'mint' },
  F1: { icon: House, tone: 'pink' },
  F2: { icon: Rocket, tone: 'soft' },
  F3: { icon: Gem, tone: 'mint' },
  F4: { icon: ShieldAlert, tone: 'pink' },
  F5: { icon: Sneaker, tone: 'gold' },
  F6: { icon: Leaf, tone: 'mint' },
  F7: { icon: Ticket, tone: 'gold' },
  F8: { icon: ListOrdered, tone: 'soft' },
  H1: { icon: Bird, tone: 'soft' },
  H2: { icon: TrendingUp, tone: 'gold' },
};

export function iconFor(problemId: string) {
  return ICONS[problemId] ?? { icon: Sparkles, tone: 'gold' as Tone };
}

/** The problem's picture, always inside a coloured circle (DESIGN.md). Decorative: the title is next to it. */
export function ProblemIcon({ id, size = 'md', className }: { id: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { icon, tone } = iconFor(id);
  return <IconBadge icon={icon} tone={tone} size={size} className={className} />;
}
