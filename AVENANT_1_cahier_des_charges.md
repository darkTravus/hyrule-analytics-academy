# Avenant n°1 : combat de boss, correction automatique, distribution

Cet avenant complète le cahier des charges « Chroniques d'Hyrule Analytics ». **En cas de conflit, l'avenant l'emporte.** Il doit être donné à l'IA destinataire avec le cahier, et le prompt de démarrage (section 11) gagne une ligne : « Lis aussi l'avenant n°1 ; il prime sur le cahier. »

## 1. Décisions prises

| Sujet | Décision |
| --- | --- |
| QCM | Remplacé par un **combat de boss** (section 2) |
| Noms Zelda | Conservés (usage privé), mais centralisés dans un seul fichier pour pouvoir les remplacer d'un coup (section 3) |
| Outils par défaut | **Excel** (module 1) et **Power BI Desktop** (module 5) |
| Correction des livrables | **GitHub Actions** dans le dépôt de l'élève, avec le **même script** exécutable en local (section 5) |
| Plateforme de rendu des boss plus stricte | **Non retenue** : le jeton et la CI suffisent pour un suivi à faible enjeu ; l'enjeu élevé passe par l'épreuve en présence du formateur (section 5.5) |
| Distribution | Deux dépôts : le **cours** (site web + données + correcteur) et un **dépôt-modèle élève** (section 6) |

**Vocabulaire à appliquer partout dans le cahier.** « Combat » désigne l'ancien QCM. L'ancienne « épreuve de boss » chronométrée (B0 à B9) devient « **épreuve du donjon** » : ses identifiants `B<n>` et ses noms (« Gardien de l'entrée »…) ne changent pas. Le mot « boss » est réservé au combat.

## 2. Combat de boss (remplace le QCM)

### 2.1 Principe

Chaque module se valide d'abord par un duel contre un ennemi. Une bonne réponse inflige des dégâts à l'ennemi, une mauvaise en inflige à l'élève. Le combat s'arrête quand l'ennemi ou l'élève s'effondre. Reprise illimitée, avec une nouvelle graine à chaque tentative.

### 2.2 Règles (valeurs par défaut, surchargeables par module)

| Élément | Valeur |
| --- | --- |
| Points de vie (PV) | Élève 100, ennemi 100. Le mot « cœurs » reste réservé à la validation du module (3 cœurs). |
| Bonne réponse | Dégâts à l'ennemi selon la difficulté de la question : 8 (niv. 1), 10 (niv. 2), 14 (niv. 3) |
| Mauvaise réponse | Dégâts à l'élève : 40 (niv. 1), 34 (niv. 2), 26 (niv. 3). Rater une question de base coûte plus cher. |
| Frappe critique | À partir de 3 bonnes réponses d'affilée, les dégâts sont multipliés par 1,5 |
| Phase 2 | Quand l'ennemi passe à 50 PV ou moins, les erreurs coûtent 20 % de plus et les questions viennent des niveaux 2 et 3 (phase 1 : niveaux 1 et 2) |
| Fin | Ennemi à 0 PV : **victoire**. Élève à 0 PV : **défaite**. Banque épuisée : celui qui a le plus de PV restants en proportion gagne. |
| Types de questions | Les quatre types du cahier (`single`, `multi`, `numeric`, `code_output`). Une réponse `multi` est tout ou rien. |
| Après chaque réponse | Affichage de l'explication (obligatoire pour chaque question) avant la suite |

**Banque** : 20 questions par module, de répartition **8 de niveau 1, 8 de niveau 2, 4 de niveau 3**. Le champ `difficulty` de `quiz.json` prend donc les valeurs 1 à 3 et le champ `xp` disparaît des questions. Les questions s'enchaînent dans un ordre mélangé par la graine du combat, jamais deux fois la même.

### 2.3 Équivalence avec l'ancien seuil de 80 %

Les dégâts ont été réglés pour que le combat soit aussi sélectif que l'ancien « 8 bonnes réponses sur 10 ». Résultats d'une simulation de 20 000 combats par ligne (`scripts/balance_sim.mjs`, qui utilise le vrai moteur) : probabilité de gagner selon la justesse réelle de l'élève.

| Justesse réelle | 50 % | 60 % | 70 % | 80 % | 90 % | 100 % |
| --- | --- | --- | --- | --- | --- | --- |
| Victoire au combat | 5,1 % | 15,8 % | 37,5 % | 67,2 % | 92,8 % | 100 % |
| Ancien QCM (≥ 8/10) | 5,5 % | 16,7 % | 38,3 % | 67,8 % | 93,0 % | 100 % |

Un combat dure en moyenne 6 à 9 questions selon le niveau de l'élève. Une simplification à connaître : la simulation suppose la même justesse sur toutes les difficultés. Si les statistiques réelles montrent que les questions de niveau 3 sont bien plus ratées, on ajustera les dégâts, pas la structure.

### 2.4 Récompenses et validation

- **Validation** : l'ancienne condition « QCM ≥ 80 % » devient « **combat gagné** ». Le premier cœur du module est acquis à la première victoire.
- **XP** : 50 XP à la première victoire du module (comme l'ancien QCM réussi), pas de XP supplémentaire pour les victoires suivantes.
- **Badges** (à ajouter à `badges.json`) : `zero_degat` (victoire sans perdre de PV), `coup_critique` (première frappe critique), `chevalier_tenace` (victoire après au moins 3 défaites sur le même module).
- **Progression** : dans `hqo_progress_v1`, le champ `modules.<id>.quiz` est remplacé par :

```json
"fight": { "won": true, "attempts": 3,
           "best": { "rounds": 9, "accuracy": 0.89, "pv_left": 66, "flawless": false, "seconds": 410 } }
```

### 2.5 Ennemis par module (noms Zelda conservés)

| Module | Ennemi | Module | Ennemi |
| --- | --- | --- | --- |
| 0 | Bokoblin | 5 | Molduga |
| 1 | Chuchu | 6 | Ganon |
| 2 | Lizalfos | 7 | Lynel |
| 3 | Moblin | 8 | Gardien (Guardian) |
| 4 | Hinox | 9 | Ganondorf |

L'IA contrôle chaque nom contre le snapshot du Compendium et note dans `DECISIONS.md` ceux qu'elle n'a pas pu vérifier (règle du cahier : ne rien inventer sur Zelda). **Aucune image ni sprite officiel** : l'ennemi est représenté par un dessin SVG original très simple ou un pictogramme.

### 2.6 Interface

```text
┌──────────────────────────────────────────────┐
│  LIZALFOS            ████████░░░░  62/100 PV │
│  Phase 1                                     │
├──────────────────────────────────────────────┤
│  Q2.7 (niveau 2)         Série : 2 ✦         │
│  Quel outil calcule un cumul sans réduire    │
│  le nombre de lignes ?                       │
│   ( ) GROUP BY   ( ) SUM() OVER (ORDER BY…)  │
│   ( ) HAVING     ( ) DISTINCT                │
│                      [ Attaquer ]            │
├──────────────────────────────────────────────┤
│  TOI                 ██████░░░░░░  58/100 PV │
└──────────────────────────────────────────────┘
```

Contraintes d'accessibilité : aucun chronomètre par question (le temps total est seulement mesuré) ; animations coupées avec `prefers-reduced-motion` ; barres de PV doublées d'un texte chiffré ; résultat de chaque coup annoncé dans une zone `aria-live` ; réponses choisies au clavier (touches 1 à 4) ; jamais la couleur seule pour distinguer un coup réussi d'un coup raté.

### 2.7 Code fourni

- `assets/js/core/boss-fight.js` : moteur pur (aucun DOM) : `createFight`, `nextQuestion`, `resolve`, `summary`. Reproductible : même graine, même enchaînement.
- `quiz.js` garde la correction par hachage et appelle `resolve(state, id, correct)`.
- Test d'acceptation à ajouter à la section 11 : `scripts/balance_sim.mjs` doit donner une victoire entre 60 % et 75 % à 80 % de justesse, et moins de 10 % à 50 %.

## 3. Noms Zelda et habillage

- Les noms de guides, d'ennemis et de régions viennent d'un fichier unique `assets/data/lore.json`. Aucune page ne les écrit en dur.
- Pour une diffusion publique ou commerciale, remplacer ce fichier suffit (le reste de la section 12 du cahier sur les droits est inchangé).
- Pied de page conservé : « Projet pédagogique indépendant, non affilié à Nintendo. Zelda est une marque de Nintendo. »

## 4. Outils par défaut

- **Module 1** : Excel (Power Query et tableaux croisés dynamiques). LibreOffice Calc et Google Sheets restent des alternatives documentées, sans support de Power Query complet.
- **Module 5** : **Power BI Desktop** pour toutes les consignes et captures. Les notions restent expliquées indépendamment de l'outil (mesure DAX, équivalents ailleurs), mais Metabase, Looker Studio et Tableau Public ne sont plus qu'un « plan B » en annexe.
- **Risque à traiter** : Power BI Desktop n'existe que sous Windows. La page du module 5 l'indique en première ligne, avec le plan B pour les élèves sous macOS ou Linux. À vérifier avant la mise en ligne : l'état de la version web de Power BI pour des élèves sans licence payante.
- **Livrable du module 5** : `m5/dashboard.pbix`, `m5/capture.png`, `m5/note.md`. Un `.pbix` est un fichier binaire : Git ne le compare pas et la CI ne le lit pas. Elle contrôle sa présence, et les valeurs des indicateurs passent par `results.json` (section 5.3).

## 5. Correction automatique des livrables

### 5.1 Choix retenu : GitHub Actions + même script en local

| Critère | GitHub Actions dans le dépôt de l'élève |
| --- | --- |
| Coût | Gratuit. Dépôt **public** : minutes illimitées sur les exécuteurs standard. Dépôt **privé** (plan GitHub Free) : 2 000 minutes par mois (d'après la documentation GitHub et des comparatifs récents, consultés en novembre 2026). |
| Serveur à entretenir | Aucun |
| Cohérence | Le script `grading/grade.py` est le même en local (`python grading/grade.py --module m2`) et dans la CI : l'élève voit son résultat avant de pousser |
| Retour à l'élève | Onglet *Actions*, résumé en Markdown de la tâche, rapport JSON téléversé |

Alternatives écartées : GitHub Classroom (impose une organisation et une liste d'élèves, sans bénéfice à ce volume) ; plateforme tierce de rendu (compte, quotas, risque de coût).

### 5.2 Fonctionnement

1. L'élève travaille dans son dépôt (créé depuis le dépôt-modèle, section 6) et pousse sur `main`.
2. Le workflow détecte les dossiers `m0` à `m9` modifiés (ou le module demandé en lancement manuel).
3. Il récupère le dépôt du cours **à une étiquette figée** (`v1.0.0`) : les seuils ne changent pas en cours de parcours.
4. `grade.py` applique le contrôle du module, écrit un rapport JSON et un résumé lisible, et termine en erreur (croix rouge) si le seuil n'est pas atteint.
5. Le rapport contient un **jeton** (16 caractères d'empreinte du module, du score, du commit et du sel). La page du module sur le site accepte le rapport collé et passe le livrable à « validé par la CI ».

Le workflow n'a aucun secret et seulement le droit de lecture (`permissions: contents: read`). Il ne s'exécute pas sur les `pull_request` venant de forks.

### 5.3 Contrat de livrable par module

| Module | Fichiers attendus dans le dépôt élève | Contrôle automatique | Seuil | Reste humain |
| --- | --- | --- | --- | --- |
| 0 | `README.md` (≥ 10 lignes), `data/`, `notebooks/`, `src/`, `m0/results.json` | Structure, E0.1 à E0.3 | 100 % | Rien |
| 1 | `m1/classeur.xlsx` (3 onglets nommés), `m1/results.json` | Onglets, ≥ 5 valeurs dans « Synthèse », E1.2 à E1.5 | 80 %, E1.2 et E1.3 exacts | Qualité des reformulations (E1.6) |
| 2 | `m2/queries.sql` (une requête par bloc `-- E2.11`) | Chaque requête est exécutée sur `hqo_lite.sqlite` en lecture seule (SELECT et WITH uniquement, 10 s maximum) puis comparée par empreinte ; ≥ 80 % des requêtes commentées | **24 sur 30** | Synthèse de 5 enseignements |
| 3 | `m3/stats_pratiques.ipynb`, `m3/results.json` | Notebook exécuté et sans erreur, valeurs de E3.1 à E3.8 | 80 %, E3.4 et E3.7 exacts | Mémo de 150 mots, explication orale |
| 4 | `m4/atlas_monstres.ipynb`, `m4/results.json` | Idem + E4.3, E4.5, E4.8 exacts | 80 % | Lisibilité de la conclusion |
| 5 | `m5/dashboard.pbix`, `m5/capture.png`, `m5/note.md` (≥ 150 mots), `m5/results.json` | Présence, longueur de la note, valeurs de E5.2 et E5.3 | 80 %, E5.2 et E5.3 exacts | Test d'utilisabilité, note |
| 6 | `src/clean.py`, `tests/`, `requirements.txt`, `README.md` | La CI **exécute le script** sur `data/raw/` et compare les tables nettoyées par empreinte | **11 sur 12** | Reproduction par un tiers |
| 7 | `m7/churn.ipynb`, `m7/results.json` | Notebook propre, E7.4, AUC déclarées dans les fourchettes (régression 0,72 à 0,90 ; boosting 0,76 à 0,82) | 80 % | Épreuve des 10 scénarios, synthèse |
| 8 | `m8/predictions.csv` (200 lignes), `m8/classification.ipynb`, `m8/results.json` | Exactitude calculée par comparaison d'empreintes avec la référence | **≥ 70 %** | Rapport d'audit |
| 9 | `README.md` (≥ 40 lignes), `tests/`, `requirements.txt` | **Structure seulement** | Structure complète | **Toute la note sur 100** (seuil 70) |

**Limites assumées** : les AUC du module 7 sont déclarées, non recalculées (la CI n'a pas les prédictions) ; un `.pbix` n'est pas lisible ; le module 9 n'est pas noté automatiquement. Les modèles de projet donnent des fourchettes de seuils à valider avec les vraies données générées : les seuils ci-dessus sont des **valeurs initiales** (fichier `grading/thresholds.json`).

### 5.4 Formats techniques (à respecter côté site ET côté correcteur)

- **`results.json`** : `{ "E3.4": { "diff": 0.04, "p_value": 0.002 }, "E0.1": { "category": "monsters" } }`. Le site le génère depuis les formulaires d'auto-contrôle (bouton « Exporter mes résultats »), l'élève le dépose dans le dossier du module.
- **`data/expected/answers_hashed.json`** : `{ "salt": "…", "items": { "E3.4.diff": { "kind": "num", "tol": 0.002, "hash": "…" }, "E2.11": { "kind": "sql", "order_matters": false, "hash": "…" } } }`. Types : `num`, `text`, `sql`.
- **Empreinte canonique** (`grading/hashing.py` côté Python, `assets/js/core/canon.js` côté site) : nombres à deux décimales (arrondi du demi à l'écart de zéro, jamais `-0.00`), `NULL` devient une chaîne vide, noms de colonnes ignorés, lignes triées par point de code Unicode sauf `ORDER BY` imposé. Les deux implémentations ont été comparées sur des cas limites (demis exacts, négatifs, accents, émojis) et donnent la même empreinte.
- **Tolérance numérique** : les valeurs sont rangées dans des cases de largeur `tol` ; la case voisine est acceptée. La tolérance effective est donc comprise entre 0 et 2 × `tol` : à garder en tête pour les p-values.
- **Test d'acceptation à ajouter à la section 11** : `python grading/selftest.py` doit afficher `selftest OK` (la solution de référence passe, une copie dégradée échoue), et `build_hashes.py` doit utiliser `grading/hashing.py` (source unique du format).

### 5.5 Ce que cette solution ne garantit pas

Le sel et les empreintes sont publics, comme le cahier l'admet déjà : un élève déterminé peut retrouver une réponse numérique par force brute ou en lisant le code. Parades, par ordre d'efficacité : épreuves du donjon et test de sortie **en présence du formateur** avec des jeux de données à graine inédite ; un fichier de réponses privé que le formateur passe à la main (`--private-answers`) pour les modules à enjeu ; une graine différente à chaque promotion. Pour un parcours d'auto-formation, la CI sert à donner un retour fiable, pas à certifier.

## 6. Hébergement et distribution

### 6.1 Deux dépôts, trois façons de suivre le cours

| Dépôt | Propriétaire | Contenu | Visibilité |
| --- | --- | --- | --- |
| `hyrule-analytics-academy` | Toi | Site, données, `grading/`, `data/expected/`, versions étiquetées (`v1.0.0`…) | Public, publié sur GitHub Pages |
| `hyrule-student-workspace` | Toi, marqué *template repository* | `README.md`, dossiers `m0` à `m9` avec un `CONSIGNES.md` chacun (contrat de la section 5.3), `requirements.txt`, `.github/workflows/grade.yml`, `scripts/fetch_data.py` | Public |

- **Voie A, en ligne** : l'élève ouvre l'URL GitHub Pages. Les modules 2, 3, 4, 6 et 7 s'exécutent dans le navigateur. Ses livrables vont dans son propre dépôt.
- **Voie B, en local** : `git clone` du dépôt du cours, puis `python -m http.server` dans le dossier : le site fonctionne depuis `localhost` (l'ouverture directe d'un fichier `index.html` échoue à cause des modules JavaScript, des Web Workers et de `fetch`). Le premier chargement de Pyodide demande Internet ; le service worker du cahier permet ensuite le mode hors ligne.
- **Voie C, tout en local** : l'élève suit les consignes avec VS Code et Jupyter, et récupère les données avec `python scripts/fetch_data.py` (bibliothèque standard seule, télécharge depuis l'URL Pages dans `data/`) ou par `git clone --depth 1` du cours.

### 6.2 Pourquoi un modèle plutôt qu'un fork

Un dépôt créé par « Use this template » a son propre historique, peut rester privé et ne garde pas de lien avec ton dépôt ; un fork public expose les solutions et invite à ouvrir des pull requests vers ton cours. L'élève ne pousse donc **jamais** dans le dépôt du cours.

### 6.3 Consignes de visibilité pour l'élève

- **Public (recommandé)** : minutes de CI illimitées, et le dépôt sert de portfolio pour candidater (c'est l'objectif du parcours). Inconvénient : les solutions sont visibles par les autres élèves.
- **Privé** : possible, dans la limite du quota mensuel gratuit. Le temps d'une exécution n'est pas encore mesuré : le mesurer sur chaque module pendant la recette, le module 6 (exécution du script) étant le plus long.

### 6.4 Mise à jour du cahier (sections touchées)

| Section du cahier | Modification |
| --- | --- |
| 1 (livrables) | Ajouter : `boss-fight.js`, `canon.js`, `grading/` (correcteur, seuils, auto-test), `scripts/balance_sim.mjs`, dépôt-modèle élève |
| 3 (arborescence, hébergement) | Ajouter `grading/` et `assets/data/lore.json` ; décrire les voies A, B et C |
| 4 (gamification) | « QCM réussi 50 XP » devient « combat gagné 50 XP » ; 3 nouveaux badges ; noms des ennemis (2.5) |
| 8 (conventions) | Remplacer la phrase « QCM : banque de 20 questions, 10 tirées, seuil 8 sur 10 » par la section 2 ; renommer « boss » en « épreuve du donjon » ; chaque module précise le contrat de livrable (5.3) |
| 9 (formats) | `difficulty` de 1 à 3, `xp` retiré des questions ; `quiz` remplacé par `fight` dans la progression ; formats de `results.json` et de `answers_hashed.json` (5.4) |
| 10 (validation) | « QCM à 8 sur 10 » devient « combat gagné » ; les livrables sont contrôlés par la CI |
| 11 (tests) | Ajouter `balance_sim.mjs`, `selftest.py`, la parité JS/Python des empreintes |
| 12 (questions ouvertes) | Les trois premières sont tranchées (sections 1, 3 et 4). La quatrième l'est aussi (5.1 et 5.5). Reste ouvert : **le délai de correction humaine** des mémos, présentations et projets finaux. |

## 7. Points encore à vérifier

- Durée réelle d'une exécution de la CI par module, et disponibilité de `jq` et des versions d'actions épinglées sur l'image `ubuntu-24.04` (le workflow s'appuie dessus).
- Seuils de `thresholds.json` à recalibrer une fois les données générées.
- Limites de GitHub Pages au moment de la mise en ligne (taille du site, déjà notée au cahier).
- Version web de Power BI pour les élèves hors Windows.
- Noms d'ennemis du tableau 2.5 contre le snapshot du Compendium.
- **Non livrés avec cet avenant** (à produire par l'IA destinataire, à partir de leur description) : l'interface du combat (maquette en 2.6), `scripts/fetch_data.py`, les `CONSIGNES.md` du dépôt-modèle, `build_hashes.py`, les contrôles du module 6 (12 tables nettoyées) et du module 8 sur de vraies données.
