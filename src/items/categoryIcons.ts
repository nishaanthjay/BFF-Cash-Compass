import { Briefcase, CreditCard, PiggyBank, Scale, ShieldCheck, TrendingUp, type LucideIcon } from 'lucide-react';
import type { DecaCategory } from './types';

/** UI mapping only; item content never references icons. */
export const CATEGORY_ICON: Record<DecaCategory, LucideIcon> = {
  spending_saving: PiggyBank,
  credit_debt: CreditCard,
  employment_income: Briefcase,
  investing: TrendingUp,
  risk_insurance: ShieldCheck,
  decision_making: Scale,
};

export const CATEGORY_TONE: Record<DecaCategory, 'gold' | 'pink' | 'mint' | 'soft'> = {
  spending_saving: 'mint',
  credit_debt: 'pink',
  employment_income: 'soft',
  investing: 'gold',
  risk_insurance: 'soft',
  decision_making: 'gold',
};
