import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StudentShell } from '../components/StudentShell';
import { Screen } from '../components/Screen';
import { getItems } from '../items';
import { ItemView } from '../screens/student/ItemView';
import { RevealView } from '../screens/student/RevealView';

/** Design-review routes for the two signature screens (demo data only). */
export function ItemPreview() {
  const [params] = useSearchParams();
  const items = getItems();
  const [i, setI] = useState(Number(params.get('i') ?? 0));
  return (
    <StudentShell chapter="TX014" sessionLabel="Post">
      <Screen>
        <ItemView item={items[i % items.length]} index={i % items.length} total={items.length} onSubmit={() => setI((n) => n + 1)} />
      </Screen>
    </StudentShell>
  );
}

export function RevealPreview() {
  const [params] = useSearchParams();
  const items = getItems();
  const guesses = (params.get('g') ?? '1200,900,1100').split(',').map(Number);
  const [i, setI] = useState(Number(params.get('i') ?? 0));
  const idx = i % items.length;
  return (
    <StudentShell chapter="TX014" decor="reveal">
      <Screen width="wide" key={idx}>
        <RevealView item={items[idx]} guess={guesses[idx] ?? 100} index={idx} total={items.length} onNext={() => setI((n) => n + 1)} />
      </Screen>
    </StudentShell>
  );
}
