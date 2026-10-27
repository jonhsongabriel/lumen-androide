// Étend app.json. La clé Google Maps (Android) est lue depuis la variable
// d'environnement GOOGLE_MAPS_API_KEY pour ne jamais être commitée dans le dépôt.
module.exports = ({ config }) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return config;
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-maps', { androidGoogleMapsApiKey: key }],
    ],
  };
};
