# LUMEN Android — générer l'APK

Application LUMEN · Expo (SDK 57) · package `com.lumen.monitoring` · API : `https://monitoring.lumen.green/api/lumen`

## 1. Préparer
```bash
npm install
npx expo install --fix
npx expo-doctor
npx tsc --noEmit
npm test
```

## 2. Clé Google Maps (carte des centrales)
Sur Android, `react-native-maps` utilise Google Maps : il faut une clé (Maps SDK for Android activé dans Google Cloud).
```bash
npx eas-cli login
npx eas-cli env:create --name GOOGLE_MAPS_API_KEY --value "VOTRE_CLE" --environment preview --visibility secret
```
`app.config.js` ajoute automatiquement le plugin `react-native-maps` avec cette clé au build.

## 3. Construire l'APK (installable directement)
```bash
npx eas-cli build --platform android --profile preview
```
Le lien de téléchargement de l'APK s'affiche à la fin. Pour le Play Store : profil `production` (AAB).

## 4. Tester en développement
```bash
npx expo start --android
```

## Icône
Les icônes dans `assets/images/` sont une icône LUMEN (soleil) générée : remplacez `icon.png` (1024×1024), `android-icon-foreground.png` (512×512, logo centré sur fond transparent) et `splash-icon.png` par votre logo officiel si vous en avez un.

## Installer l'APK sur le téléphone
Ouvrez le lien EAS sur le téléphone, téléchargez l'APK, autorisez « Installer des applications inconnues » pour le navigateur, puis installez.
