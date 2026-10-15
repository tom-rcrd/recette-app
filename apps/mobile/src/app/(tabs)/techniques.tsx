import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, View } from 'react-native';
import { Body, Button, Card, Chip, Empty, Field, H2, Muted, Row, Screen, Tag } from '@/components/ui';
import { notify } from '@/lib/alert';
import { useData } from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

interface Media { id: string; kind: 'image' | 'video' | 'link'; url: string; caption: string | null; signed?: string }
interface Technique { id: string; title: string; description: string | null; tags: string[]; technique_media: Media[] }

const isStoragePath = (url: string) => !/^https?:\/\//.test(url);

export default function Techniques() {
  const t = useTheme();
  const { id: focusId } = useLocalSearchParams<{ id?: string }>();
  const { household } = useData();
  const [items, setItems] = useState<Technique[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('techniques').select('*, technique_media(*)').order('title');
    if (error) return notify('Erreur', error.message);
    // Les fichiers du bucket privé "media" sont lus via des URL signées
    const withUrls = await Promise.all((data as Technique[]).map(async (tq) => ({
      ...tq,
      technique_media: await Promise.all(tq.technique_media.map(async (m) => {
        if (!isStoragePath(m.url)) return m;
        const { data: s } = await supabase.storage.from('media').createSignedUrl(m.url, 3600);
        return { ...m, signed: s?.signedUrl };
      })),
    })));
    setItems(focusId ? [...withUrls].sort((a) => (a.id === focusId ? -1 : 0)) : withUrls);
  }, [focusId]);
  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!household || !title.trim()) return;
    const { error } = await supabase.from('techniques').insert({ household_id: household.id, title: title.trim(), description: description || null });
    if (error) return notify('Erreur', error.message);
    setTitle(''); setDescription('');
    load();
  }

  async function addLink(techniqueId: string) {
    if (!/^https?:\/\//.test(link)) return;
    await supabase.from('technique_media').insert({ technique_id: techniqueId, kind: 'link', url: link.trim() });
    setLink('');
    load();
  }

  async function upload(techniqueId: string) {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setBusy(techniqueId);
    try {
      const body = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.fileName?.split('.').pop() ?? (asset.type === 'video' ? 'mp4' : 'jpg');
      const path = `${household!.id}/techniques/${techniqueId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('media').upload(path, body, { contentType: asset.mimeType ?? undefined });
      if (error) throw error;
      await supabase.from('technique_media').insert({ technique_id: techniqueId, kind: asset.type === 'video' ? 'video' : 'image', url: path });
      await load();
    } catch (e) { notify('Envoi impossible', (e as Error).message); }
    setBusy(null);
  }

  return (
    <Screen>
      <Muted>Gestes et techniques : découpes, cuissons, pliages… avec photos et vidéos de démonstration, à relier aux étapes des recettes.</Muted>
      <Card>
        <Field label="Nouvelle technique" placeholder="Ciseler une échalote" value={title} onChangeText={setTitle} />
        <Field placeholder="Description (optionnel)" value={description} onChangeText={setDescription} multiline />
        <Button label="Créer" onPress={create} disabled={!title.trim()} />
      </Card>

      {!items.length ? <Empty title="Aucune technique" /> : null}
      {items.map((tq) => (
        <Card key={tq.id} style={tq.id === focusId ? { borderColor: t.accent, borderWidth: 2 } : undefined}>
          <H2>{tq.title}</H2>
          {tq.description ? <Body>{tq.description}</Body> : null}
          <Row wrap gap={10}>
            {tq.technique_media.map((m) => m.kind === 'image' && m.signed ? (
              <Image key={m.id} source={{ uri: m.signed }} style={{ width: 220, height: 160, borderRadius: 10 }} />
            ) : (
              <Chip key={m.id} label={m.kind === 'video' ? '▶ Vidéo' : `🔗 ${m.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}`}
                onPress={() => Linking.openURL(m.signed ?? m.url)} />
            ))}
          </Row>
          <Row wrap>
            <View style={{ flex: 1, minWidth: 220 }}>
              <Field placeholder="Lien YouTube, TikTok…" value={link} onChangeText={setLink} autoCapitalize="none" />
            </View>
            <Button label="Ajouter le lien" variant="secondary" onPress={() => addLink(tq.id)} />
            <Button label="Photo / vidéo" variant="secondary" onPress={() => upload(tq.id)} loading={busy === tq.id} />
          </Row>
          {tq.tags.length ? <Row wrap>{tq.tags.map((x) => <Tag key={x} label={x} />)}</Row> : null}
        </Card>
      ))}
    </Screen>
  );
}
