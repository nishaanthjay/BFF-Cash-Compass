import { color, type ColorToken } from '../src/styles/tokens';

/** Every text/background (or UI/background) pair actually used in the app. */
export const PAIRS: { fg: ColorToken; bg: ColorToken; use: string; min: number }[] = [
  { fg: 'foreground', bg: 'background', use: 'Body text on cream page', min: 4.5 },
  { fg: 'foreground', bg: 'card', use: 'Body text on white card', min: 4.5 },
  { fg: 'foreground', bg: 'muted', use: 'Text on muted surface', min: 4.5 },
  { fg: 'mutedForeground', bg: 'background', use: 'Secondary text on cream', min: 4.5 },
  { fg: 'mutedForeground', bg: 'card', use: 'Secondary text on card', min: 4.5 },
  { fg: 'mutedStrong', bg: 'muted', use: 'Secondary text on muted surface', min: 4.5 },
  { fg: 'primaryForeground', bg: 'primary', use: 'White on primary button', min: 4.5 },
  { fg: 'primary', bg: 'card', use: 'Blue numbers/labels on card', min: 4.5 },
  { fg: 'primary', bg: 'background', use: 'Blue text on cream', min: 4.5 },
  { fg: 'primaryDeep', bg: 'background', use: 'Links on cream', min: 4.5 },
  { fg: 'tertiaryForeground', bg: 'tertiary', use: 'Dark text on gold', min: 4.5 },
  { fg: 'foreground', bg: 'tertiarySoft', use: 'Text on soft gold', min: 4.5 },
  { fg: 'foreground', bg: 'secondarySoft', use: 'Text on soft pink', min: 4.5 },
  { fg: 'foreground', bg: 'quaternarySoft', use: 'Text on soft mint', min: 4.5 },
  { fg: 'foreground', bg: 'primarySoft', use: 'Text on soft blue', min: 4.5 },
  { fg: 'foreground', bg: 'quaternary', use: 'Dark text on mint chip', min: 4.5 },
  { fg: 'foreground', bg: 'secondary', use: 'Dark text on pink chip', min: 4.5 },
  { fg: 'danger', bg: 'card', use: 'Error text on card', min: 4.5 },
  { fg: 'danger', bg: 'dangerSurface', use: 'Error text on error surface', min: 4.5 },
  { fg: 'danger', bg: 'background', use: 'Error text on cream', min: 4.5 },
  { fg: 'foreground', bg: 'card', use: 'UI: 2px borders vs card', min: 3 },
  { fg: 'ring', bg: 'background', use: 'UI: focus ring vs cream', min: 3 },
  { fg: 'mutedForeground', bg: 'card', use: 'UI: muted bar fill vs card', min: 3 },
  { fg: 'primary', bg: 'card', use: 'UI: bar fill vs card', min: 3 },
];

export { color };
