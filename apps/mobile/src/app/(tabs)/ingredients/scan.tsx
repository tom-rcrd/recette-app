import { router } from 'expo-router';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { Muted, Screen } from '@/components/ui';
import { useData } from '@/lib/data';

export default function ScanProduct() {
  const { ingredients } = useData();

  function onCode(code: string) {
    // Déjà dans le catalogue → on ouvre sa fiche ; sinon fiche pré-remplie depuis Open Food Facts
    const existing = ingredients.find((i) => i.barcode === code);
    router.replace(existing ? `/ingredients/${existing.id}` : `/ingredients/new?barcode=${code}`);
  }

  return (
    <Screen>
      <Muted>Scanne un produit du commerce : s’il est référencé sur Open Food Facts, sa fiche (nutrition, allergènes, Nutri-Score…) est remplie automatiquement.</Muted>
      <BarcodeScanner onCode={onCode} />
    </Screen>
  );
}
