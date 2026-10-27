/**
 * Declarations de modules pour les fichiers non-JS importes par le code
 * herite de la version web (CSS modules + feuille de style globale).
 * Sur natif ces imports ne servent a rien ; ils evitent juste les erreurs TS.
 */
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '@/global.css';
