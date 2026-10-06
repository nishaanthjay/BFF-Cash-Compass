import { useState, type FormEvent, type ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import { api } from '../../api';
import { ApiError } from '../../api/types';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FieldError } from '../../components/FieldError';
import { IconBadge } from '../../components/IconBadge';
import { Input } from '../../components/Input';
import { Screen } from '../../components/Screen';
import { StaffShell } from '../../components/StaffShell';
import { clearPasscode, getPasscode, setPasscode } from '../../lib/passcode';
import s from './PasscodeGate.module.css';

/** Single shared passcode for facilitator + analysis. No accounts, no roles. */
export function PasscodeGate({ children }: { children: (passcode: string, lock: () => void) => ReactNode }) {
  const [pass, setPass] = useState<string | null>(getPasscode);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lock = () => {
    clearPasscode();
    setPass(null);
  };

  if (pass) return <>{children(pass, lock)}</>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (await api.verifyPasscode(input)) {
        setPasscode(input);
        setPass(input);
      } else setError('That passcode didn’t work.');
    } catch (err) {
      setError(err instanceof ApiError && err.code === 'network' ? 'Can’t reach the server. Check the connection.' : 'That passcode didn’t work.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <StaffShell>
      <Screen width="page">
        <div className={s.wrap}>
          <Card tone="featured" as="form" className={s.card} onSubmit={submit}>
            <div className={s.head}>
              <IconBadge icon={LockKeyhole} tone="gold" />
              <h1 className={s.title}>Facilitator</h1>
            </div>
            <Input label="Passcode" type="password" autoComplete="current-password" value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
            {error && <FieldError>{error}</FieldError>}
            <Button type="submit" size="lg" block disabled={!input || busy}>
              {busy ? 'Checking…' : 'Unlock'}
            </Button>
          </Card>
        </div>
      </Screen>
    </StaffShell>
  );
}
