# SmartList

Liste de courses en un seul fichier HTML, installable sur téléphone (PWA) et utilisable hors ligne.

- Deux sections triées par ordre alphabétique : à acheter, dans le panier.
- Recherche insensible aux accents (`epinard` trouve « Épinards »).
- Options (menu burger) : thème jour / nuit / auto, taille du texte, export et import JSON.
- Données enregistrées dans le `localStorage` du navigateur ; vider les données du site efface la liste.
- Plusieurs listes (menu burger → Mes listes) : locales ou partagées, renommables.
- Partage facultatif par code de foyer : les téléphones qui saisissent le même code voient la même liste (actualisée toutes les 5 secondes, modifications hors ligne envoyées au retour du réseau).

## Partage par foyer (Supabase)

1. Créer un projet Supabase et exécuter `supabase/schema.sql` dans l'éditeur SQL.
2. Renseigner `SB_URL` et `SB_KEY` (clé publique `anon` / publishable, jamais la clé `service_role`) en haut du script de `index.html`.

Le code de foyer sert de mot de passe : quiconque le connaît peut lire et modifier la liste. La table n'est accessible qu'à travers la fonction `sl_sync`, qui exige ce code.

## Mise en ligne

Activer GitHub Pages : Settings → Pages → Deploy from a branch → `main` / `(root)`.
Après chaque modification, incrémenter `VERSION` dans `sw.js`.
