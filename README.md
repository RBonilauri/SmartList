# SmartList

Liste de courses en un seul fichier HTML, installable sur téléphone (PWA) et utilisable hors ligne.

- Deux sections triées par ordre alphabétique : à acheter, dans le panier.
- Recherche insensible aux accents (`epinard` trouve « Épinards »).
- Options (menu burger) : thème jour / nuit / auto, taille du texte, export et import JSON.
- Données enregistrées dans le `localStorage` du navigateur ; vider les données du site efface la liste.
- Plusieurs listes (menu burger → Mes listes) : locales ou partagées, renommables.
- Partage facultatif par code de foyer : les téléphones qui saisissent le même code voient la même liste (actualisée toutes les 5 secondes, modifications hors ligne envoyées au retour du réseau).

- Bouton « Envoyer la liste » : notification push avec les ingrédients à acheter. Pour une liste partagée, une fenêtre montre l'aperçu, permet d'ajouter un petit mot et de choisir les destinataires (chaque téléphone a un prénom). Pour une liste locale, la notification s'affiche sur ce téléphone.

## Partage par foyer (Supabase)

1. Créer un projet Supabase et exécuter `supabase/schema.sql` dans l'éditeur SQL.
2. Renseigner `SB_URL` et `SB_KEY` (clé publique `anon` / publishable, jamais la clé `service_role`) en haut du script de `index.html`.

Le code de foyer sert de mot de passe : quiconque le connaît peut lire et modifier la liste. La table n'est accessible qu'à travers la fonction `sl_sync`, qui exige ce code.

## Mise en ligne

Activer GitHub Pages : Settings → Pages → Deploy from a branch → `main` / `(root)`.
Après chaque modification, incrémenter `VERSION` dans `sw.js`.


## Notifications push

1. Exécuter `supabase/schema.sql` (tables et fonctions `sl_push_*`, `sl_notify_prepare`).
2. Dans Supabase → Edge Functions → Secrets : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (URL de l'appli ou `mailto:`). La clé publique doit être identique à `VAPID_PUBLIC` dans `index.html`.
3. Déployer `supabase/functions/sl-notify/index.ts` sous le nom `sl-notify`, avec la vérification JWT désactivée (l'appli appelle avec la clé publique).

Une liste partagée ne peut être envoyée qu'une fois toutes les 20 secondes. Sur iPhone, les notifications ne fonctionnent que dans l'appli ajoutée à l'écran d'accueil (iOS 16.4 ou plus).
