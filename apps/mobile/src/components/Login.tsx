import { useState } from 'react';
import { View } from 'react-native';
import { configError, supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { Body, Button, Field, H1, Muted } from './ui';

export default function Login() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(mode: 'signin' | 'signup') {
    setBusy(true);
    setMessage(null);
    const { error } = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) setMessage(error.message);
    else if (mode === 'signup') setMessage('Compte créé. Vérifie tes e-mails si la confirmation est activée.');
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ width: '100%', maxWidth: 420, gap: 14 }}>
        <H1>Recettes</H1>
        {configError ? <Body style={{ color: t.danger }}>{configError}</Body> : null}
        <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />
        <Button label="Se connecter" onPress={() => submit('signin')} loading={busy} />
        <Button label="Créer un compte" variant="secondary" onPress={() => submit('signup')} disabled={busy} />
        {message ? <Muted>{message}</Muted> : null}
      </View>
    </View>
  );
}
