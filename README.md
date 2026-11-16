# SmartList

Liste de courses en un seul fichier HTML, installable sur téléphone (PWA) et utilisable hors ligne.

- Deux sections triées par ordre alphabétique : à acheter, dans le panier.
- Recherche insensible aux accents (`epinard` trouve « Épinards »).
- Données enregistrées dans le `localStorage` du navigateur : rien ne quitte l'appareil, et vider les données du site efface la liste.

## Mise en ligne

Activer GitHub Pages : Settings → Pages → Deploy from a branch → `main` / `(root)`.
Après chaque modification, incrémenter `VERSION` dans `sw.js`.
