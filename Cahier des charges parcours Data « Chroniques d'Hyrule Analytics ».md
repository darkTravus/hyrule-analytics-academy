# Cahier des charges : parcours Data « Chroniques d'Hyrule Analytics »

Ce document décrit de façon autonome un cours de 16 semaines (analyse de données puis data science) sous forme de pages web statiques interactives, avec son univers inspiré de Zelda, ses jeux de données à générer et ses API à simuler : une IA qui ne reçoit que ce texte doit pouvoir produire le site complet.

## Sommaire

1. Mission confiée à l'IA destinataire
2. Contexte pédagogique et public
3. Contraintes et architecture technique du site
4. Univers narratif et gamification
5. Données réelles : Hyrule Compendium API
6. Données synthétiques : le jeu fictif Hyrule Quest Online (HQO)
7. API fictive du studio (faux serveur dans le navigateur)
8. Parcours détaillé : 10 modules (0 à 9)
9. Formats de contenu (QCM, exercices, progression, jetons)
10. Évaluation, validation et certification
11. Plan de travail conseillé pour l'IA et contrôle qualité
12. Hypothèses, points à vérifier et risques

## 1. Mission confiée à l'IA destinataire

Tu dois construire un site de formation statique, hébergeable gratuitement, qui enseigne l'analyse de données et la data science à des débutants à travers une aventure dans l'univers de Zelda. Le site fonctionne uniquement dans le navigateur de l'élève : aucun serveur, aucune base distante, aucun compte.

**Livrables attendus**

1. Un dépôt `hyrule-analytics-academy`, déployable tel quel sur GitHub Pages, sans étape de build.
2. Un générateur de données reproductible (`scripts/generate_hqo_dataset.py`), ses tests d'acceptation et les jeux produits dans `data/` (section 6).
3. Un script d'extraction du Compendium (`scripts/fetch_compendium_snapshot.py`) et son instantané JSON (section 5).
4. Une bibliothèque JavaScript commune : exécuteur SQL, exécuteur Python, moteur de QCM, suivi de progression, faux serveur d'API, jetons de validation (sections 3, 7 et 9).
5. Les 10 modules du parcours : leçons, exercices interactifs, QCM, épreuve de « boss », livrable (section 8).
6. Un README pour l'enseignant (déploiement, régénération des données, corrections) et un fichier `docs/DECISIONS.md` où tu consignes chaque hypothèse faite.

**Règles de conduite**

- Écris tout le contenu destiné à l'élève en français, au tutoiement, ton encourageant, jamais condescendant.
- N'invente jamais un fait sur l'API Compendium ou sur Zelda : vérifie dans la documentation officielle et note dans `DECISIONS.md` ce que tu n'as pas pu vérifier.
- Tout nombre cité dans une leçon ou un QCM (chiffre d'affaires, p-value, taux) provient d'un calcul exécuté sur les données générées, jamais d'une estimation. Les corrigés sont produits par script, pas rédigés à la main.
- Aucun secret (clé d'API, jeton) dans le dépôt. Aucun suivi de visiteurs, aucune donnée personnelle réelle.
- Si une consigne de ce document est ambiguë, choisis l'option la plus simple, note-la dans `DECISIONS.md` et continue.

**Définition de « terminé »** : un élève ouvre l'URL et suit les modules 0 à 9 dans l'ordre ; les modules 2, 3, 4, 6 et 7 s'exécutent entièrement dans le navigateur sans installation ; les modules 1, 5 et 8 demandent un outil externe (tableur, outil de BI, clé d'API d'un modèle de langage) et les modules 0 et 9 demandent Git en local ; chaque module délivre un jeton de validation ; tous les tests d'acceptation de la section 11 passent.

## 2. Contexte pédagogique et public

**Public** : adultes ou étudiants qui repartent des bases, sans prérequis en code, à l'aise avec un navigateur. Objectif final : pouvoir candidater à un poste d'analyste de données ou de data scientist junior.

**Rythme** : 16 semaines, 10 à 12 h par semaine (environ 3 h de théorie et 7 à 9 h de pratique). L'accès est libre à tout moment : le site ne verrouille aucun contenu par date.

**Principes pédagogiques à respecter dans chaque page**

- Pratique d'abord : chaque leçon commence par un problème concret du studio, puis la théorie, puis un exercice.
- Règle des 15 minutes : l'élève essaie seul 15 minutes avant de dérouler les indices (3 indices progressifs, solution en dernier).
- Journal d'erreurs : un composant permet de noter une erreur (cause, correction), stocké localement et exportable en Markdown.
- Seuil de 80 % aux QCM avant de passer au boss du module. Pas de verrouillage dur : un avertissement suffit.
- Les assistants IA sont autorisés comme tuteurs (page « Bien utiliser l'IA » au module 0) ; les boss se passent sans IA.
- Chaque module produit un livrable que l'élève verse sur son propre GitHub.

**Les trois cas fil rouge, transposés dans l'univers**

| Cas | Version d'origine | Version Hyrule | Données |
| --- | --- | --- | --- |
| A | Immobilier (DVF) : données publiques sales | Atlas du royaume : monstres, butins, régions | Compendium (réel) |
| B | E-commerce (Olist) : base relationnelle multi-tables | Boutique de rupees du jeu HQO | HQO synthétique |
| C | Churn client | Abandon des joueurs avant le premier temple | HQO synthétique |

## 3. Contraintes et architecture technique du site

**Hébergement** : GitHub Pages (gratuit) en priorité ; Cloudflare Pages ou Netlify en alternative. Le site fonctionne sous un sous-chemin (`/hyrule-analytics-academy/`) : tous les liens sont relatifs. Limites à vérifier dans la documentation de l'hébergeur au moment de la mise en ligne : fichier unique ≤ 100 Mo, site publié autour de 1 Go au maximum ; viser moins de 60 Mo au total.

**Principes** : HTML, CSS et JavaScript natif (modules ES), aucun framework imposé, aucune étape de build, aucun backend. Les bibliothèques se chargent depuis un CDN avec **version épinglée** (jamais « latest »), de préférence cdnjs ou jsDelivr.

**Bibliothèques**

| Besoin | Choix | Remarque |
| --- | --- | --- |
| SQL dans le navigateur | sql.js (SQLite compilé en WebAssembly) | Charge un fichier `.sqlite` statique ; option : DuckDB-WASM pour des fonctions analytiques avancées |
| Python dans le navigateur | Pyodide, dans un Web Worker | pandas, numpy, scipy, matplotlib, statsmodels, scikit-learn attendus disponibles (à vérifier) ; XGBoost et LightGBM non garantis : utiliser `HistGradientBoostingClassifier` de scikit-learn |
| Éditeur de code | CodeMirror 6 | Coloration SQL et Python |
| Graphiques interactifs | Chart.js ou Plotly | Widgets : théorème central limite, calculateur A/B, puissance |
| Rendu Markdown | marked + DOMPurify, ou pages HTML écrites à la main | Assainir tout HTML dynamique |
| Hachage | Web Crypto API (SHA-256) | Aucune dépendance |

**Arborescence du dépôt**

```text
hyrule-analytics-academy/
  index.html                 # carte du royaume : 10 donjons, progression
  assets/
    css/       theme.css, components.css
    js/        core/    progress.js, quiz.js, exercise.js, token.js
               runners/ sql-runner.js, py-worker.js, py-runner.js
               mock/    mock-api.js, routes.js
               widgets/ clt.js, ab-calc.js, power.js, bayes.js
    img/       illustrations originales (SVG)
  modules/
    m0-eveil/ ... m9-triforce/   # index.html, lesson-XX.html, quiz.json, exercises.json, boss.json
  data/
    hqo_lite.sqlite, hqo_full.sqlite
    csv/         players.csv, sessions.csv, ...
    ml/          ml_churn_players.csv, players_snapshot_leaky.csv, ml_ltv_players.csv
    excel/       boutique_extrait.csv (+ .xlsx)
    corrupted/   hqo_corrupted.zip
    reviews/     reviews.csv, reviews_gold_hashed.json
    compendium/  compendium_snapshot.json
    api_mock/    v3/...   (miroir statique du Compendium)
    expected/    answers_hashed.json
  scripts/   generate_hqo_dataset.py, test_dataset.py, fetch_compendium_snapshot.py, build_hashes.py
  docs/      DECISIONS.md, TEACHER.md, SCHEMA.md
  .github/workflows/pages.yml   # optionnel
```

**Exécuteur SQL** : charger `hqo_lite.sqlite` une fois (cache en mémoire), exécuter chaque requête de l'élève sur une copie en lecture seule, interdire `DROP`, `ATTACH` et les `PRAGMA` hors liste blanche. Afficher les 200 premières lignes, le temps d'exécution et le plan (`EXPLAIN QUERY PLAN`). Correction : normaliser le résultat (arrondi à 2 décimales, tri si l'exercice n'impose pas `ORDER BY`), le hacher en SHA-256 et le comparer au hachage attendu dans `expected/answers_hashed.json`. Messages d'erreur pédagogiques en français : colonnes différentes, nombre de lignes différent, valeurs proches mais fausses.

**Exécuteur Python** : Pyodide dans un Web Worker pour ne pas bloquer l'interface, avec écran de chargement (téléchargement initial de plusieurs dizaines de Mo, mis en cache par le navigateur). Les données sont chargées par `fetch` depuis `data/` et montées dans le système de fichiers virtuel (`/data/...`). Chaque exercice fournit du code de départ et des tests (`assert`) exécutés après le code de l'élève ; les sorties texte et les figures matplotlib s'affichent sous la cellule. Délai maximal de 20 s par exécution, bouton « Réinitialiser l'environnement ».

**Exercices externes** (Excel, BI, Git, appels à un modèle de langage) : la page fournit le dossier de données à télécharger, la consigne et un **formulaire d'auto-contrôle** : l'élève saisit des valeurs ou choisit des réponses, la page les compare à des hachages (tolérance numérique configurable par question).

**Progression** : stockée dans `localStorage` (clé `hqo_progress_v1`), avec export et import JSON pour changer d'appareil. Aucune donnée n'est envoyée à un serveur (format en section 9).

**Qualité attendue** : affichage adapté au mobile, thème clair ou sombre automatique, contraste WCAG AA, navigation au clavier, texte alternatif sur toute image, page de cours chargée en moins d'une seconde hors Pyodide, mode hors ligne optionnel (service worker qui met pages et données en cache).

## 4. Univers narratif et gamification

**Cadre** : l'élève est analyste de données au **Studio Hyrule Analytics**, qui exploite un jeu d'aventure fictif, **Hyrule Quest Online (HQO)**, inspiré de l'univers de Zelda. Le jeu HQO et toutes ses données sont fictifs et originaux ; le Compendium réel sert d'encyclopédie du monde.

**Personnages-guides** (noms d'inspiration Zelda utilisés comme habillage ; à remplacer par des noms génériques en cas de diffusion publique : voir section 12)

| Guide | Rôle dans le parcours | Modules |
| --- | --- | --- |
| Impa | Gardienne des archives : SQL, rigueur, données | 0, 2 |
| Purah | Chercheuse : statistiques, expériences, machine learning | 3, 7 |
| Robbie | Ingénieur du studio : Python, qualité, pipelines | 4, 6 |
| Zelda | Directrice produit : pose les questions métier, reçoit les recommandations | 1, 5, 9 |
| Ganon | Antagoniste : incarne la corruption des données et les pièges | 6 |
| Oracle de la Source | IA du royaume : IA générative et ses limites | 8 |

**Structure de chaque module (un « donjon »)** : 1) ordre de mission de Zelda (problème métier en 5 lignes) ; 2) leçons ; 3) exercices (les « salles ») ; 4) QCM (les « cœurs ») ; 5) boss (test final chronométré) ; 6) livrable (le « butin »), versé sur GitHub.

**Récompenses** : XP pour chaque exercice (10 à 30), chaque QCM réussi (50) et chaque boss (100 à 200) ; 3 cœurs par module (QCM ≥ 80 %, exercices ≥ 80 %, boss réussi) ; badges (« Première requête », « Zéro fuite », « Test A/B maîtrisé »…) ; niveau global calculé sur l'XP ; carte du royaume sur la page d'accueil montrant les donjons terminés. Pas de classement public : l'objectif est la progression individuelle.

**Ton** : narratif léger, jamais au détriment de la rigueur. Une phrase d'ambiance au plus par page de cours ; les consignes techniques restent sèches et précises.

## 5. Données réelles : Hyrule Compendium API

**Rôle** : source réelle du cas A (Atlas du royaume), utilisée aux modules 0, 4 et 8.

**Ce qui est vérifié** (documentation du dépôt gadhagod/Hyrule-Compendium-API, code sous licence MIT) : l'API expose les objets et régions de Breath of the Wild et de Tears of the Kingdom. Exemple documenté :

```text
GET https://botw-compendium.herokuapp.com/api/v3/entry/white-maned_lynel
→ { "data": { "name": "white-maned lynel", "id": 123, "category": "monsters",
      "description": "...", "common_locations": ["Hyrule Field", "Hebra Mountains"],
      "drops": ["lynel horn", "lynel hoof", "lynel guts"], "image": "https://..." } }
```

**Ce que l'IA doit vérifier avant de coder** (ne rien supposer)

- L'hôte est-il toujours en ligne ? Les pages consultées indiquent peu de mises à jour récentes (dernière date relevée : mai 2024) et l'hôte d'origine est un service gratuit susceptible d'avoir changé. Lire la documentation officielle (gadhagod.github.io/Hyrule-Compendium-API) pour l'URL actuelle.
- Les routes de liste (toutes les entrées, par catégorie), le choix du jeu (BotW ou TotK), la pagination éventuelle et les en-têtes CORS.
- Les champs variables selon la catégorie (probablement points d'attaque et de défense pour l'équipement, cœurs restaurés et effet de cuisson pour la nourriture : à confirmer sur la réponse réelle).
- Le nombre réel d'entrées par catégorie (à mesurer, pas à estimer).

**Stratégie imposée (hôte potentiellement indisponible)**

1. `scripts/fetch_compendium_snapshot.py` télécharge toutes les entrées à 1 requête par seconde maximum, avec un en-tête `User-Agent` identifiant le projet, une gestion des erreurs et des reprises. Il écrit `data/compendium/compendium_snapshot.json` avec la date de collecte.
2. Le snapshot ne conserve que les champs structurés (id, name, category, common\_locations, drops, valeurs numériques) et **exclut `description` et `image`** : ce sont des textes et visuels de Nintendo, inutiles à redistribuer.
3. `data/api_mock/v3/...` reproduit la forme exacte des réponses de l'API réelle (mêmes chemins, même enveloppe `{ "data": ... }`) à partir du snapshot, pour que les exercices fonctionnent hors ligne.
4. Le code d'exercice de l'élève appelle une fonction `get_json(url)` qui essaie l'API réelle (délai de 5 s) puis bascule sur le miroir en l'indiquant clairement (« Mode hors ligne : données du miroir »).
5. Le module 0 montre l'appel réel une fois (une vraie API peut tomber en panne : c'est instructif), puis utilise le miroir.

**Défauts de données à conserver volontairement** (réels, utiles pour l'exercice de nettoyage du module 4) : noms en minuscules avec espaces ou tirets bas, champs `null` selon la catégorie, `common_locations` parfois nul ou multiple, noms de régions qui ne correspondent pas exactement à ceux de la table `regions` de HQO (section 6) : cette jointure approximative fait partie de l'exercice.

## 6. Données synthétiques : le jeu fictif Hyrule Quest Online (HQO)

**Principe** : `scripts/generate_hqo_dataset.py` (Python 3, numpy, pandas, graine fixe) génère un jeu complet et cohérent. Les « vérités terrain » (effets plantés, anomalies, paramètres) sont définies dans le script et exportées dans `docs/GROUND_TRUTH.md`, réservé à l'enseignant et non publié sur le site. Le script `scripts/test_dataset.py` vérifie les critères d'acceptation (section 11). Si un critère échoue, l'IA change la graine ou recalibre, puis consigne la graine finale dans `DECISIONS.md`.

**Cadre du jeu fictif** : HQO est un jeu d'aventure gratuit sur mobile (iOS, Android) et PC. Le joueur choisit une classe de héros, explore des régions, accomplit des quêtes, affronte des boss de donjon et dépense des rupees (monnaie du jeu) dans la boutique ; certains packs s'achètent en euros. Période couverte : **du 1er janvier 2025 au 30 juin 2026** ; date de l'instantané : **1er juillet 2026**. Aucune donnée personnelle : pas de nom, pas d'e-mail, pas d'adresse IP, pas de mineurs (tranches d'âge à partir de 16 ans).

**Volumétrie** : jeu complet (`hqo_full.sqlite`) de 12 000 joueurs. Version lite (`hqo_lite.sqlite`, module 2) : sous-ensemble cohérent de 2 000 joueurs tirés au hasard, toutes les tables filtrées en conséquence, mêmes schémas, environ 25 000 sessions, moins de 4 Mo. Les CSV du dossier `data/csv/` sont l'équivalent exact des tables (UTF-8, séparateur virgule, dates ISO 8601 en UTC, valeurs manquantes = champ vide).

**Schéma des tables** (SQLite, clés étrangères déclarées)

| Table | Lignes (complet) | Colonnes (type ; valeurs) |
| --- | --- | --- |
| regions | 12 | region\_id INT PK ; region\_name TEXT ; biome TEXT (forêt, montagne, désert, lac, plaine, volcan) ; danger\_level INT 1 à 5 |
| players | 12 000 | player\_id TEXT PK (P000001…) ; signup\_ts TEXT UTC ; signup\_date DATE ; country TEXT ISO2 ; platform TEXT (ios, android, pc) ; age\_band TEXT (16-24, 25-34, 35-44, 45+) ; hero\_class TEXT (guerrier, archer, mage, gardien) ; acquisition\_channel TEXT (organic, ads, friend\_referral, influencer, store\_feature) ; is\_premium INT 0/1 |
| sessions | ≈ 150 000 | session\_id INT PK ; player\_id FK ; start\_ts TEXT UTC ; duration\_min REAL ; region\_id FK ; enemies\_defeated INT ; deaths INT ; rupees\_earned INT |
| quests | 60 | quest\_id INT PK ; title TEXT ; quest\_type TEXT (main, side, shrine, dungeon) ; region\_id FK ; difficulty INT 1 à 5 ; recommended\_level INT 1 à 40 ; reward\_rupees INT |
| quest\_attempts | ≈ 40 000 | attempt\_id INT PK ; player\_id FK ; quest\_id FK ; started\_ts TEXT ; completed INT 0/1 ; duration\_min REAL ; deaths INT |
| bosses | 8 | boss\_id INT PK ; boss\_name TEXT ; region\_id FK ; base\_hp INT ; difficulty INT 1 à 5 |
| boss\_fights | ≈ 25 000 | fight\_id INT PK ; player\_id FK ; boss\_id FK ; fight\_ts TEXT ; result TEXT (win, lose) ; duration\_sec INT ; hearts\_at\_start INT 3 à 20 ; damage\_taken INT ; attempt\_no INT |
| shop\_items | 80 | item\_id INT PK ; item\_name TEXT ; category TEXT (potion, arme, armure, cosmétique, pack\_rupees, pack\_aventurier) ; rarity TEXT (commun, rare, épique, légendaire) ; price\_rupees INT (NULL pour les packs) ; price\_eur REAL (NULL pour les objets en jeu) ; compendium\_name TEXT (nullable) |
| orders | ≈ 9 000 | order\_id INT PK ; player\_id FK ; order\_ts TEXT ; currency TEXT (RUPEES, EUR) ; status TEXT (completed 94 %, refunded 4 %, failed 2 %) ; payment\_method TEXT (NULL si RUPEES ; sinon card, paypal, apple\_pay, google\_pay) |
| order\_lines | ≈ 14 000 | order\_id FK ; line\_no INT ; item\_id FK ; qty INT 1 à 5 ; unit\_price REAL (dans la devise de la commande) ; clé primaire (order\_id, line\_no) |
| experiments | 3 | experiment\_id TEXT PK ; name TEXT ; hypothesis TEXT ; start\_date DATE ; end\_date DATE ; primary\_metric TEXT |
| experiment\_assignments | 6 600 | experiment\_id FK ; player\_id FK ; variant TEXT (control ou treatment ; A ou B pour le test 3) ; assigned\_ts TEXT |
| patches | 6 | patch\_id INT PK ; version TEXT ; release\_date DATE ; notes TEXT (français) |
| reviews | 600 | review\_id INT PK ; player\_id FK ; review\_ts TEXT ; rating INT 1 à 5 ; lang TEXT (fr, en) ; review\_text TEXT |

**Données de référence à fixer**

- `regions` (12) : noms inspirés des régions du Compendium (par exemple Hyrule Field, Hebra Mountains, Gerudo Desert, Lake Hylia, Zora's Domain, Death Mountain, Lost Woods, Faron Woods, Akkala Highlands, Necluda, Eldin Canyon, Lanayru Wetlands). Après extraction du snapshot (section 5), l'IA ajuste les noms pour que 8 à 10 des 12 régions correspondent exactement (à la casse et aux espaces près) aux `common_locations` réels, et que 2 à 4 diffèrent volontairement (par exemple « Zora Domain » au lieu de « Zora's Domain »).
- `quests` (60) : titres originaux en français (par exemple « Le secret du puits n°7 »), 20 principales, 20 secondaires, 12 sanctuaires, 8 donjons (un par boss).
- `bosses` (8) : noms originaux (par exemple Gardien de Pierre, Reine des Sables), `base_hp` de 800 à 6 000, difficultés 1 à 5 (le premier boss, difficulté 1, est le « premier temple »).
- `shop_items` (80) : 20 potions, 20 armes, 15 armures, 15 cosmétiques, 6 `pack_rupees` (1,99 ; 4,99 ; 9,99 ; 19,99 ; 49,99 ; 99,99 euros), 4 `pack_aventurier`. Pour environ 50 % des objets, `compendium_name` reprend le nom d'une vraie entrée du snapshot (jointure facultative entre HQO et le Compendium).
- `patches` (6) : 1.9 (10/12/2024, bêta fermée) ; 2.0 (15/01/2025, lancement public) ; 2.1 (10/06/2025, nouvelle région) ; 2.2 (18/11/2025, refonte de la boutique, volume de commandes +18 %) ; 2.3 (10/04/2026, points de vie des boss +20 %) ; 2.4 (02/06/2026, lancement de la version PC).

**Règles de génération du comportement**

- **Inscriptions** : loi de Poisson, environ 12 par jour au départ, saisonnalité hebdomadaire (+25 % le week-end), tendance +2 % par mois. Pics : campagne d'influenceurs du 01/02/2026 au 15/03/2026 (+65 inscriptions par jour, 70 % du canal influencer), sortie PC en juin 2026 (environ 2 000 inscriptions sur le mois). La base est calibrée pour atteindre 12 000 joueurs à ± 3 %.
- **Profils** : pays FR 28 %, US 18 %, DE 8 %, GB 7 %, CA 6 %, ES 6 %, BR 6 %, BE 5 %, JP 5 %, CH 3 %, autres 8 %. Plateforme ios 38 %, android 42 %, pc 20 % (sauf juin 2026 : 50 % mobile, 50 % pc). Canal organic 35 %, ads 30 %, influencer 15 %, friend\_referral 12 %, store\_feature 8 %. Classe guerrier 40 %, archer 30 %, mage 20 %, gardien 10 %. `is_premium` 6 %.
- **Rétention** (joueurs du groupe de contrôle, hors effets plantés) : jour 1 : 41 % ; jour 7 : 20 % ; jour 14 : 13 % ; jour 30 : 8 % ; jour 60 : 4,5 %. Un joueur « actif » un jour donné fait 1 + Poisson(0,6) sessions. Les heures de début suivent un pic en soirée (18 h à 23 h, heure locale du pays).
- **Sessions** : durée log-normale (médiane 14 min, sigma 0,6). Morts : Poisson de moyenne 0,8 × difficulté de la région, multipliée par 1,15 après le patch 2.3. Ennemis vaincus : Poisson de moyenne 6 × durée / 14. Rupees gagnés : ennemis × (4 + une loi gamma de moyenne 2) plus les récompenses de quête.
- **Quêtes** : probabilité de réussite = 0,75 − 0,12 × (difficulté − 1), bornée entre 0,2 et 0,9.
- **Boss** : probabilité de victoire = 0,60 − 0,08 × (difficulté − 1) ; multipliée par 0,8 après le patch 2.3 ; le joueur retente avec une probabilité de 0,7 après une défaite.
- **Achats** : environ 14 % des joueurs achètent avec des rupees dans les 14 premiers jours ; environ 6 % font un achat en euros au cours de leur vie ; montants en euros tirés parmi les prix de packs, plus de packs chez les joueurs PC.

**Expériences : vérité terrain à planter**

| Expérience | Inscriptions concernées | Joueurs | Métrique | Vérité plantée | Leçon visée |
| --- | --- | --- | --- | --- | --- |
| EXP\_KOROK\_2026\_02 (récompense Korok au premier donjon) | 01/02 au 15/03/2026 | 4 000 (2 000 par bras, tirage 50/50) | retained\_d7 : au moins une session le 7e jour calendaire après l'inscription | Contrôle 20,0 %, traitement 24,0 % (+4 points). Attendu : z ≈ 3,0, p ≈ 0,002, IC 95 % de la différence ≈ \[+1,4 ; +6,6\] points | Test d'hypothèse, intervalle de confiance, taille d'effet, calcul de taille d'échantillon (environ 1 700 par bras pour 80 % de puissance) |
| EXP\_HEARTS\_2026\_05 (cœurs bonus au tutoriel) | 04/05 au 17/05/2026 | 600 (300 par bras) | first\_purchase\_within\_7d | Contrôle 8 %, traitement 12 % (effet réel). Puissance ≈ 0,37 : résultat attendu non significatif (p entre 0,08 et 0,20) | Absence de significativité n'est pas absence d'effet ; manque de puissance |
| EXP\_PACK\_2026\_06 (offre pack aventurier) | 01/06 au 30/06/2026 | 2 000 (1 000 par bras) | bought\_pack\_within\_3d | Défaut de randomisation : le bras A reçoit 800 mobiles et 200 PC ; le bras B 200 mobiles et 800 PC. Conversions : mobile A 3,0 % et B 2,8 % ; PC A 12,0 % et B 11,5 %. Global : A ≈ 4,8 % (48 acheteurs) et B ≈ 9,8 % (98 acheteurs) | Paradoxe de Simpson : B paraît meilleur au global mais est moins bon dans chaque plateforme |

La table `experiment_assignments` contient les 6 600 affectations ; les métriques se recalculent à partir de `sessions` et `orders` (jamais stockées en clair, pour que l'élève les construise en SQL ou en Python).

**Abandon (churn) : cible et génération**

- Population : joueurs inscrits au plus tard le 17/05/2026 (sinon la fenêtre d'observation de 44 jours dépasse l'instantané : censure à droite, à expliquer dans le cours) et « engagés », c'est-à-dire au moins 3 sessions entre le jour 0 et le jour 14 (environ 30 à 38 % des inscrits).
- Cible `churn_d15_44` = 1 si aucune session entre le jour 15 et le jour 44 après l'inscription. Prévalence : 28 % ± 1,5.
- Génération : logit(p) = intercept − 0,35 × z(quêtes terminées J14) + 0,30 × z(morts des 3 premières sessions) + 0,55 × \[canal ads\] − 0,90 × \[boss 1 vaincu avant J14\] − 0,70 × \[achat avant J14\] + 0,25 × \[android\] + 0,25 × \[inscription après le patch 2.3\] + bruit gaussien (écart-type 0,5, non observé). L'intercept est calibré par dichotomie pour atteindre la prévalence cible. Résultats attendus : régression logistique de base avec AUC ≥ 0,72 ; meilleur modèle d'ensemble entre 0,76 et 0,82.

**Fichiers dérivés**

| Fichier | Contenu | Module |
| --- | --- | --- |
| `ml/ml_churn_players.csv` | 1 ligne par joueur engagé (2 800 à 4 500 lignes attendues). Colonnes : player\_id, signup\_date, country, platform, acquisition\_channel, hero\_class, age\_band, sessions\_d0\_14, active\_days\_d0\_14, avg\_session\_min\_d0\_14, deaths\_first\_3\_sessions, regions\_visited\_d14, quests\_completed\_d14, first\_boss\_win\_by\_d14, days\_to\_first\_dungeon (NULL si aucun donjon, environ 35 %), purchased\_by\_d14, rupees\_balance\_d14, patch\_era (avant\_2\_3 ou depuis\_2\_3), churn\_d15\_44 (cible). Toutes les variables sont calculées uniquement sur J0 à J14. | 7 |
| `ml/players_snapshot_leaky.csv` | Mêmes lignes, plus des colonnes calculées sur l'historique complet : sessions\_total, days\_active\_total, last\_session\_date, days\_since\_last\_session, lifetime\_spend\_eur. Piège de fuite de données : un modèle qui les utilise atteint un AUC ≥ 0,97. | 7 |
| `ml/ml_ltv_players.csv` | Régression : joueurs inscrits avant le 01/04/2026, variables à J7, cible `spend_eur_d8_90` (environ 93 % de zéros, reste log-normal : cas de variable à excès de zéros, transformation `log1p`). | 7 |
| `excel/boutique_extrait.csv` et `.xlsx` | 10 000 lignes de commandes à plat (jointure orders, order\_lines, shop\_items, players). Colonnes : order\_id, order\_date, player\_id, item\_name, category, qty, unit\_price, currency, platform, country. Mélange volontaire de RUPEES et d'EUR (piège : ne pas additionner des devises). | 1 |
| `corrupted/hqo_corrupted.zip` | `players_raw.csv`, `sessions_raw.csv`, `orders_raw.csv`, `order_lines_raw.csv` : version dégradée de 2 000 joueurs (8 problèmes ci-dessous) et `expected_clean_hashes.json` | 6 |
| `reviews/reviews.csv` et `reviews_gold_hashed.json` | 600 avis ; les étiquettes de référence sont stockées sous forme de hachages SHA-256 de \`review\_id | sentiment |
| `star_schema/*.csv` | `fact_sessions`, `fact_orders`, `dim_player`, `dim_date`, `dim_item`, `dim_region` prêts pour un outil de BI (clés de substitution entières, dates en colonnes année, mois, semaine, jour) | 5 |
| `docs/analyse_ia_piegee.md` | Analyse rédigée comme par une IA, avec 6 erreurs plantées (voir module 8) | 8 |

**Anomalies plantées dans l'extrait Excel (module 1)** : 40 lignes en doublon exact ; 12 prix unitaires négatifs ; 25 dates de commande postérieures au 01/07/2026 ; environ 3 % de noms d'objets avec casse ou espaces incohérents (par exemple « potion de vie », « Potion de Vie »  , « POTION DE VIE ») ; 18 lignes avec quantité nulle. Le script produit la liste exacte (numéros de ligne) pour le corrigé.

**Les 8 problèmes du paquet corrompu (module 6)**

1. Doublons approximatifs : 1,2 % des joueurs apparaissent deux fois, avec un format de date et une graphie de pays différents.
2. Formats de dates mélangés : 6 % des `start_ts` au format JJ/MM/AAAA HH:MM, 2 % en secondes depuis 1970 (epoch).
3. Pays à variantes : FR, France, fr␣ (espace final), Fra, FRANCE ; idem pour US, DE.
4. Valeurs impossibles : 0,3 % de `rupees_earned` négatifs.
5. Valeurs aberrantes de durée : 0,05 % de `duration_min` supérieurs à 1 440 (plus d'une journée) et 0,2 % égaux à 0.
6. Orphelins : 40 lignes de commande dont l'`order_id` n'existe pas dans `orders`, 25 sessions dont le `player_id` est inconnu.
7. Dates futures : 15 joueurs dont l'inscription est postérieure au 01/07/2026.
8. Valeurs manquantes non aléatoires : `platform` manquant dans 4 % des lignes, concentré sur les anciens appareils Android, codé de trois façons (vide, `N/A`, `null`).

**Avis des joueurs (module 8)** : 600 avis rédigés par composition de gabarits originaux en français (jamais de texte du jeu réel). Étiquettes de référence : sentiment (positif 55 %, neutre 15 %, négatif 30 %) et thème (difficulté, bugs, prix, graphismes, histoire, contrôles, autre). Note cohérente avec le sentiment (positif : 4 ou 5 ; neutre : 3 ; négatif : 1 ou 2), avec 10 % de bruit. Difficultés réalistes : 20 % de fautes de frappe, 15 % d'émojis, 5 % d'avis en anglais, 3 % d'ironie (cas difficiles, signalés dans la vérité terrain).

## 7. API fictive du studio (faux serveur dans le navigateur)

**Objectif** : apprendre à consommer une API (authentification, pagination, erreurs, nouvelles tentatives) sans serveur. Un « faux serveur » intercepte les appels du navigateur et répond à partir des fichiers statiques.

**Mécanisme** : `assets/js/mock/mock-api.js` remplace `fetch` pour toute URL commençant par `https://api.hqo-studio.test/` (domaine en `.test`, réservé, qui ne résout jamais en vrai). Le même module est importé dans le Web Worker Pyodide, afin que `pyodide.http.pyfetch` passe aussi par le faux serveur. Les réponses sont calculées depuis `hqo_full.sqlite` (sql.js) avec une latence simulée de 80 à 250 ms. Les chemins du Compendium (`https://botw-compendium.herokuapp.com/api/v3/...`) sont servis par le miroir de la section 5 quand l'hôte réel ne répond pas.

**Conventions communes**

- Authentification : en-tête `X-API-Key` obligatoire ; la clé publique de démonstration est `hqo_demo_key_2026` (donnée dans la leçon). Sans clé ou avec une mauvaise clé : statut 401.
- Réponse de liste : `{ "data": [ ... ], "meta": { "limit": 100, "next_cursor": "c_000100", "total": 12000 } }`. `next_cursor` vaut `null` sur la dernière page.
- Pagination par curseur : paramètres `limit` (1 à 500, défaut 100) et `cursor` (opaque : l'implémentation encode le décalage).
- Réponse d'erreur : `{ "error": { "code": "rate_limited", "message": "Trop de requêtes", "request_id": "req_000231" } }`.
- Dates en ISO 8601 UTC ; filtres de période `from` et `to` (inclus / exclu).

**Points d'accès**

| Méthode et chemin | Paramètres | Réponse |
| --- | --- | --- |
| GET `/v1/status` | aucun | `{ "data": { "status": "ok", "version": "1.4.0", "server_time": "2026-07-01T00:00:00Z" } }` (sans clé requise) |
| GET `/v1/players` | limit, cursor, signup\_from, signup\_to, platform, channel | liste de joueurs (colonnes de `players`) |
| GET `/v1/players/{player_id}` | aucun | un joueur, ou 404 |
| GET `/v1/players/{player_id}/sessions` | from, to, limit, cursor | sessions du joueur |
| GET `/v1/sessions` | from, to, region\_id, limit, cursor | sessions |
| GET `/v1/regions`, `/v1/quests`, `/v1/bosses`, `/v1/patches` | limit, cursor | listes de référence |
| GET `/v1/shop/items` | category, limit, cursor | articles de la boutique |
| GET `/v1/orders` | status, from, to, limit, cursor | commandes avec leurs lignes imbriquées (`lines`: liste) |
| GET `/v1/experiments` | aucun | les 3 expériences |
| GET `/v1/experiments/{experiment_id}/assignments` | limit, cursor | affectations |
| GET `/v1/reviews` | lang, min\_rating, limit, cursor | avis |
| POST `/v1/events/validate` | corps JSON d'un événement de télémétrie | 200 avec `{ "data": { "valid": true } }` ou 422 avec la liste des champs invalides (voir ci-dessous) |

Exemple de commande imbriquée (JSON à aplatir au module 4) :

```json
{ "order_id": 5121, "player_id": "P004871", "order_ts": "2026-03-02T19:42:11Z",
  "currency": "EUR", "status": "completed", "payment_method": "card",
  "lines": [ { "line_no": 1, "item_id": 71, "qty": 1, "unit_price": 4.99 } ] }
```

Événement valide pour `POST /v1/events/validate` : `{ "event": "boss_fight", "player_id": "P000123", "ts": "2026-04-12T20:00:00Z", "boss_id": 3, "result": "win" }`. Règles : `event` dans (session\_start, session\_end, quest\_complete, boss\_fight, purchase) ; `player_id` au format `P` suivi de 6 chiffres ; `ts` ISO 8601 ; champs spécifiques selon l'événement. Réponse 422 : `{ "error": { "code": "invalid_event", "details": [ { "field": "ts", "problem": "format ISO 8601 attendu" } ] } }`.

**Comportements d'erreur déterministes (pour apprendre à les gérer)**

- **429** : au-delà de 10 requêtes en 10 secondes, réponse 429 avec l'en-tête `Retry-After: 2` et le code `rate_limited`.
- **500** : 2 % des requêtes, choisies par un générateur pseudo-aléatoire à graine fixe (donc reproductible), avec le code `internal_error` ; la même requête réessayée réussit.
- **400** : paramètre invalide (par exemple `limit=1000`), avec le champ fautif nommé.
- **404** : identifiant inconnu.
- **401** : clé absente ou invalide.

**Client Python fourni** : `hqo_client.py`, monté dans le système de fichiers Pyodide, expose `HQOClient(base_url, api_key)` avec `get(path, params)` et `paginate(path, params)` (générateur qui suit `next_cursor`), `retry` avec attente exponentielle (1 s, 2 s, 4 s, 3 essais) et respect de `Retry-After`. Les élèves écrivent d'abord leur propre version (exercices du module 4) ; ce client sert de correction commentée.

## 8. Parcours détaillé : 10 modules (0 à 9)

**Sommaire du parcours** (c'est aussi le contenu de la page d'accueil du site)

| N° | Donjon | Semaines | Compétence | Données | Livrable |
| --- | --- | --- | --- | --- | --- |
| 0 | L'Éveil du héros | 1 | Poste de travail, Git, premier appel d'API | Compendium | Dépôt GitHub et README |
| 1 | L'inventaire de la Tablette Sheikah | 1-2 | Excel, raisonnement analytique | `boutique_extrait` | Classeur à 3 onglets |
| 2 | Les archives d'Impa | 2-4 | SQL | `hqo_lite.sqlite` | Fichier `.sql` commenté et synthèse |
| 3 | Le laboratoire de Purah | 4-6 | Statistiques, probabilités, tests A/B | tables d'expériences | Notebook de statistiques |
| 4 | La cartographie du royaume | 6-8 | Python, pandas, API, exploration | Compendium et API fictive | Notebook « Atlas des monstres » |
| 5 | La tour de contrôle | 8-9 | Visualisation et BI | `star_schema` | Tableau de bord et note |
| 6 | La corruption de Ganon | 9-10 | Qualité, Git avancé, reproductibilité | `hqo_corrupted.zip` | Dépôt reproductible |
| 7 | Prédire l'abandon | 10-13 | Machine learning | fichiers `ml/` | Notebook et synthèse de 2 pages |
| 8 | L'Oracle de la Source | 13-14 | IA générative en contexte pro | `reviews` | Audit d'une analyse et classification évaluée |
| 9 | La Triforce | 14-16 | Projet final | au choix | Projet et présentation de 10 minutes |

**Conventions communes à tous les modules**

- Identifiants : leçons `L<module>.<n>`, exercices `E<module>.<n>`, questions `Q<module>.<n>`, boss `B<module>`.
- **QCM** : banque de 20 questions par module, 10 tirées au hasard à chaque passage, ordre des réponses mélangé ; seuil 8 sur 10 ; reprise illimitée ; chaque réponse affiche une explication. Types : choix unique, choix multiple, valeur numérique, « que renvoie ce code ? ». Les exemples donnés ci-dessous sont des modèles à respecter ; l'IA rédige le reste de la banque sur les thèmes listés.
- **Exercice** : énoncé, code de départ, 3 indices progressifs, solution masquée, test automatique ou auto-contrôle, XP.
- **Boss** : épreuve chronométrée sans indices ni solution, une seule tentative par jour, résultat enregistré avec le score et la durée.
- Les valeurs attendues viennent toujours du script de génération (`expected/answers_hashed.json`), jamais d'une saisie manuelle.

### Module 0 : L'Éveil du héros (semaine 1)

**Ordre de mission (Zelda)** : « Prépare ton poste d'analyste et envoie ta première requête vers l'encyclopédie du royaume. »

**Objectifs** : disposer d'un poste fonctionnel, utiliser Git et GitHub, distinguer CSV et JSON, comprendre la notion de grain d'une table, faire un appel d'API, adopter de bons réflexes avec l'IA.

**Leçons**

- L0.1 Le métier aujourd'hui : analyste, data engineer, data scientist, ML engineer, AI engineer, gouvernance (une page, un schéma des rôles).
- L0.2 Installer Python (Anaconda ou uv), VS Code et Git ; vérification par commandes (`python --version`, `git --version`).
- L0.3 Git en six commandes : `clone`, `add`, `commit`, `push`, `pull`, `status`.
- L0.4 Structurer un dépôt de données : `data/`, `notebooks/`, `src/`, `README.md`.
- L0.5 CSV, JSON, lignes, colonnes, grain : « une ligne = quoi ? ».
- L0.6 Premier appel d'API : l'appel réel au Compendium, puis le miroir.
- L0.7 Bien utiliser l'IA : essayer 15 minutes seul, vérifier chaque chiffre, ne jamais coller de données personnelles.

**Exercices**

- E0.1 (Python navigateur, 10 XP) : appeler l'entrée `white-maned_lynel` avec `get_json`, afficher le nom, la catégorie et le nombre de butins. Test : catégorie `monsters` et nombre de butins égal à celui du miroir.
- E0.2 (Python, 15 XP) : charger `compendium_snapshot.json` et compter les entrées par catégorie ; test : la somme des comptes est égale au nombre total d'entrées.
- E0.3 (Python, 15 XP) : lister les 5 monstres ayant le plus de lieux dans `common_locations`, en gérant les valeurs nulles.
- E0.4 (externe, 20 XP) : créer le dépôt GitHub `data-portfolio` avec un README d'au moins 10 lignes ; auto-contrôle : l'élève colle l'URL, la page vérifie seulement son format (`https://github.com/<utilisateur>/data-portfolio`), sans appel réseau.

**QCM : thèmes** : Git, formats de fichiers, grain d'une table, API (statuts HTTP, JSON), usage responsable de l'IA. Exemples : Q0.1 « Que fait `git commit` ? » (enregistre un instantané local des fichiers préparés ; ne l'envoie pas sur GitHub). Q0.2 « Un fichier contient une ligne par commande ; un client a passé 3 commandes. Combien de lignes pour ce client ? » (3 ; il faut dédoublonner pour compter des clients).

**Boss B0 « Gardien de l'entrée »** : 10 questions en 15 minutes, sans XP de boss.

**Livrable et validation** : dépôt `data-portfolio` en ligne, README de 10 lignes minimum. Jeton de validation à 80 % au QCM et E0.1 à E0.3 réussis.

### Module 1 : L'inventaire de la Tablette Sheikah (semaines 1 et 2)

**Ordre de mission (Zelda)** : « Le chiffre d'affaires de la boutique semble faux. Audite l'inventaire avant la réunion de jeudi. »

**Données** : `excel/boutique_extrait.csv` et `.xlsx` (section 6). **Outil** : Excel, LibreOffice Calc ou Google Sheets.

**Leçons** : L1.1 types de données et grain ; L1.2 indicateurs (somme, moyenne, médiane, taux, variation, part) et pourquoi la médiane résiste aux valeurs extrêmes ; L1.3 tableaux structurés, tableaux croisés dynamiques ; L1.4 `RECHERCHEX`, `SOMME.SI.ENS`, `SI` ; L1.5 Power Query : importer et nettoyer ; L1.6 cadrer une question : quelle décision l'analyse éclaire-t-elle ? ; L1.7 devises : pourquoi on n'additionne jamais des euros et des rupees.

**Exercices** (auto-contrôle par formulaire, tolérance indiquée)

- E1.1 Décrire le fichier : nombre de lignes et de colonnes, grain (réponse : une ligne par ligne de commande).
- E1.2 Trouver les 5 anomalies plantées (section 6) ; saisir pour chacune le nombre de lignes concernées (tolérance 0).
- E1.3 Nettoyer avec Power Query, puis calculer le chiffre d'affaires de mars 2026 en RUPEES (tolérance 0,01).
- E1.4 Tableau croisé : top 10 des objets par chiffre d'affaires en RUPEES ; saisir le nom du premier et son total.
- E1.5 Panier moyen en EUR pour la plateforme pc, avec `SOMME.SI.ENS` et `NB.SI.ENS`.
- E1.6 Reformuler 4 demandes floues (« Les ventes vont mal ? », « Qui sont nos bons joueurs ? »…) en question mesurable ; auto-évaluation par grille : population, période, mesure, décision.

**QCM : thèmes** : grain, moyenne et médiane, points et pourcentages, devises, doublons. Exemples : Q1.1 « Un taux passe de 2 % à 3 % : de combien augmente-t-il ? » (1 point de pourcentage, soit +50 % en relatif). Q1.2 « Quel indicateur est le moins sensible aux valeurs extrêmes ? » (la médiane).

**Boss B1 « L'inventaire expert »** (45 minutes) : un second extrait (`boutique_extrait_boss.csv`, autre graine, mêmes anomalies en autres quantités) ; 3 questions numériques.

**Livrable et validation** : classeur à 3 onglets (« Données brutes », « Nettoyage » avec le journal des corrections, « Synthèse » de 5 indicateurs). Validation : QCM 80 %, E1.2 et E1.3 exacts, boss réussi.

### Module 2 : Les archives d'Impa (semaines 2 à 4)

**Ordre de mission (Impa)** : « Les archives du studio sont une base relationnelle. Apprends à les interroger sans te tromper : une jointure fausse double les chiffres. »

**Données** : `hqo_lite.sqlite` chargée dans le navigateur (sql.js). Le diagramme entité-relation (14 tables) est un composant interactif cliquable.

**Leçons**

- L2.1 Modèle relationnel : clés primaires et étrangères, cardinalités 1-n et n-n.
- L2.2 `SELECT`, `WHERE`, `ORDER BY`, `LIMIT`. L2.3 Agrégations, `GROUP BY`, `HAVING`.
- L2.4 Jointures `INNER` et `LEFT`. L2.5 `CASE WHEN`, dates (`strftime`), sous-requêtes et CTE (`WITH`).
- L2.6 Fonctions de fenêtrage : `ROW_NUMBER`, `RANK`, `LAG`, `SUM() OVER`.
- L2.7 Cohortes et rétention. L2.8 Pièges : `NULL`, doublons après jointure (fan-out), division entière de SQLite.
- L2.9 Index et `EXPLAIN QUERY PLAN`.
- Ordre d'exécution logique rappelé partout : `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `SELECT`, `ORDER BY`.

**30 exercices** (10 XP les 10 premiers, 20 XP les 10 suivants, 30 XP les derniers ; l'IA rédige l'énoncé complet, la requête de référence et les 3 indices pour chacun)

- E2.1 à E2.10, simples : joueurs par plateforme ; sessions par mois ; top 5 des pays ; morts moyennes par session avant et après le 10/04/2026 ; part de joueurs premium ; quêtes par type ; rupees moyens par session ; jour de la semaine le plus actif ; joueurs n'ayant jamais joué plus d'une session ; durée médiane des sessions (SQLite n'a pas de `MEDIAN` : à construire).
- E2.11 à E2.20, jointures et CTE : chiffre d'affaires en EUR par catégorie d'objet (commandes `completed`) ; délai entre l'inscription et le premier achat ; joueurs sans commande ; taux de victoire par boss ; régions avec le plus de morts par session ; part de commandes remboursées par canal d'acquisition ; top 10 des joueurs par rupees dépensés ; quêtes jamais tentées ; joueurs ayant battu le premier boss avant J14 ; panier moyen par plateforme.
- E2.21 à E2.30, fenêtrage et cohortes : top 3 des objets par catégorie ; variation mensuelle des inscriptions avec `LAG` ; chiffre d'affaires cumulé par mois ; rétention J1 et J7 par cohorte hebdomadaire ; durée entre deux sessions consécutives ; rang de dépense dans le pays ; courbe de rétention par canal ; moyenne mobile sur 7 jours des sessions ; taux de victoire des boss avant et après le patch 2.3 (CTE) ; joueurs avec au moins 3 défaites d'affilée.
- **5 requêtes à déboguer** (D2.1 à D2.5), chacune volontairement fausse : D2.1 jointure de `sessions` et `orders` sur `player_id` puis `SUM(rupees_earned)` (fan-out : somme gonflée) ; D2.2 filtre sur un agrégat dans `WHERE` au lieu de `HAVING` ; D2.3 `LEFT JOIN` dont le filtre sur la table de droite, placé dans `WHERE`, le transforme en jointure interne ; D2.4 `COUNT(*)` utilisé à la place de `COUNT(colonne)` (ou l'inverse) avec des `NULL` ; D2.5 `SUM(completed) / COUNT(*)` qui renvoie 0 à cause de la division entière.

**QCM : thèmes** : `WHERE` ou `HAVING`, types de jointure, `NULL`, fan-out, fenêtrage, dates, CTE, index. Exemples : Q2.1 « `LEFT JOIN` de commandes vers des paiements ; une commande a 2 paiements ; combien de lignes pour elle ? » (2 : danger de doubler un total). Q2.2 « `COUNT(*)` et `COUNT(colonne)` renvoient-ils toujours la même chose ? » (non : le second ignore les `NULL`). Q2.3 « Quel outil calcule un cumul sans réduire le nombre de lignes ? » (`SUM() OVER (ORDER BY ...)`).

**Boss B2 « Le Gardien des archives »** : 6 questions métier en 90 minutes, sur une seconde base `hqo_boss.sqlite` jamais vue (même schéma, autre graine), sans indices. Succès : 5 questions sur 6 exactes.

**Livrable et validation** : fichier `.sql` commenté (une requête par question) et une page de synthèse (5 enseignements métier tirés des requêtes). Validation : QCM 80 %, au moins 24 exercices sur 30 réussis, boss réussi.

### Module 3 : Le laboratoire de Purah (semaines 4 à 6)

**Ordre de mission (Purah)** : « La récompense Korok marche-t-elle vraiment ? Une direction va décider sur ton chiffre : donne-lui un chiffre juste et ses limites. »

**Données** : tables `experiments`, `experiment_assignments`, `sessions`, `orders`, `players` du jeu complet (chargées en Pyodide via CSV).

**Leçons** (chacune avec un widget interactif quand c'est indiqué)

- L3.1 Statistiques descriptives : moyenne, médiane, variance, écart-type, quantiles, asymétrie.
- L3.2 Probabilités et théorème de Bayes (widget `bayes.js`).
- L3.3 Lois normale, binomiale, de Poisson ; théorème central limite (widget `clt.js` : tirages répétés, distribution des moyennes).
- L3.4 Inférence : échantillon et population, intervalle de confiance, test d'hypothèse, p-value (ce qu'elle est et n'est pas), erreurs de type I et II (widget `ab-calc.js`).
- L3.5 Puissance et taille d'échantillon (widget `power.js`).
- L3.6 Régression linéaire : coefficients, R², hypothèses.
- L3.7 Causalité : corrélation, variables de confusion, biais de sélection, paradoxe de Simpson.
- L3.8 Rédiger une recommandation : résultat, incertitude, décision.

**Exercices** (Python navigateur ; les valeurs attendues sont recalculées par le script sur les données générées, tolérance 0,002 sur les taux et 0,005 sur les p-values)

- E3.1 Simuler 1 000 tirages et visualiser le théorème central limite.
- E3.2 Durées de session : comparer moyenne et médiane, ajuster une loi log-normale, expliquer l'écart.
- E3.3 Régression de `rupees_earned` sur `duration_min` et `deaths` (statsmodels) ; interpréter chaque coefficient en une phrase.
- E3.4 **A/B test EXP\_KOROK\_2026\_02** : taux de rétention J7 par bras, différence, intervalle de confiance à 95 %, test z de deux proportions, taille d'effet, décision écrite en 3 phrases.
- E3.5 Calculer la taille d'échantillon par bras pour détecter +4 points avec 80 % de puissance (environ 1 700).
- E3.6 **EXP\_HEARTS\_2026\_05** : obtenir un résultat non significatif, calculer la puissance réelle (≈ 0,37) et expliquer pourquoi « non significatif » ne veut pas dire « sans effet ».
- E3.7 **EXP\_PACK\_2026\_06** : constater que B gagne au global, puis dans chaque plateforme ; identifier la cause (affectation non aléatoire) ; recommander un nouveau test.
- E3.8 Bayes, détecteur de bots : 0,5 % des comptes sont des bots ; le détecteur repère 98 % des bots et signale à tort 2 % des comptes humains ; probabilité qu'un compte signalé soit un bot (≈ 19,8 %).

**QCM : thèmes** : p-value, intervalles de confiance, puissance, comparaisons multiples, corrélation et causalité, Simpson, Bayes. Exemples : Q3.1 « Une p-value de 0,03 signifie… » (si l'hypothèse nulle était vraie, on observerait un résultat au moins aussi extrême dans 3 % des cas ; ce n'est pas la probabilité que l'hypothèse soit vraie). Q3.2 « Vous testez 20 hypothèses au seuil de 5 % : combien de faux positifs attendez-vous ? » (environ un). Q3.3 « Deux variables sont corrélées à 0,9 : l'une cause-t-elle l'autre ? » (non, pas nécessairement).

**Boss B3 « Décision Korok »** (2 h) : nouveau jeu de résultats d'une expérience (`exp_boss.csv`, autre graine, effet planté différent) ; calculer, tester, puis rédiger un mémo de 150 mots à l'attention de Zelda. Correction automatique des chiffres, plus une grille d'auto-évaluation du mémo (décision claire, incertitude chiffrée, limites).

**Livrable et validation** : notebook « stats-pratiques » avec E3.1 à E3.8 commentés. Validation : QCM 80 %, E3.4 et E3.7 exacts, l'élève explique à voix haute, en moins de 2 minutes, pourquoi un test peut être non significatif alors que l'effet est réel (réponse attendue : manque de puissance).

### Module 4 : La cartographie du royaume (semaines 6 à 8)

**Ordre de mission (Robbie)** : « Zelda veut un atlas : où sont les monstres, que laissent-ils, et où meurent nos joueurs ? Récupère les données toi-même par les API. »

**Données** : snapshot et miroir du Compendium (section 5), API fictive du studio (section 7).

**Leçons** : L4.1 bases du langage (types, listes, dictionnaires, fonctions, boucles, erreurs) ; L4.2 pandas : `read_csv`, filtrage, `groupby`, `merge`, `pivot_table`, dates, chaînes, valeurs manquantes ; L4.3 consommer une API : requêtes, statuts, JSON, pagination, 429, nouvelles tentatives ; L4.4 aplatir du JSON imbriqué (`json_normalize`, `explode`) ; L4.5 exploration méthodique (EDA) ; L4.6 visualisation avec matplotlib et seaborn ; L4.7 jointures approximatives (normaliser casse, espaces, apostrophes).

**Exercices**

- E4.1 Refaire en pandas 5 requêtes SQL du module 2 et comparer les résultats.
- E4.2 Écrire `get_json` avec délai maximal et repli sur le miroir.
- E4.3 Récupérer **tous** les joueurs via `/v1/players` avec `limit=500` en suivant `next_cursor` (24 pages) ; test : 12 000 identifiants uniques.
- E4.4 Gérer le 429 : relancer la boucle avec `limit=100` (120 pages), respecter `Retry-After`.
- E4.5 Gérer le 500 aléatoire : 3 essais avec attente exponentielle.
- E4.6 Aplatir les commandes imbriquées (`lines`) en un tableau d'une ligne par ligne de commande.
- E4.7 Compendium : explorer `common_locations` (listes), le transformer en une ligne par monstre et par lieu.
- E4.8 Jointure des lieux du Compendium avec `regions.region_name` : constater qu'elle perd des lignes (2 à 4 régions diffèrent), normaliser, puis joindre.
- E4.9 Nettoyer : doublons, valeurs manquantes, types, noms en minuscules.
- E4.10 Dangerosité par région : nombre de monstres, nombre de types de butins (Compendium) et morts par session (HQO).
- E4.11 Trois fonctions réutilisables : nettoyage, résumé statistique, graphique standard.
- E4.12 Écrire les 10 questions que l'on peut poser à ces données et répondre à 3 d'entre elles.

**QCM : thèmes** : `merge` et doublons, vectorisation, valeurs manquantes, codes HTTP, pagination, JSON imbriqué. Exemples : Q4.1 « Que fait `df.merge(df2, how='left', on='id')` si `df2` contient des `id` en double ? » (duplique des lignes de `df`). Q4.2 « Que signifie un statut 429 ? » (trop de requêtes : attendre puis réessayer).

**Boss B4 « Le Gardien du code »** (2 h) : un jeu inconnu (`boss_m4.json` imbriqué et sale) à charger, nettoyer et analyser ; 3 conclusions chiffrées ; tests automatiques sur les tableaux produits.

**Mini-projet « Atlas des monstres »** : question de départ : quelles régions sont les plus dangereuses, pour quels monstres et quels butins, et où nos joueurs meurent-ils le plus ? Rendu : notebook lisible de bout en bout (contexte, données, nettoyage, 5 graphiques, conclusion et limites) qui se relance sans erreur (*Restart & Run All*).

**Validation** : QCM 80 %, E4.3, E4.5 et E4.8 exacts, boss réussi, notebook relançable, conclusion comprise par un tiers en 3 minutes.

### Module 5 : La tour de contrôle (semaines 8 et 9)

**Ordre de mission (Zelda)** : « Je veux voir l'état du jeu en 30 secondes chaque lundi, sans demander un rapport à personne. »

**Données** : `star_schema/*.csv` (section 6). **Outil au choix** : Power BI Desktop (Windows), Metabase (open source, via Docker), Looker Studio (gratuit) ou Tableau Public. Les leçons expliquent les notions de façon indépendante de l'outil et donnent les équivalents (mesure DAX, champ calculé, question Metabase).

**Leçons** : L5.1 choisir le bon graphique (comparaison, évolution, répartition, relation) ; L5.2 principes visuels : hiérarchie, couleur avec parcimonie, axe des barres à zéro, titre qui énonce le message ; L5.3 modèle en étoile : faits, dimensions, grain ; L5.4 mesures et colonnes calculées ; L5.5 filtres et interactions ; L5.6 data storytelling : contexte, tension, résolution, action recommandée.

**Exercices**

- E5.1 (interactif dans la page) : 5 graphiques fournis en SVG contenant chacun 6 défauts (axe tronqué, camembert à 12 parts, couleurs inutiles, titre vague…) ; l'élève clique sur les défauts, puis redessine un des graphiques.
- E5.2 Charger le modèle en étoile, créer les relations ; auto-contrôle : nombre de lignes de `fact_sessions` et de `fact_orders`.
- E5.3 Calculer 5 indicateurs : sessions par semaine, joueurs actifs sur 7 jours, chiffre d'affaires en EUR, taux de joueurs payeurs, morts par session ; auto-contrôle sur la semaine du 13 avril 2026.
- E5.4 Tableau de bord d'une page : indicateurs clés, évolution hebdomadaire avec un marqueur vertical au 10/04/2026 (patch 2.3), répartition par région, filtres période, plateforme et canal.
- E5.5 Note d'une page à Zelda : 3 constats chiffrés et 2 recommandations.

**QCM : thèmes** : choix du graphique, axes, mesure ou colonne calculée, grain d'un fait, storytelling. Exemples : Q5.1 « Quel graphique pour comparer l'évolution de 3 régions sur 24 mois ? » (courbes). Q5.2 « Pourquoi l'axe d'un diagramme en barres doit-il commencer à zéro ? » (sinon les écarts sont visuellement exagérés).

**Boss B5 « Test de la tour »** : un tiers (collègue, ami) doit trouver 3 réponses précises en moins de 2 minutes avec le tableau de bord ; checklist d'auto-évaluation à remplir par l'élève avec ce testeur (temps, réussites).

**Livrable et validation** : tableau de bord (fichier ou captures et lien) et note de synthèse. Validation : QCM 80 %, E5.2 et E5.3 exacts, test d'utilisabilité réussi.

### Module 6 : La corruption de Ganon (semaines 9 et 10)

**Ordre de mission (Robbie)** : « Des données corrompues sont arrivées d'un ancien système. Répare-les par un script que n'importe qui peut rejouer. »

**Données** : `corrupted/hqo_corrupted.zip` (8 problèmes décrits en section 6).

**Leçons** : L6.1 dimensions de la qualité (complétude, unicité, validité, cohérence, fraîcheur) ; L6.2 reproductibilité : graine, environnement figé, séparation brut et transformé, scripts plutôt que manipulations manuelles ; L6.3 ETL et ELT, couches brut, nettoyé, métier ; L6.4 contrôles qualité automatisés ; L6.5 Git avancé : branches, pull request, conflit simple ; L6.6 notions de Docker et dbt (démonstrations, hors navigateur) ; L6.7 documenter : README, dictionnaire de données.

**Exercices**

- E6.1 Diagnostic : compter chaque problème (formulaire, tolérance 0).
- E6.2 Normaliser les 3 formats de dates en ISO 8601 UTC.
- E6.3 Normaliser les pays vers les codes ISO2 avec une table de correspondance.
- E6.4 Dédoublonner les joueurs approximatifs avec une clé normalisée ; justifier le choix de l'enregistrement conservé.
- E6.5 Orphelins : choisir entre suppression et mise en quarantaine, avec justification écrite.
- E6.6 Valeurs manquantes non aléatoires : analyser le motif, décider (imputation, catégorie « inconnu » ou suppression) et justifier.
- E6.7 Écrire 12 contrôles qualité automatiques (assertions) et produire un rapport (nombre de violations par règle avant et après).
- E6.8 (externe) Git : créer la branche `fix/cleaning`, ouvrir une pull request, résoudre un conflit simple fourni ; auto-contrôle par questions sur l'état du dépôt.

**QCM : thèmes** : dimensions de la qualité, valeur manquante ou aberrante, graine, brut contre transformé, branches Git. Exemples : Q6.1 « Pourquoi ne jamais modifier le fichier brut ? » (traçabilité et possibilité de rejouer). Q6.2 « Pourquoi fixer une graine ? » (résultats reproductibles).

**Boss B6 « Ganon »** : le script de réparation de l'élève s'exécute dans Pyodide sur le paquet corrompu et subit 12 vérifications cachées (tables nettoyées comparées par hachage, nombre de lignes, aucune dérive de types). Succès : 11 vérifications sur 12.

**Livrable et validation** : dépôt propre (README, structure `data/`, `src/`, `tests/`, `requirements.txt`, script de nettoyage, rapport qualité). Validation : QCM 80 %, boss réussi, un tiers reproduit les résultats en suivant uniquement le README.

### Module 7 : Prédire l'abandon (semaines 10 à 13)

**Ordre de mission (Purah)** : « Avant que les joueurs ne partent, je veux savoir lesquels risquent de le faire, et pourquoi, pour que l'équipe produit agisse. »

**Données** : `ml/ml_churn_players.csv`, `ml/players_snapshot_leaky.csv`, `ml/ml_ltv_players.csv`. **Outil** : scikit-learn dans Pyodide (`HistGradientBoostingClassifier` pour le boosting).

**Leçons** : L7.1 cadrer : classification, régression, regroupement ; quelle métrique sert la décision ? ; L7.2 cycle : jeu d'entraînement, de validation, de test, validation croisée, surapprentissage, compromis biais-variance ; L7.3 algorithmes : régression linéaire et logistique, arbres, forêts, boosting, k-moyennes (intuition avant hyperparamètres) ; L7.4 métriques : précision, rappel, F1, AUC, matrice de confusion, RMSE, MAE ; L7.5 pièges : fuite de données, classes déséquilibrées, dérive dans le temps (patch 2.3), censure à droite ; L7.6 interprétabilité : importance par permutation, présentation de SHAP ; L7.7 intuition d'algèbre linéaire et de gradient (widget de descente de gradient) ; L7.8 éthique et équité : à quoi sert la prédiction, risques d'un ciblage abusif.

**Exercices**

- E7.1 Découpage temporel : entraînement sur les inscrits jusqu'au 31/03/2026, test du 01/04 au 17/05/2026 ; comparer à un découpage aléatoire et expliquer l'écart.
- E7.2 Baseline : prédire la classe majoritaire (exactitude ≈ 72 %) ; expliquer pourquoi c'est trompeur.
- E7.3 Régression logistique dans un `Pipeline` (imputation, encodage, standardisation ajustée sur l'entraînement uniquement) ; AUC attendu ≥ 0,72.
- E7.4 Fuite de données : entraîner sur `players_snapshot_leaky.csv`, obtenir un AUC ≥ 0,97, identifier les colonnes fautives et corriger.
- E7.5 Boosting avec validation croisée à 5 plis ; AUC attendu entre 0,76 et 0,82.
- E7.6 Choix du seuil : une relance inutile coûte 0,5 euro, un joueur perdu 12 euros ; trouver le seuil qui maximise le gain.
- E7.7 Importance par permutation et analyse des erreurs (profils des faux négatifs).
- E7.8 Régression de la dépense à 90 jours (excès de zéros) : comparer prédire la médiane, régression sur `log1p`, et un modèle d'ensemble.
- E7.9 Segmentation comportementale (récence de jeu, fréquence de sessions, rupees gagnés) par k-moyennes avec 4 ou 5 groupes ; nommer chaque groupe et proposer une action.

**QCM : thèmes** : exactitude trompeuse, fuite, déséquilibre, validation croisée, AUC, seuil, dérive. Exemples : Q7.1 « 95 % des clients ne partent pas ; un modèle qui prédit toujours « reste » a 95 % d'exactitude : est-il bon ? » (non, regarder rappel, précision, AUC). Q7.2 « Score de 0,99 en test et 0,60 en production : première hypothèse ? » (fuite de données ou dérive). Q7.3 « Pourquoi découper avant de normaliser ? » (pour éviter que les statistiques du test fuient dans l'entraînement).

**Boss B7 « Le procès de Purah »** : 10 scénarios d'une page ; l'élève trouve l'erreur dans un extrait de notebook (par exemple normalisation avant découpage, mauvaise métrique pour un cas rare, validation aléatoire sur des données temporelles) et répond à 3 questions-pièges : pourquoi cette métrique ? comment savez-vous qu'il n'y a pas de fuite ? que se passera-t-il dans 6 mois ?

**Livrable et validation** : notebook complet du modèle d'abandon (question métier, métrique, baseline, modèle final, analyse des erreurs, 3 recommandations, limites) et synthèse de 2 pages. Validation : QCM 80 %, E7.4 réussi, boss réussi.

### Module 8 : L'Oracle de la Source (semaines 13 et 14)

**Ordre de mission (Oracle)** : « Je peux écrire un rapport en dix secondes. Apprends à vérifier que ce que je dis est vrai. »

**Données** : `reviews/reviews.csv`, `docs/analyse_ia_piegee.md`, snapshot du Compendium.

**Leçons** : L8.1 fonctionnement d'un modèle de langage : jetons, contexte, génération probabiliste, hallucinations, coût et latence ; L8.2 prompting structuré : contexte, tâche, format de sortie, exemples ; L8.3 embeddings et RAG ; L8.4 évaluer : jeu annoté, exactitude, F1, matrice de confusion, intervalle de confiance ; L8.5 RGPD, AI Act (niveaux de risque, transparence), confidentialité ; L8.6 relire de façon critique une analyse produite par une IA.

**Exercices**

- E8.1 **Audit** de `analyse_ia_piegee.md` : 14 paragraphes dont 6 fautifs ; l'élève marque chaque paragraphe (correct ou faux) et nomme le type d'erreur. Les 6 erreurs plantées : (1) chiffre d'affaires doublé par une jointure qui multiplie les lignes ; (2) p-value lue comme la probabilité que l'hypothèse soit vraie ; (3) affirmation de causalité (« le patch 2.3 a provoqué… ») fondée sur une simple coïncidence temporelle ; (4) confusion entre pourcentage et points de pourcentage ; (5) addition d'euros et de rupees ; (6) modèle d'abandon annoncé à 0,98 d'AUC à cause d'une colonne de fuite. Score : erreurs trouvées moins faux positifs.
- E8.2 **Annotation manuelle** : page d'annotation de 50 avis (sentiment, thème) ; la page calcule l'accord avec la référence (kappa de Cohen).
- E8.3 **Classification par modèle de langage** (hors site : clé d'API personnelle de l'élève, jamais saisie dans la page ; notebook de démarrage `starter_notebook.ipynb`) : classer les 200 avis de `reviews_to_classify.csv`, produire `predictions.csv` (review\_id, sentiment, theme), le déposer dans la page qui calcule exactitude et F1 macro dans le navigateur en comparant des hachages, puis comparer 3 formulations du prompt.
- E8.4 (facultatif) Mini-RAG sur le snapshot du Compendium : embeddings locaux, recherche, réponse avec source ; 5 questions de test fournies.
- E8.5 Cas RGPD : « Peut-on coller `players.csv` dans un assistant grand public ? » avec 4 situations et justifications.

**QCM : thèmes** : hallucinations, évaluation, protection des données, niveaux de risque de l'AI Act, biais. Exemples : Q8.1 « Pourquoi un modèle de langage peut-il donner un chiffre faux avec assurance ? » (il génère du texte plausible, il ne calcule ni ne vérifie). Q8.2 « Pourquoi évaluer sur un jeu annoté ? » (mesure objective plutôt qu'une impression).

**Boss B8 « L'œil de l'Oracle »** (30 minutes) : nouvelle analyse piégée `analyse_ia_piegee_boss.md` (16 paragraphes dont 8 fautifs). Succès : au moins 7 erreurs sur 8 trouvées et au plus 1 faux positif.

**Livrable et validation** : rapport d'audit (erreurs trouvées, preuves chiffrées) et notebook de classification avec exactitude mesurée sur les 200 avis. Validation : QCM 80 %, boss réussi.

### Module 9 : La Triforce, projet final (semaines 14 à 16)

**Ordre de mission (Zelda)** : « Montre-moi un projet complet que je pourrais présenter à la direction. »

**Trois voies** (à choisir selon le profil visé) : **Sagesse** (analyste : question métier, SQL, tableau de bord, recommandations) ; **Courage** (data scientist : modèle, évaluation, interprétation, limites) ; **Puissance** (ingénierie : pipeline reproductible depuis l'API fictive, contrôles qualité, documentation, automatisation avec GitHub Actions).

**Sujets proposés**

- Pourquoi les joueurs partent-ils après le patch 2.3 ? (jeu HQO ; l'effet planté du patch est décrit dans `GROUND_TRUTH.md` et sert à corriger, pas à guider).
- Équilibrage : quels boss et quels butins créent de l'abandon ou de la frustration ? (HQO et Compendium).
- Sujet libre dans le domaine de l'élève (santé, sport, énergie, transport, finances publiques) avec données ouvertes (data.gouv.fr, INSEE, Eurostat, Kaggle).

**Jalons** : semaine 14 : cadrage (question métier, décision visée, données, métriques de succès, risques) ; semaine 15 : données nettoyées, exploration, premiers résultats, modèle ou tableau de bord v1 ; semaine 16 : itération, documentation, présentation de 10 minutes plus 3 minutes de questions.

**Contenu attendu** : dépôt GitHub propre et reproductible ; au moins une requête SQL non triviale, une analyse statistique justifiée, un modèle ou un tableau de bord ; un README qui raconte contexte, méthode, résultats, limites et pistes ; une présentation orale.

**Grille d'évaluation (sur 100)** : question métier claire et décision visée 15 ; qualité et traitement des données 20 ; rigueur méthodologique (statistiques, validation, absence de fuite) 20 ; visualisation et lisibilité 15 ; reproductibilité et propreté du code 15 ; communication, limites, recommandations 15. Seuil de validation : 70 sur 100. La page du module contient une grille d'auto-évaluation et un modèle de README.

## 9. Formats de contenu (QCM, exercices, progression, jetons)

Tout le contenu pédagogique vit dans des fichiers JSON que les pages lisent ; aucune réponse ou valeur attendue n'est écrite en clair dans le code des pages. `scripts/build_hashes.py` produit les hachages à partir des données générées.

**Manifeste de module** (`modules/m2-archives/manifest.json`)

```json
{ "id": "m2", "title": "Les archives d'Impa", "weeks": "2-4", "guide": "Impa",
  "mission": "Texte de l'ordre de mission (5 lignes maximum)",
  "lessons": [ { "id": "L2.1", "title": "Modèle relationnel", "file": "lesson-01.html", "minutes": 25 } ],
  "quiz": "quiz.json", "exercises": "exercises.json", "boss": "boss.json",
  "deliverable": { "label": "Fichier .sql commenté et synthèse", "check": "self" },
  "pass": { "quiz_min": 0.8, "exercises_min": 0.8, "boss_required": true } }
```

**Question de QCM** (`quiz.json`, tableau de 20 éléments)

```json
{ "id": "Q2.2", "type": "single", "prompt": "COUNT(*) et COUNT(colonne) renvoient-ils toujours la même valeur ?",
  "options": [ { "id": "a", "text": "Oui" }, { "id": "b", "text": "Non, COUNT(colonne) ignore les NULL" } ],
  "answer_hash": "sha256 de « Q2.2|b|sel_du_projet »", "explanation": "Texte pédagogique de 1 à 3 phrases.",
  "tags": ["null", "agregation"], "difficulty": 1, "xp": 5 }
```

Types : `single`, `multi` (réponses triées avant hachage), `numeric` (avec `tolerance`), `code_output` (que renvoie ce code ?). Le sel du projet est public : le hachage évite seulement de laisser la réponse lisible d'un coup d'œil.

**Exercice** (`exercises.json`)

```json
{ "id": "E2.11", "module": "m2", "type": "sql", "title": "Chiffre d'affaires par catégorie",
  "statement": "Énoncé complet en français.", "dataset": "hqo_lite.sqlite",
  "starter": "SELECT ...", "expected_hash": "sha256 du résultat normalisé",
  "order_matters": false, "float_round": 2,
  "hints": ["Indice 1", "Indice 2", "Indice 3"], "solution": "requête de référence", "xp": 20 }
```

- `type: "python"` ajoute `files` (fichiers à monter dans `/data`), `starter`, `tests` (code `assert` exécuté après celui de l'élève) et `timeout_s`.
- `type: "external"` ajoute `form` : liste de champs `{ "label", "kind": "number" | "text" | "choice", "expected_hash", "tolerance" }`.
- `type: "upload"` (module 8) : fichier déposé par l'élève, évalué dans le navigateur par comparaison de hachages.

**Progression** (`localStorage`, clé `hqo_progress_v1`, exportable en fichier JSON)

```json
{ "version": 1, "alias": "Link42", "xp_total": 480, "badges": ["premiere_requete"],
  "modules": { "m2": { "quiz": { "best": 9, "max": 10, "attempts": 2 },
    "exercises": { "E2.1": { "done": true, "xp": 10, "hints_used": 1 } },
    "boss": { "score": 5, "max": 6, "seconds": 4100, "passed": true },
    "deliverable_url": "https://github.com/...", "hearts": 3, "completed_at": "2026-09-30" } },
  "error_journal": [ { "date": "2026-09-20", "module": "m2", "cause": "...", "fix": "..." } ] }
```

**Jeton de validation de module** : chaîne `base64url(charge).empreinte`, où la charge est un JSON `{ alias, module, hearts, xp, date, nonce }` et l'empreinte les 16 premiers caractères hexadécimaux du SHA-256 de `charge + sel_du_projet`. La page `teacher.html` vérifie un jeton ou un fichier de progression collé, entièrement dans le navigateur. Limite assumée : le sel étant public, ce n'est pas infalsifiable ; c'est suffisant pour un suivi à faible enjeu. Si l'enseignant a besoin d'une vraie preuve, les boss et le test de sortie se passent en présence du formateur.

## 10. Évaluation, validation et certification

**Validation d'un module** : QCM à 8 sur 10 ou plus, au moins 80 % des exercices réussis, boss réussi (sauf module 0, où il est facultatif), livrable déclaré (URL de dépôt). À la validation, la page affiche les 3 cœurs et délivre le jeton.

**Validation du parcours** : les modules 0 à 8 validés, projet final à 70 sur 100 au minimum (module 9), test de sortie à 70 % au minimum.

**Test de sortie** (semaine 16, 3 heures, sans IA, nouvelles données `exit_*` générées avec une autre graine)

- 1 h de SQL : 6 questions métier sur `hqo_exit.sqlite`, 5 exactes minimum.
- 1 h de Python : nettoyer et analyser `exit_dataset.json` (JSON imbriqué et sale), produire 3 conclusions chiffrées vérifiées automatiquement.
- 1 h de statistiques et de machine learning : interpréter le résultat d'un test A/B (décision, incertitude) et repérer 2 erreurs dans un notebook fourni (fuite de données, mauvaise métrique).

**XP et niveaux** : le total d'XP disponible est calculé par script à partir des fichiers d'exercices. Niveaux : Apprenti (0 à 24 % du total), Chevalier (25 à 49 %), Maître de l'épée (50 à 74 %), Sage de Hyrule (75 % et plus). Les badges sont définis dans `assets/js/core/badges.json` (condition, nom, texte).

**Attestation** : `certificat.html` génère une attestation imprimable (feuille de style d'impression) listant les jetons et les compétences validées. Mention obligatoire : attestation d'auto-suivi, non diplômante.

**Suivi par l'enseignant** : `teacher.html` agrège des fichiers de progression collés ou déposés (tableau par élève : modules validés, XP, dates, durées des boss), sans serveur ni stockage.

## 11. Plan de travail conseillé pour l'IA et contrôle qualité

**Ordre de travail**

1. **Vérifications préalables** : lire la documentation du Compendium, vérifier les routes et l'état de l'hôte, vérifier que Pyodide propose bien pandas, scipy, statsmodels, matplotlib et scikit-learn (versions épinglées), vérifier les limites de l'hébergeur. Consigner dans `DECISIONS.md`.
2. **Données** : écrire `generate_hqo_dataset.py` et `test_dataset.py`, produire tous les fichiers de `data/`, puis `build_hashes.py`. Ne pas avancer tant que les tests d'acceptation ne passent pas.
3. **Bibliothèque commune** : runners SQL et Python, faux serveur d'API, QCM, progression, jetons, widgets.
4. **Coque du site** : page d'accueil (carte du royaume), gabarit de module, thème, accessibilité.
5. **Modules dans l'ordre 0 à 9** : pour chacun, leçons, `quiz.json` (20 questions), `exercises.json`, `boss.json`, `manifest.json`. Après chaque module, exécuter les contrôles ci-dessous.
6. **Outils enseignant et attestation**, mode hors ligne, README.
7. **Recette finale** : parcours complet d'un « élève fictif » (script de bout en bout).

**Tests d'acceptation des données** (`test_dataset.py`, valeurs cibles avec tolérance)

| Contrôle | Cible |
| --- | --- |
| Nombre de joueurs | 12 000 ± 3 % |
| Sessions, commandes | 135 000 à 165 000 ; 8 000 à 10 000 |
| Rétention J7 du groupe de contrôle | 20 % ± 1,5 point |
| EXP\_KOROK : différence de rétention J7 | +4 ± 1,5 points, p < 0,01 |
| EXP\_HEARTS : p-value | entre 0,08 et 0,20 |
| EXP\_PACK : paradoxe de Simpson | B supérieur à A au global ; B inférieur à A dans chaque plateforme |
| Prévalence de l'abandon | 28 % ± 1,5 point |
| Taille de `ml_churn_players.csv` | 2 800 à 4 500 lignes |
| AUC régression logistique ; boosting ; fichier avec fuite | ≥ 0,72 ; 0,76 à 0,82 ; ≥ 0,97 |
| Anomalies plantées (extrait Excel et paquet corrompu) | comptes exacts de la section 6 |
| Intégrité référentielle des tables propres | 100 % des clés étrangères valides |
| Données personnelles | aucune (contrôle par motifs : e-mail, téléphone, IP) |
| Reproductibilité | même graine, mêmes empreintes SHA-256 de fichiers |
| Sous-ensemble lite | inclus dans le complet, moins de 4 Mo |

**Contrôles du site**

- La solution de référence de chaque exercice passe son propre test (script automatisé : SQL via Node et sql.js, Python via CPython, plus un test de fumée Pyodide par module).
- Chaque question de QCM a une explication et une réponse unique ou clairement définie ; aucune réponse en clair dans le code.
- Aucune requête réseau hors CDN épinglés et appel optionnel au Compendium ; aucun secret ; aucun traceur.
- Liens relatifs fonctionnels sous un sous-chemin ; audit d'accessibilité (cible : score Lighthouse d'accessibilité d'au moins 90) ; affichage correct à 360 px de large.
- Les chiffres cités dans le texte des leçons proviennent d'un fichier généré (`expected/facts.json`), jamais écrits à la main.

**Style** : français, tutoiement, phrases de moins de 25 mots, une idée par paragraphe, vocabulaire technique défini à sa première apparition, exemples tirés de l'univers HQO.

**Prompt de démarrage à copier-coller pour l'IA destinataire**

```text
Tu es l'ingénieur pédagogique et développeur du projet décrit dans le cahier des charges ci-joint.
Lis-le en entier avant d'écrire la moindre ligne. Travaille dans l'ordre de la section 11.
Commence par les vérifications préalables (API Compendium, Pyodide, limites d'hébergement) et
rédige docs/DECISIONS.md. Ne passe à l'étape suivante que lorsque les contrôles de l'étape en cours
passent. Ne rédige jamais un chiffre à la main : il doit sortir d'un script. En cas d'ambiguïté,
choisis l'option la plus simple, note-la dans DECISIONS.md et continue. Rends compte à la fin de
chaque étape : ce qui est fait, ce qui est testé, ce qui reste à vérifier.
```

## 12. Hypothèses, points à vérifier et risques

**Hypothèses de ce cahier des charges**

- Public francophone, adulte, sans prérequis en code, avec un ordinateur (les modules 5, 6 et 9 supposent un poste et non un téléphone).
- Un formateur ou le concepteur du cours assure les corrections humaines (mémos, présentations, projet final) ; le site corrige seulement ce qui est automatisable.
- Un seul univers narratif (Zelda) ; les données HQO sont entièrement fictives.

**Points à vérifier avant de coder**

- Compendium : hôte, routes, champs par catégorie, CORS, nombre d'entrées (section 5).
- Pyodide : disponibilité et versions de pandas, scipy, statsmodels, scikit-learn ; durée du premier chargement sur un téléphone moyen ; alternative DuckDB-WASM si sql.js est trop limité pour les fonctions de fenêtrage.
- Hébergement : limites de taille et de bande passante de GitHub Pages (ou de l'alternative choisie).
- Outils de BI : Power BI Desktop n'existe que sous Windows ; garder Metabase, Looker Studio et Tableau Public comme alternatives documentées.

**Risques et parades**

| Risque | Parade |
| --- | --- |
| L'API du Compendium disparaît | Miroir statique et mode hors ligne (section 5) |
| Droits sur l'univers Zelda (marque et œuvres de Nintendo) | Aucune image, musique, ni texte officiel redistribués ; snapshot sans `description` ni `image` ; mention dans le pied de page : « Projet pédagogique indépendant, non affilié à Nintendo. Zelda est une marque de Nintendo. » ; pour une diffusion publique ou commerciale, remplacer les noms de personnages et de lieux par des noms génériques et faire valider juridiquement (ce document ne constitue pas un avis juridique) |
| Réponses lisibles dans le navigateur | Hachages ; boss en présence du formateur si l'enjeu l'exige |
| Poids de Pyodide et lenteur sur mobile | Chargement paresseux, cache, message d'attente, alternative en local (notebook Jupyter) |
| Données irréalistes | Règles de génération documentées, tests d'acceptation, comparaison avec les ordres de grandeur du cours |
| Dérive des versions de bibliothèques | Versions épinglées, `DECISIONS.md`, test de fumée à chaque mise à jour |

**Questions ouvertes à trancher avec le concepteur du cours**

- Garde-t-on les noms Zelda (usage privé) ou des noms génériques dès le départ ?
- Outil tableur et outil de BI par défaut ?
- Qui corrige les mémos, présentations et projets finaux, et selon quel calendrier ?
- Le jeton de validation suffit-il, ou faut-il une plateforme de rendu des boss plus stricte ?
