import { Redirect } from 'expo-router';

/** La page d'accueil est le tableau de bord du groupe (tabs),
 *  qui fournit la barre d'onglets (navigation) sur Android et Web. */
export default function IndexRedirect() {
  return <Redirect href="/(tabs)" />;
}
