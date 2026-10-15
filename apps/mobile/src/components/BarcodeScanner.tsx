import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { isBarcode } from '@/lib/off';
import { useTheme } from '@/lib/theme';
import { Body, Button, Field, Muted, Row } from './ui';

/**
 * Caméra qui lit les codes-barres alimentaires (EAN/UPC) et appelle onCode une seule fois.
 * Saisie manuelle possible si la caméra est refusée ou indisponible (navigateur sans caméra…).
 */
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const t = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const locked = useRef(false);

  function handle(result: BarcodeScanningResult) {
    const code = result.data.trim();
    if (locked.current || !isBarcode(code)) return;
    locked.current = true;
    onCode(code);
  }

  return (
    <View style={{ gap: 14 }}>
      {permission?.granted ? (
        <View style={{ height: 360, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={handle}
          />
          {/* Viseur */}
          <View pointerEvents="none" style={{
            position: 'absolute', left: '15%', right: '15%', top: '38%', height: '24%',
            borderWidth: 3, borderColor: t.accent, borderRadius: 12,
          }} />
        </View>
      ) : (
        <View style={{ padding: 24, borderRadius: 16, backgroundColor: t.card, gap: 10, alignItems: 'flex-start' }}>
          <Body>Autorise la caméra pour scanner le code-barres d’un produit.</Body>
          {permission && !permission.canAskAgain
            ? <Muted>Accès refusé : réactive la caméra pour Recettes dans les Réglages de l’iPad.</Muted>
            : <Button label="Autoriser la caméra" onPress={requestPermission} />}
        </View>
      )}
      <Muted>Place le code-barres dans le cadre. Ou tape-le :</Muted>
      <Row>
        <View style={{ flex: 1 }}>
          <Field value={manual} onChangeText={setManual} placeholder="3017620422003" keyboardType="number-pad" />
        </View>
        <Button label="Chercher" disabled={!isBarcode(manual)} onPress={() => onCode(manual.trim())} />
      </Row>
    </View>
  );
}
