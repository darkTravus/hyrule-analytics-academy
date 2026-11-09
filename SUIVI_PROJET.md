# Suivi du projet — Chroniques d'Hyrule Analytics

Ce document est le journal de référence de l'avancement. Il complète les deux cahiers des charges, sans les remplacer. Il doit être mis à jour à la fin de chaque conversation de travail.

## Règles de conduite du projet

- Une conversation met en place **au plus un module**. Les fondations partagées et les prérequis peuvent être traités séparément, sans commencer plusieurs modules à la fois.
- Respecter l'ordre de travail de la section 11 du cahier des charges. Ne pas commencer les modules avant les prérequis et les données nécessaires.
- L'avenant n°1 prime sur le cahier des charges en cas de contradiction.
- Le contenu destiné aux élèves est en français, au tutoiement. Les réponses et chiffres de correction sont produits par les données et scripts, jamais inventés ou saisis en clair dans l'interface.
- Ne jamais intégrer de secrets, de données personnelles réelles, ni d'images, de musique ou de textes officiels de Nintendo. Pour les visuels, privilégier des créations originales. Demander à l'utilisateur les fichiers ou liens manquants au moment où ils deviennent nécessaires.
- À chaque fin de conversation, consigner ici : ce qui a été fait, les contrôles exécutés, les résultats, les points bloquants et la prochaine étape.

## Références faisant autorité

1. [Cahier des charges principal](<./Cahier des charges parcours Data « Chroniques d'Hyrule Analytics ».md>) — périmètre, architecture, données, parcours, évaluations et critères de recette.
2. [Avenant n°1](./AVENANT_1_cahier_des_charges.md) — décisions plus récentes et prioritaires : combat, correcteur, dépôt-modèle élève, outils et distribution.

Repères utiles :

- Cahier principal : sections 1 à 3 (mission et architecture), 5 à 7 (données et API), 8 (modules), 9 à 10 (formats et validation), 11 à 12 (ordre, tests et risques).
- Avenant : sections 2 à 3 (combat et habillage), 4 à 5 (outils et correction CI), 6 (deux dépôts et modèle élève), 7 (vérifications restantes).

## État initial constaté

Au démarrage, le dossier local ne contenait pas de dépôt Git initialisé ni de dépôt GitHub configuré. Le projet était donc un ensemble de fichiers de départ, et non le dépôt final publiable.

| Élément | État au démarrage |
| --- | --- |
| Fondations du cours | `course/assets/js/core/boss-fight.js`, `canon.js`, `course/grading/` et `course/scripts/` existent. Ce sont des éléments amorcés, pas une bibliothèque ou un cours complet. |
| Auto-test du correcteur | `python .\course\grading\selftest.py` a réussi (`selftest OK`). |
| Simulation d'équilibrage du combat | Le script et un rapport existent. Exécution non vérifiée : Node.js n'est pas disponible dans l'environnement (`node` non reconnu). |
| Données et génération | Aucun dossier `course/data/` ni générateur HQO n'est présent dans l'inventaire initial. |
| Site et modules | Aucun `index.html`, dossier `modules/` ou contenu pédagogique de module n'est présent dans l'inventaire initial. |
| Documentation du cours | Les deux cahiers des charges sont présents ; `docs/DECISIONS.md`, `docs/TEACHER.md` et `docs/SCHEMA.md` restent à créer dans le dépôt du cours. |
| Dépôt-modèle élève | `student-workspace/.github/workflows/grade.yml` existe ; les autres éléments du modèle restent à vérifier et construire. |
| Visuels | Aucun fichier de visuel n'est fourni dans l'inventaire initial. Aucun visuel officiel Nintendo ne doit être ajouté. |
| Éléments fournis | `base-gitignore.zip` est disponible ; son contenu n'a pas encore été extrait ni appliqué. |

Ne pas considérer un élément comme terminé uniquement parce qu'un fichier portant le bon nom existe : vérifier son contenu, ses tests et son intégration au bon dépôt.

### Informations communiquées par l'utilisateur

- Dépôt du cours : [darkTravus/hyrule-analytics-academy](https://github.com/darkTravus/hyrule-analytics-academy), public. Le site élève est publié sur [GitHub Pages](https://darktravus.github.io/hyrule-analytics-academy/) ; le dépôt local suit `origin/main`.
- Dépôt individuel de l'élève : chaque élève le créera ; les consignes de création sont à rédiger. L'utilisateur ne souhaite pas de dépôt-modèle distinct.
- Visibilité prévue : dépôt du cours et dépôts individuels des élèves publics.
- Choix initial de l'utilisateur : conserver l'habillage Zelda pendant le travail privé, puis le remplacer avant publication. Cette ancienne consigne a été explicitement remplacée pendant l'implémentation de M3.
- Écart validé par l'utilisateur : pas de dépôt-modèle séparé. Rédiger dans le dépôt du cours les consignes permettant à chaque élève de créer son propre dépôt. Cette décision s'écarte de l'architecture à deux dépôts de l'avenant, sections 1 et 6 ; adapter les consignes et le flux GitHub Actions en conséquence.

## Décisions déjà actées dans l'avenant

**Mise à jour de statut :** le 9 novembre 2026, l'utilisateur a confirmé vouloir conserver l'habillage et les références Zelda/Hyrule, et a choisi GitHub Pages gratuit avec un dépôt source public, un site public et aucun domaine personnalisé. Le dépôt a été poussé sur `main`, Pages est configuré sur GitHub Actions et le premier déploiement a réussi.

## Préparation des outils et de l'environnement

- Avant un build, test ou script, annoncer les outils ou dépendances nécessaires s'ils ne sont pas disponibles. Si une installation ou intervention utilisateur est requise, prévenir et donner la commande/étape précise avant de continuer.
- Node.js n'était pas disponible lors de la première tentative de `balance_sim.mjs` (`node` non reconnu). L'utilisateur l'a installé avec `winget install Schniz.fnm`, `fnm install 26`, puis a ajouté le chemin à `PATH` ; il rapporte Node v26.13.0 et npm 11.20.0.
- Le processus PowerShell de l'agent n'a pas récupéré le `PATH` mis à jour. Node est installé dans `%APPDATA%\fnm\node-versions\v26.13.0\installation`; l'exécution via le chemin absolu a vérifié Node v26.13.0, npm 11.20.0 et la simulation d'équilibrage. Pour les prochains tests, appeler explicitement cet exécutable ou préfixer le `PATH` du seul processus.
- Pré-requis prévisibles selon les étapes : Python 3 et dépendances pour génération/correcteur ; Node.js pour la bibliothèque JavaScript et tests ; navigateur/accès réseau pour Compendium, Pyodide et documentation. La génération et les tests de données utilisent NumPy 2.2.6, pandas 3.0.6, SciPy 1.18.1, scikit-learn 1.9.1, pytest et openpyxl 3.1.5. Ces versions ont été repérées dans l'environnement et déclarées dans `course/grading/requirements.txt`; aucun test n'a été exécuté dans la conversation 3.

- Le « combat de boss » remplace le QCM. Chaque module a une banque de 20 questions (8 difficulté 1, 8 difficulté 2, 4 difficulté 3) ; le combat est reproductible avec une graine, sans question répétée. Appliquer les règles, l'accessibilité et le format de progression de la section 2.
- L'ancienne épreuve chronométrée nommée « boss » devient l'**épreuve du donjon**. Réserver le terme « boss » au combat.
- Les noms Zelda sont centralisés dans `assets/data/lore.json`. La décision courante est de les conserver; ne pas les remplacer dans les tâches suivantes, sauf nouvelle instruction explicite de l'utilisateur.
- Excel est l'outil par défaut du module 1 ; Power BI Desktop est celui du module 5. Le module 5 doit signaler que Power BI Desktop est réservé à Windows et proposer le plan B décrit dans l'avenant.
- L'avenant prévoit le cours et le dépôt-modèle élève dans deux dépôts distincts. L'utilisateur a choisi de ne pas créer ce modèle : chaque élève créera son propre dépôt à partir des consignes du cours. Adapter les contrats de correction de la section 5.3 à cette décision.
- Les illustrations doivent être originales ou remplacées par des pictogrammes simples. Ne pas rechercher ni incorporer de sprites officiels.

## Plan de réalisation et avancement

Les étapes marquées « À faire » ne sont pas commencées, sauf mention dans l'état initial. Les contrôles et les données générées doivent être vérifiés avant de passer à l'étape suivante.

| Étape | État | Périmètre et condition de sortie |
| --- | --- | --- |
| 0. Dépôts et cadrage | **Partiellement fait** | Le dépôt local est initialisé et un `.gitignore` conservateur est en place ; le dépôt du cours est privé selon confirmation utilisateur et les élèves créeront leurs propres dépôts, sans modèle distinct. Aucun remote n'est configuré et les fichiers ne sont pas suivis ; ne pas relier au dépôt distant ni publier sans demande explicite. |
| 1. Vérifications préalables | **Terminé** | Compendium, Pyodide, GitHub Pages et Power BI vérifiés à la date du 04/11/2026. Décisions, sources, limites et points à revérifier consignés dans `course/docs/DECISIONS.md`. |
| 2. Données et correction de référence | **En cours** | Les jeux HQO ont été régénérés et les 9 tests d'acceptation passent. Le générateur produit les 23 hachages de m0 à partir de trois exercices et de sa banque de 20 questions. Les références des modules suivants seront ajoutées au fil de leur élaboration, sans inventer de réponse à l'avance. |
| 3. Bibliothèque partagée | **Implémentée, recette ciblée passée** | Moteur, runners, API fictive, widgets et interfaces sont couverts par 50 tests Node. `course-runtime.js` relie base, miroir Compendium, mock API et runner Python ; `activity-session.js` persiste exercices, combat et épreuve du donjon. Le smoke test navigateur intégré passe. `/regions/all` reste hors miroir tant qu'aucun module n'en a besoin. |
| 4. Coque du site | **M0 intégré, recette partielle** | Accueil gamifié, progression locale, import/export, VFX et mouvement réduit sont vérifiés. La carte ouvre m0 ; sa page passe la recette responsive à 360 px. Restent le déploiement sous sous-chemin et l'audit final d'accessibilité. |
| 5. Modules 0 à 9 | **En cours — m0 réalisé** | m0 comprend ses leçons, exercices, références, combat, épreuve du donjon facultative et livrable. Poursuivre dans l'ordre avec un seul module par conversation. |
| 6. Outils de suivi et d'enseignement | **Partiellement fait** | Le guide enseignant local décrit maintenant le lancement du site, les dépendances de développement et les tests. Certificat, suivi enseignant, mode hors ligne éventuel et consignes complètes de dépôt élève restent à construire. |
| 7. Recette et publication | **À faire** | Exécuter les tests d'acceptation, la recette du parcours fictif, les contrôles d'accessibilité, de liens et de taille ; publier après validation des dépôts et de la stratégie de diffusion. |

### Prérequis et recette de m0

Le premier module du parcours est **m0 — L'Éveil du héros**. Ses prérequis sont satisfaits et son implémentation est réalisée. Les références de correction des modules suivants seront produites progressivement, à partir de leurs exercices, en respectant la limite d'un module par conversation.

| Prérequis avant m0 | État | Condition de sortie |
| --- | --- | --- |
| Données et références | **M0 prêt** | Les jeux HQO passent les tests d'acceptation. Les hachages de E0.1–E0.3 et Q0.1–Q0.20 sont générés et rapprochés des données du snapshot. Les références des modules ultérieurs restent à faire avec leurs exercices. |
| Cœur commun | **Implémenté et recette ciblée passée** | Le combat, les exercices et l'épreuve du donjon sont raccordés à la progression persistée. La victoire de combat remplace la réussite du quiz ; l'épreuve du donjon reste distincte et n'accorde pas d'XP. Les récompenses ne sont versées qu'une fois. |
| Moteur des exercices et du combat | **Implémenté et intégré à m0** | Les trois exercices Python utilisent le runner, le proxy Compendium et les hachages. Le navigateur a vérifié les trois réponses correctes, les XP correspondants, le combat complet et le résultat du donjon. Un défaut de contrat entre le résultat du runner Python et le correcteur a été corrigé et testé. |
| Runner SQL | **Implémenté, recette ciblée passée** | Worker SQL.js épinglé, requêtes SELECT/WITH validées, base isolée en lecture seule, résultats plafonnés, plan et délai de 10 s. Un essai navigateur réel a interrogé `hqo_lite.sqlite` (2 000 joueurs). La recette pédagogique et l'intégration aux pages restent à faire. |
| Runner Python | **Implémenté, recette réelle passée** | Pyodide 314.0.7 dans un Worker de type module, chargement paresseux, fichiers montés, paquets autorisés, tests, sorties/figures et délai de 20 s. Essai navigateur réel réussi avec pandas, CSV monté et capture d'une exception. |
| API fictive et accès Compendium | **Implémentés, smoke test intégré passé** | Sur la page de fumée, SQLite renvoie 2 000 joueurs, le miroir local 389 entrées, l'API fictive deux joueurs et le client Python pagine les 2 000 joueurs ; le contrôle de hash réussit. `/regions/all` reste hors miroir et devra être décidé uniquement si un usage pédagogique le requiert. |
| Widgets | **Implémentés et testés, non bloquants pour m0** | CLT, calcul A/B, puissance et Bayes sont présents ; leurs tests de valeurs de référence passent. |
| Interface du combat | **Implémentée, recette ciblée passée** | Composant DOM sans HTML injecté, options accessibles, explications obligatoires, annonces `aria-live`, PV textuels et barres natives. Les dégâts/sparks et animations de secousse sont vérifiés ; les animations sont fortement réduites avec `prefers-reduced-motion`. La session d'activité persiste la victoire et sa récompense. |
| Coque du site | **M0 intégré** | L'accueil et la carte ouvrent la page de m0. La progression, l'import/export et le rendu sont vérifiés ; aucune barre horizontale n'apparaît à 360 px sur l'accueil ou m0. Le déploiement sous sous-chemin reste à vérifier. |
| Contrôle d'intégration | **M0 validé localement** | Recette navigateur : les exercices E0.1–E0.3 réussissent, le dépôt est enregistré sans requête réseau, le combat et le donjon persistent leurs résultats, et l'accueil affiche les trois cœurs du module. La recette publiée sous sous-chemin et l'audit d'accessibilité restent à faire. |

**Actions utilisateur nécessaires maintenant : aucune installation.** Node.js et Python sont disponibles ; aucune dépendance nouvelle n'a été requise. L'étape Git locale est à poursuivre avant distribution : le dépôt contient actuellement des fichiers non suivis et aucun remote ; l'archive `base-gitignore.zip` ne fournit pas de modèle `.gitignore` exploitable, et son contenu n'a pas été extrait. Aucune action GitHub distante ne sera faite sans demande préalable. Les visuels de marque sont facultatifs et ne bloquent pas m0.

### Modules à réaliser séparément

La colonne « livrable » résume le parcours du cahier principal ; les fichiers exigés et seuils exacts sont ceux de l'avenant, section 5.3.

| Module | Donjon et compétence principale | Livrable de parcours | État |
| --- | --- | --- | --- |
| 0 | L'Éveil du héros — poste, Git, formats, premier appel d'API | Dépôt GitHub et README | **Réalisé, recette locale passée** |
| 1 | L'inventaire de la Tablette Sheikah — Excel et raisonnement analytique | Classeur à 3 onglets | À faire |
| 2 | Les archives d'Impa — SQL relationnel | Requêtes SQL commentées et synthèse | À faire |
| 3 | Le laboratoire de Purah — statistiques et tests A/B | Notebook de statistiques | À faire |
| 4 | La cartographie du royaume — Python, pandas et API | Notebook « Atlas des monstres » | À faire |
| 5 | La tour de contrôle — visualisation et BI | Tableau de bord et note | À faire |
| 6 | La corruption de Ganon — qualité, Git et reproductibilité | Dépôt reproductible | À faire |
| 7 | Prédire l'abandon — machine learning | Notebook et synthèse | À faire |
| 8 | L'Oracle de la Source — IA générative et audit | Classification évaluée et rapport | À faire |
| 9 | La Triforce — projet final | Projet et présentation | À faire |

## Éléments à obtenir de l'utilisateur, au moment utile

Avant toute action distante ou publication, demander une confirmation explicite ; les choix d'hébergeur, visibilité, URL cible et maintien des références Zelda/Hyrule sont déjà actés.

À obtenir seulement si nécessaire :

- les URL de sources ou de documentation auxquelles l'environnement ne pourrait pas accéder ;
- les accès/permissions GitHub requis si l'utilisateur autorise ultérieurement la création du dépôt, le push ou le lancement du workflow.

À demander seulement lorsqu'un livrable en a besoin :

- logo, palette ou autres éléments de marque que l'utilisateur détient ou peut utiliser ;
- fichiers SVG/illustrations originaux et autorisés, si l'utilisateur souhaite les fournir ; sinon utiliser des visuels simples créés pour le projet ;
- autres fichiers de données ou consignes manquants, avec leur provenance et leurs droits d'utilisation.

Ne pas bloquer la préparation technique sur des visuels facultatifs. Ne jamais demander ni intégrer de clé API ou autre secret dans le dépôt.

## Journal des conversations

### Conversation initiale — lecture des consignes et création du suivi

- **Fait :** lecture des deux cahiers ; repérage de la priorité de l'avenant, de la séquence de travail, des dix modules et des vérifications à effectuer.
- **Fait :** inventaire initial des fondations déjà présentes ; création de ce document de suivi.
- **Vérification :** auto-test Python du correcteur réussi. La simulation Node n'a pas pu être lancée, car Node.js n'est pas installé/disponible dans l'environnement.
- **Vérification :** le dépôt GitHub du cours est public et vide (taille 0) ; aucun fichier/commit n'est présent. Le slug et la description du dépôt contiennent une référence à Hyrule.
- **Non commencé :** aucun module n'a été mis en place dans cette conversation.
- **Informations reçues :** URL du dépôt du cours ; chaque élève créera son propre dépôt ; pas de dépôt-modèle distinct ; publication publique après remplacement de l'habillage Zelda.
- **Action requise à la fin de cette conversation :** rendre privé le dépôt pendant le travail Zelda. L'utilisateur l'a confirmé comme fait à la conversation 2. Adapter aussi le workflow à la décision « consignes seules, sans dépôt-modèle ».
- **Prochaine étape proposée :** cadrage de l'étape 0, sans commencer le module 0. Ensuite, vérifier les prérequis (étape 1) et traiter chaque module dans une conversation distincte.

### Conversation 2 — vérifications préalables

- **Dépôt :** l'utilisateur confirme que le dépôt GitHub du cours est privé. Toute prochaine action côté GitHub doit être demandée à l'utilisateur avant de poursuivre.
- **Node.js :** versions rapportées par l'utilisateur vérifiées (`v26.13.0`, npm `11.20.0`). L'environnement d'agent ne voit pas le `PATH` mis à jour ; exécution par chemin fnm explicite réussie.
- **Simulation du combat :** `node .\course\scripts\balance_sim.mjs 20000` (exécutable Node v26.13.0 ciblé directement) : à 80 % de justesse, 67,2 % de victoires ; à 50 %, 5,1 %. Les seuils de l'avenant sont satisfaits.
- **Compendium :** nouvelle documentation officielle redirigée vers `hyrule-compendium.com`; API `api.hyrule-compendium.com/v3`. Tests GET en lecture seule sur entrée, liste complète, catégorie et régions : HTTP 200 ; CORS vérifié avec un en-tête `Origin`. Le total observé est 389 entrées : creatures 83, equipment 185, materials 36, monsters 81, treasure 4. La documentation distingue BotW et TotK via le paramètre `game`; `/compendium/all` et `/compendium/category/<category>` sont disponibles. Champs descriptifs et URL d'image exclus du snapshot.
- **Pyodide :** au 04/11/2026, dernière release repérée `314.0.7`. La liste officielle de packages contient pandas 3.0.2, numpy 2.4.6, scipy 1.18.0, matplotlib 3.10.8, statsmodels 0.14.6 et scikit-learn 1.8.0. Épingler la release et charger les packages à la demande ; mesurer ultérieurement le poids/temps réel de chargement côté navigateur.
- **Hébergement :** GitHub Pages : site publié ≤ 1 GB, recommandation de source ≤ 1 GB, déploiement < 10 min, limites souples de 100 GB/mois et 10 builds/heure (hors déploiement par workflow GitHub Actions). Git régulier avertit au-delà de 50 MiB et bloque au-delà de 100 MiB par fichier. Conserver l'objectif du cahier (<60 MB) comme marge prudente.
- **Power BI :** Microsoft indique qu'un compte gratuit peut créer et utiliser ses rapports pour soi, sans partage/collaboration ; la version web gratuite n'est donc pas équivalente à un livrable collaboratif. Le module 5 garde le `.pbix` Desktop et documente le plan B au moment de ce module.
- **Docs :** décisions préalables enregistrées dans `course/docs/DECISIONS.md`.
- **Snapshot Compendium :** création et exécution de `course/scripts/fetch_compendium_snapshot.py` ; `course/data/compendium/compendium_snapshot.json` contient 389 entrées, aucune occurrence de `description` ou `image`. Requête unique de liste complète conforme à la limite d'une requête/seconde.
- **Dépendance Python :** `openpyxl==3.1.5` manquait dans l'environnement malgré sa présence dans `course/grading/requirements.txt`. Après information à l'utilisateur, installation de cette version ; import vérifié. NumPy, pandas, SciPy, scikit-learn et pytest étaient déjà présents.
- **Non commencé :** aucun module n'a été commencé ; le dépôt distant n'a pas été modifié.

### Conversation 3 — préparation du générateur de données

- **Fait :** revue statique du générateur HQO ; raccordement de 40 noms Compendium aux 80 objets et vérification prévue de 9 régions exactes et 3 variantes.
- **Fait :** ajustement de l'expérience PACK pour garantir les conversions sur le produit « pack aventurier » et préserver le paradoxe de Simpson par plateforme. Les 5 acheteurs mobiles du bras B constituent la valeur entière la plus proche sous les 3 % du bras A (6 sur 200 donneraient une égalité).
- **Fait :** génération rendue déterministe sur ses fichiers produits : suppression de l'horodatage variable des faits, normalisation des horodatages ZIP et tri de l'ordre des acheteurs. Le test d'acceptation compare les empreintes SHA-256 de deux générations complètes.
- **Fait :** création de `course/scripts/test_dataset.py` pour les volumes, intégrités, expériences, AUC, anomalies, données personnelles, références Compendium et reproductibilité ; dépendances data ajoutées à `course/grading/requirements.txt`.
- **Dépendances observées :** Python 3.13.14, NumPy 2.2.6, pandas 3.0.6, SciPy 1.18.1, scikit-learn 1.9.1, pytest 9.0.2 et openpyxl 3.1.5. Elles sont déjà installées localement ; aucune installation supplémentaire n'a été effectuée.
- **Non exécuté volontairement :** génération HQO, tests, validation du modèle et contrôle des empreintes. L'utilisateur a demandé que ces tests soient faits après redémarrage, dans une autre conversation.
- **Prochaine étape obligatoire :** après redémarrage, exécuter `python .\course\scripts\generate_hqo_dataset.py`, puis `python .\course\scripts\test_dataset.py`. Corriger tout échec, vérifier les résultats et ne commencer ni bibliothèque partagée ni module avant réussite.

### Reprise — lecture des consignes du projet

- **Fait :** relecture du présent suivi, de `course/docs/DECISIONS.md`, du cahier des charges principal et de l'avenant n°1.
- **Règles retenues :** l'avenant prime en cas de contradiction ; l'ordre de réalisation est obligatoire ; ne pas commencer de module avant la validation des données et de la bibliothèque partagée. Une conversation ne traite au plus qu'un module.
- **Décisions alors en vigueur :** dépôt du cours privé pendant le travail, pas de dépôt-modèle distinct (les élèves créent leur propre dépôt à partir des consignes du cours), aucune action distante GitHub sans demande préalable. La consigne de remplacement de Zelda, en vigueur à cette date, a été remplacée par la décision utilisateur de la conversation 15.
- **Non exécuté :** aucune génération ni aucun test lors de cette reprise ; aucun module commencé.
- **Prochaine étape alors prévue :** génération HQO et tests d'acceptation ; ces contrôles sont maintenant consignés dans la conversation suivante.

### Conversation 4 — génération et validation des données HQO

- **Fait (rapport utilisateur) :** depuis le CLI de Copilot, les scripts ont été corrigés et les fichiers de données ont été régénérés. Les corrections rapportées portent sur les seuils de churn, le paradoxe de Simpson, la suppression de `name` des CSV, la détection des faux positifs de numéros de téléphone et la stabilité des métadonnées Excel.
- **Vérification indépendante dans cette session :** `python .\course\scripts\test_dataset.py` — **9 tests réussis** (`9 passed in 260.20s`).
- **État :** les données et seuils d'acceptation sont validés par la suite disponible. Aucun module n'a commencé.
- **Prochaine étape alors prévue :** implémenter `course/scripts/build_hashes.py` et vérifier les empreintes et les références attendues.

### Conversation 5 — outil de génération des empreintes de correction

- **Fait :** création de `course/scripts/build_hashes.py`. Il lit un catalogue JSON de réponses de référence, produit le format attendu par `grading/grade.py`, utilise `grading/hashing.py` comme source unique, réutilise le sel d'un fichier de sortie existant ou en crée un, et écrit le résultat atomiquement.
- **Sécurité et validation :** les requêtes SQL sont limitées à `SELECT`/`WITH`, exécutées sur une connexion SQLite en lecture seule ; les chemins de base de données doivent rester dans le dossier du cours. Les types pris en charge sont `text`, `num` et `sql`.
- **Tests :** `python .\course\scripts\test_build_hashes.py` — **5 tests réussis** ; `python .\course\grading\selftest.py` — `selftest OK` ; l'aide CLI fonctionne.
- **Limite constatée :** le dépôt ne contient pas encore le catalogue des exercices/réponses (`answer_sources.json`) ni les modules. Le fichier final `data/expected/answers_hashed.json` n'a donc pas été généré : créer des valeurs de référence avant les exercices reviendrait à inventer des réponses.
- **Décision utilisateur :** respecter la règle d'au plus un module par conversation. La préparation du catalogue complet de réponses de référence est bien une tâche à faire, mais elle doit se faire progressivement, à partir des exercices réellement définis, sans rédiger plusieurs modules dans une conversation.
- **À faire :** créer les définitions du catalogue (`answer_sources.json`) pour les exercices au fil de leur élaboration, puis exécuter le générateur et vérifier la compatibilité avec le correcteur. Le fichier final de hachages reste une condition de sortie de l'étape données/correction. La bibliothèque partagée et les modules restent à faire ; aucun module n'a commencé ici.

### Conversation 6 — bibliothèque partagée : moteur de combat et canonisation

- **Moteur de combat :** validation des banques (IDs non vides et uniques, difficultés 1–3), des graines et des règles ; prise en charge propre des surcharges partielles des dégâts ; une résolution exige désormais la prochaine question et un booléen de correction, et une question ne peut pas être résolue après la fin du combat.
- **Canonisation JavaScript :** ajout de `hashText`, `numCell`, `hashNum` et `matchNum`, alignés sur `grading/hashing.py` pour les chaînes normalisées, les arrondis à deux décimales et l'arrondi pair des cases numériques. Les cellules numériques non finies sont rejetées.
- **Tests ajoutés :** `course/scripts/test_boss_fight.mjs` (6 tests) et `course/scripts/test_canon.mjs` (4 tests couvrant vecteurs de hachage Python, accentuation, emoji, nombres négatifs et entrées invalides).
- **Contrôles :** suite Node ciblée — **10 tests réussis** ; simulation du combat à 20 000 essais reproduite (67,2 % de victoires à 80 % de justesse, 5,1 % à 50 %) ; `course/scripts/test_build_hashes.py` — 5 tests réussis ; `course/grading/selftest.py` — `selftest OK`.
- **Reste de l'étape bibliothèque :** runners SQL/Python, faux serveur API, progression, jetons, widgets et interface du combat. Aucun module de formation commencé.
- **Prochaine action :** poursuivre la bibliothèque partagée par un autre composant central, avec tests ciblés ; conserver la limite d'un module de formation par conversation.

### Conversation 7 — bibliothèque partagée : progression locale et jetons

- **Progression :** création de `assets/js/core/progress.js` avec modèle version 1 (clé `hqo_progress_v1`), validation, sauvegarde/chargement Web Storage, export/import JSON et mise à jour isolée d'un module. Le format prend en compte `fight`, conformément à l'avenant ; absence de sauvegarde renvoie `null`, les données corrompues et indisponibilités de stockage sont signalées.
- **Jetons :** création de `assets/js/core/token.js`, avec charge base64url UTF-8 et empreinte SHA-256 tronquée à 16 caractères, selon le format du cahier. Création et vérification valident la charge ; la vérification rejette aussi encodages non canoniques et mauvaises empreintes. Le sel public signifie que le jeton reste un mécanisme de suivi à faible enjeu, pas une preuve infalsifiable.
- **Tests :** `course/scripts/test_progress_token.mjs` couvre import/export et stockage, formats invalides, jeton Unicode, empreinte erronée et validation de la charge.
- **Contrôles :** suite Node combinée (`test_progress_token.mjs`, `test_boss_fight.mjs`, `test_canon.mjs`) — **14 tests réussis** ; auto-test Python du correcteur — `selftest OK` ; 5 tests de `test_build_hashes.py` réussis.
- **Reste de l'étape bibliothèque :** runners SQL/Python, faux serveur API, widgets et interface du combat. Aucun module de formation commencé.
- **Prochaine action :** poursuivre la bibliothèque partagée par un runner ou le faux serveur API ; choisir le composant suivant selon les contrats disponibles, sans commencer de module de formation.

### Clarification — prérequis avant le module 0

- **Fait :** clarification du séquencement avec l'utilisateur à la conversation 8. Le premier module de formation est m0 ; l'ordre du cahier demande de terminer la bibliothèque partagée et la coque du site avant de le commencer.
- **État actualisé à la conversation 10 :** le runtime relie SQLite, Python, API fictive et miroir Compendium ; la session d'activité relie exercices, quiz, combat, récompenses et sauvegarde. Le smoke test intégré et les interactions navigateur ciblées passent.
- **Reste avant m0 :** créer la page et les contenus réels de m0, puis produire leurs réponses/hachages à partir des activités définies. Les gabarits propres au module et la recette publiée sous sous-chemin seront réalisés/validés dans ce travail. `/regions/all` reste hors miroir car aucun usage m0 n'en a besoin.
- **Références :** le générateur et les données sont prêts/testés ; les réponses de référence sont à définir avec les exercices, un seul module par conversation. Ne pas bloquer chaque module sur des références qui ne peuvent exister qu'après rédaction des exercices.
- **Action utilisateur :** aucune installation ou configuration immédiate requise. Les installations éventuelles ou interventions réseau/locales seront signalées avec les commandes précises avant le test concerné. Les actions distantes GitHub restent à demander séparément.
- **Prochaine étape technique proposée :** commencer m0 dans une conversation dédiée, en créant seulement ses contenus et sa page, puis ses corrigés à partir des exercices réels. Ne pas commencer un autre module dans la même conversation.

### Conversation 9 — runners, API, moteur d'exercices et première coque

- **Moteur et correction :** ajout de `core/quiz.js` et `core/exercise.js`. Les vérifications consomment directement le format `salt` / `items` produit par `scripts/build_hashes.py`; aucun corrigé en clair n'est ajouté au client. Les questions multi-sélection canonisent les identifiants en tableau JSON trié avant le hachage. Les exercices Python déclarent une expression de résultat (`answer_expression`) et les erreurs d'exécution restent distinctes d'une réponse incorrecte.
- **Formulaire d'exercice :** ajout de `core/exercise-ui.js` pour saisir du texte/code/SQL, lancer les runners, annoncer le statut, afficher des résultats SQL sous forme de tableau, le plan de requête, la sortie/trace Python et les figures sans HTML non fiable. Essai navigateur SQL réussi avec rendu du résultat et du feedback.
- **Interface combat :** ajout de `core/fight-ui.js` avec commandes radio/checkbox/clavier natives, explication obligatoire, annonces de résultats, barres PV accompagnées de valeurs textuelles et callback de fin. Un essai navigateur a vérifié la bonne réponse, l'explication, l'annonce et la victoire ; un second a validé le parcours clavier.
- **Runners :** `sql-runner.js` / `sql-worker.js` exécutent SQL.js dans un worker avec politique de lecture seule, plafonnement, plan et délai. `py-runner.js` / `py-worker.js` utilisent Pyodide 314.0.7 dans un worker de type module (requis par cette version), avec chargement paresseux, fichiers, liste de paquets, assertions, sorties, figures et délai de 20 s.
- **Essai réel navigateur :** la base `hqo_lite.sqlite` a répondu à `SELECT COUNT(*) FROM players` avec 2 000 lignes joueurs ; Pyodide a chargé pandas, lu un CSV monté sous `/data`, calculé 13 et transmis une exception Python de façon exploitable. Le chargement initial a révélé que Pyodide 314.0.7 ne supporte pas les workers classiques ; le runner a été adapté en worker module et retesté avec succès.
- **API :** routes HQO asynchrones et client Python déjà implémentés ; correction du signalement `local-mirror` quand l'en-tête est présent. Les essais ciblés couvrent pagination, clé, validations, not-found, limitation, erreur 500 réessayable et repli Compendium. Le miroir ne gère pas `/regions/all` ; cette route n'est pas requise pour le premier flux Compendium envisagé et reste à décider avant son usage.
- **Coque :** création de `course/index.html`, `assets/css/site.css` et `assets/js/site.js`. Le site présente le module 0 comme en préparation (aucune leçon commencée), avec navigation relative et sauvegarde locale alias/import/export. Essai navigateur : création et persistance de la progression vérifiées.
- **Widgets :** CLT, A/B, puissance et Bayes sont reportés à avant leur premier usage pédagogique ; ils ne sont pas des prérequis fonctionnels de m0.
- **Contrôles automatisés :** les 8 suites Node ciblées passent (**37 tests**). `python -m pytest course/scripts/test_hqo_client.py course/scripts/test_build_hashes.py -q` passe (**9 tests**) et `course/grading/selftest.py` renvoie `selftest OK`. La simulation à 20 000 combats confirme 67,2 % de victoires à 80 % de justesse et 5,1 % à 50 %. Les suites de données validées antérieurement restent à 9 tests réussis ; aucune réponse ni leçon de m0 n'a été créée.
- **Reste avant l'ouverture de m0 :** intégration des runners/API/combat dans les pages du site, gabarits de contenu, recette complète import/export + exercice + Compendium + combat, accessibilité responsive et publication sous sous-chemin. Étape 0 locale (Git et `.gitignore`) encore requise avant la distribution ; pas d'action distante GitHub sans demande.

### Conversation 10 — intégration des activités, smoke test et VFX

- **Défaut d'intégration corrigé :** le navigateur a révélé que `course-runtime.js` importait `API_ORIGIN` depuis `mock/routes.js`, alors que l'export appartient à `mock/mock-api.js`. L'import est corrigé et un test Node protège désormais le chargement du runtime.
- **Progression des activités :** ajout de `core/activity-session.js`. Une session de module utilise une sauvegarde existante, relie l'exercice, le quiz et le combat aux helpers de progression, enregistre les résultats dans le stockage local, et transmet les changements au rendu appelant. Les récompenses d'exercice, quiz et victoire ne sont pas versées plusieurs fois. Les erreurs de callback de progression restent annoncées au lieu d'être présentées comme des erreurs d'exécution ou ignorées.
- **Recette intégrée navigateur :** `scripts/integration-smoke.html` a terminé avec succès : SQLite renvoie **2 000 joueurs**, le miroir Compendium **389 entrées**, l'API fictive **2 joueurs**, le client Python pagine les **2 000 joueurs** et le contrôle de hash vaut `true`. Cette page reste un smoke test manuel conservé, pas un contenu de cours.
- **Recette activités et interface :** dans le navigateur, un exercice synthétique a accordé 20 XP et un combat synthétique a persisté la victoire, 150 XP supplémentaires et son badge. Création et rechargement de la sauvegarde, import JSON et export (état de succès de l'interface) ont été vérifiés. Les VFX affichent les dégâts et particules, la classe de secousse correspondante est posée, et `prefers-reduced-motion` réduit les animations à 0,01 ms.
- **Responsive et progression :** aucune barre de défilement horizontale à 375 px (largeur de page = largeur de fenêtre) ; la progression importée se recharge bien après navigation/rechargement.
- **Git local :** `.gitignore` ajouté pour caches Python, environnements locaux, secrets `.env` et `node_modules`; `git check-ignore` confirme l'exclusion des caches. L'archive nommée `base-gitignore.zip` contient seulement un cahier et une archive imbriquée, pas de modèle `.gitignore`. Le dépôt local n'a aucun remote et les sources sont non suivies ; aucun ajout au staging, commit ou accès distant n'a été fait.
- **Contrôles automatisés :** `node --test course/scripts/test_*.mjs` réussit avec **49 tests** ; les tests ciblés Python réussissent avec **9 tests** et le correcteur affiche `selftest OK`. Les données actuelles occupent environ **40,5 MB** dans `course/data/`. La suite complète d'acceptation des données avait déjà réussi avec **9 tests** le 6 novembre ; elle n'a pas été relancée car les données n'ont pas changé dans cette conversation.
- **État du contenu :** aucun exercice pédagogique, réponse de référence ni leçon de m0 n'a été créé. Le prochain travail peut commencer m0 seul, en définissant les activités et leurs réponses ensemble. Le déploiement sous sous-chemin et la recette finale d'accessibilité restent à faire ; ils ne requièrent pas une action utilisateur immédiate.

### Conversation 11 — guides de démarrage élève et enseignant

- **Guide élève :** création de `README.md` à la racine. Il donne uniquement les repères nécessaires : parcours en cours, création future d'un dépôt personnel selon les consignes du cours, séparation avec le dépôt du cours et sauvegarde locale de progression. L'adresse publiée sera ajoutée avant la diffusion.
- **Repères enseignant :** création de `README-ENSEIGNANT.md` à la racine avec les liens vers le suivi, les décisions et la vérité terrain réservée, ainsi que les commandes de tests. Le fichier est explicitement ajouté à `.gitignore` et reste local ; ne pas le publier.
- **Documentation évolutive :** les avancées, contrôles et prochaines étapes restent à consigner dans `SUIVI_PROJET.md` ; les décisions techniques et leurs validations vont dans `course/docs/DECISIONS.md`. Les README restent volontairement courts.
- **État de m0 :** aucun contenu pédagogique n'est démarré par cette tâche ; m0 reste en préparation. La prochaine étape est de commencer uniquement m0 dans une conversation dédiée, en respectant les prérequis et le suivi.

### Conversation 12 — implémentation de m0 et démarrage local

- **Module :** création de `course/modules/m0-eveil/` avec manifeste, sept leçons, trois exercices Python, 20 questions (8 de difficulté 1, 8 de difficulté 2, 4 de difficulté 3), le combat du Bokoblin, l'épreuve du donjon B0 facultative et le dépôt GitHub `data-portfolio`.
- **Correction :** les 23 hachages de E0.1–E0.3 et Q0.1–Q0.20 sont générés depuis `grading-private/answer_sources.json`, exclu de Git et situé hors du site publiable. Le vérificateur de génération accepte désormais les identifiants `Q`.
- **Intégration corrigée :** la recette réelle a révélé que le vérificateur Python lisait le résultat sous `execution.result.answer`, alors que le runner renvoie `execution.answer`. Le contrat et son test ont été corrigés. Le runner fournit aussi `get_json` pour le premier appel Compendium.
- **Progression :** les XP d'exercice respectent les valeurs de m0 ; la victoire de combat remplace le quiz et n'est récompensée qu'une fois. L'épreuve du donjon enregistre score et durée, limite les tentatives à une par jour sur l'appareil et n'accorde pas d'XP. La validation du dépôt ne fait aucun appel réseau.
- **Guide enseignant :** `README-ENSEIGNANT.md` explique le lancement par `python -m http.server 8000 --directory course`, l'absence de build, les CDN requis pour les runners, l'installation des dépendances de test et la génération privée des hachages.
- **Recette navigateur :** E0.1–E0.3 réussis ; combat terminé en 8 questions ; B0 réussi sans XP et nouvelle tentative désactivée le même jour ; dépôt validé par format/confirmation ; la carte affiche les trois cœurs. Aucune barre horizontale à 360 px sur l'accueil et m0.
- **Contrôles automatisés :** 50 tests Node réussis ; 12 tests Python ciblés réussis et `course/grading/selftest.py` renvoie `selftest OK`. La suite complète des données n'a pas été relancée, les données HQO étant inchangées.
- **Reste :** modules 1 à 9 dans l'ordre, consignes complètes du dépôt élève, outils enseignant, déploiement sous sous-chemin et recette finale d'accessibilité. Aucun remote GitHub ni publication n'a été configuré.
- **Prochaine étape :** module 1 dans une conversation dédiée. Pour lancer le site localement : exécuter `python -m http.server 8000 --directory course` depuis la racine, puis ouvrir <http://localhost:8000/>.

### Conversation 13 — module 1 et préparation du guide élève

- **Accès au MVP (état à cette date) :** l'élève devra ouvrir une URL web, sans lancer le site localement. Le site n'est pas encore déployé ; l'ancienne consigne de remplacement Zelda a été supersédée depuis par la conversation 15.
- **README élève :** ajout des installations de base (navigateur, VS Code, Python 3, Git et tableur), liens officiels, commandes de vérification Windows/macOS/Linux, et précision que Node.js/npm ne sont pas requis pour suivre le site.
- **Module 1 :** création de `course/modules/m1-inventaire/` : sept leçons, six activités (taille/grain, cinq anomalies, CA de mars, TCD, panier moyen et auto-évaluation), banque de 20 questions de combat réparties 8/8/4, et épreuve B1 chronométrée de 45 minutes sur un second extrait. Le livrable demande un classeur à trois onglets.
- **Données :** correction du générateur pour écarter les doublons naturels du sous-échantillon et produire exactement 40 lignes ajoutées en doublon dans l'extrait principal. Ajout d'un extrait B1 de 10 000 lignes avec d'autres quantités d'anomalies.
- **Références :** 36 hachages M1 ajoutés (E1.1–E1.5, B1 et Q1.1–Q1.20), portant le fichier commun à 59 hachages. Les données détaillées d'anomalies et `GROUND_TRUTH.md` ont été déplacés sous `grading-private/`, exclu de Git et hors du dossier servi par le site ; le générateur prend un `--private-output`.
- **Recette navigateur :** E1.1, E1.2, E1.3, E1.4 et E1.5 vérifiés correctement ; l'auto-évaluation E1.6 a été enregistrée ; combat gagné en 8 questions à 100 % ; épreuve B1 réussie à 3/3 sans XP. Le clic d'export a été vérifié, mais le navigateur intégré n'a pas exposé d'événement de téléchargement.
- **Contrôles déjà réussis avant le déplacement des références :** 50 tests Node et `node --check` ; les tests ciblés Python M0/M1/données avaient passé sauf une première référence de CA top article, corrigée avec le résultat après normalisation des noms. Relancer les tests après la séparation des références et exécuter la suite complète des données avant clôture.
- **Reste à cette date :** mettre en place avant publication une sortie statique qui exclut scripts et documents enseignant. Aucun changement GitHub distant ni déploiement n'a été effectué.
- **Prochaine étape alors prévue :** module 2 dans une conversation dédiée.

### Conversation 14 — implémentation du module 2

- **Module :** création de `course/modules/m2-archives/` avec neuf leçons SQL, schéma interactif des 14 tables HQO, 30 exercices gradués (10 simples, 10 jointures/CTE, 10 fenêtres/cohortes), cinq requêtes fautives à déboguer, 20 questions de combat et un livrable SQL commenté avec cinq constats.
- **Base du boss :** génération reproductible de `course/data/hqo_boss.sqlite` avec une graine distincte (20261106), un schéma identique à `hqo_lite.sqlite` et 2 000 joueurs. Le boss propose six requêtes sans indices en 90 minutes, avec réussite à 5/6 et sans XP.
- **Intégration :** le site charge le dataset principal SQL.js dans le navigateur, corrige les résultats par hachage, montre le plan des requêtes et enregistre les réussites lorsque l'élève a une sauvegarde. La carte d'accueil ouvre désormais le module 2; aucun logiciel SQL ni installation élève supplémentaire n'est requis.
- **Correction privée :** 61 références M2 (30 exercices, cinq débogages, 20 questions et six boss) ajoutées hors du site sous `grading-private/`; le fichier haché commun comporte 120 entrées au total.
- **Recette navigateur :** E2.1 et D2.1 acceptés par le runner réel; D2.1 n'ajoute pas d'XP et n'entre pas dans le compteur des 30 requêtes. Le boss SQL termine en 6/6, enregistre score et durée sans XP; le combat est gagné en 7 questions à 100 %. À 360 px, la largeur de document égale celle de la fenêtre.
- **Contrôles automatisés :** `test_module2.py` (3 tests) et les régressions Python M0/M1/M2, hachages et client HQO (17 tests) réussissent; le correcteur affiche `selftest OK`. La suite complète d'acceptation des données passe (9 tests), ainsi que les 50 tests Node. Syntaxe JS/JSON vérifiée et zéro violation de clés étrangères dans la base du boss.
- **Points de recette corrigés :** déclaration explicite des activités comme SQL; les activités D2 ne modifient plus le score des 30 exercices requis; B2.6 est bornée à 100 lignes pour rester dans la limite de sortie/correction du runner.
- **Reste commun avant publication :** créer une sortie de déploiement avec liste blanche et configurer explicitement l'hébergeur. Conserver Zelda, conformément à la décision ultérieure de l'utilisateur. Aucun déploiement ni changement distant effectué.
- **Prochaine étape alors prévue :** module 3 dans une conversation dédiée; cette étape est maintenant terminée (conversation 15).

### Conversation 15 — implémentation du module 3

- **Décision utilisateur :** conserver l'univers et les références Zelda/Hyrule tels quels. Cette décision remplace toutes les notes antérieures qui proposaient de les retirer avant le déploiement.
- **Module :** création de `course/modules/m3-laboratoire/` : huit leçons de statistiques, huit exercices Python exécutés dans Pyodide, quatre widgets interactifs réutilisés, combat de 20 questions et épreuve B3 de deux heures avec CSV indépendant, quatre calculs vérifiés, mémo de 150 mots et auto-évaluation.
- **Données et correction :** ajout de `exp_boss.csv`, généré seul par `--m3-boss-csv` avec la graine 20261107, 2 000 joueurs par bras et rétention plantée de 18 % contre 23 %. Les réponses M3 restent dans `grading-private/answer_sources.json`; le site ne reçoit que les empreintes. Le nombre d'empreintes est passé à 152.
- **Intégration :** le module est ouvert depuis la carte d'accueil, les huit exercices ont des emplacements de progression fixes, et l'épreuve B3 enregistre score et durée sans XP, une fois par date locale. Le README élève précise les besoins réseau et logiciels, et le guide enseignant documente la génération et les tests.
- **Vérification navigateur :** les huit exercices ont été corrigés correctement avec le vrai runner Pyodide, dont la régression, la puissance statsmodels, les calculs EXP_KOROK/EXP_PACK et Bayes. Le combat a accepté une réponse Q3.16 correcte. B3 a réussi à 6/7 avec quatre calculs justes, un mémo de 155 mots et deux critères; les XP sont restés inchangés. À 360 px, la largeur du document reste dans celle de la fenêtre.
- **Contrôles automatisés :** 20 tests Python ciblés réussissent, les 50 tests Node passent, `course/grading/selftest.py` renvoie `selftest OK`, et la compilation/syntaxe Python/JavaScript passe.
- **Reste :** le site n'est pas déployé. Aucun hébergeur, URL ou réglage de visibilité n'a été choisi et aucune action distante n'a été exécutée.
- **Prochaine étape :** préparer le déploiement du site en conservant Zelda, puis clarifier l'hébergeur, la visibilité et l'URL à utiliser avant toute publication.

### Conversation 16 — préparation locale du déploiement GitHub Pages

- **Décisions confirmées :** GitHub Pages gratuit, dépôt source et site publics, sans domaine personnalisé ; conserver les références Zelda/Hyrule. L'URL prévue est `https://darktravus.github.io/hyrule-analytics-academy/`.
- **Artefact élève :** ajout de `course/scripts/build_site.py`, qui construit une sortie statique à liste blanche. Le site publié contient l'accueil, les assets, les modules 0 à 3 et les données nécessaires ; les scripts, outils enseignant, réponses sources, caches et base complète non utilisée sont exclus.
- **Workflow :** ajout de `.github/workflows/pages.yml`, déclenché uniquement par `workflow_dispatch`, pour construire puis déployer l'artefact. Aucun lancement n'a été effectué.
- **Préparation et documentation :** ajout des tests du build, ajout d'un avis d'indépendance visible sur l'accueil et les modules, mise à jour des instructions enseignant pour les étapes GitHub Pages et de la documentation publique.
- **Vérifications :** 6 tests ciblés du build/M3 réussissent ; les pages d'accueil et des modules M0–M3 ainsi que les fichiers XLSX et SQLite répondent en HTTP 200 sous le préfixe de projet Pages. L'artefact contient 70 fichiers (17 953 535 octets) et ne contient aucun fichier enseignant/cache ciblé.
- **État externe :** aucun remote Git n'est configuré. Aucun commit, push, changement de paramètres GitHub ou publication n'a eu lieu. Le dépôt public exposera l'ensemble des sources versionnées, contrairement à l'artefact Pages qui suit la liste blanche.
- **Prochaine étape :** après confirmation explicite de l'utilisateur, relier le dépôt local au dépôt GitHub cible et publier le code source ; configurer ensuite Pages sur GitHub Actions et lancer manuellement le workflow.

### Conversation 17 — première publication du site

- **Dépôt public :** premier commit `2e92a33` poussé sur `main` du dépôt `darkTravus/hyrule-analytics-academy`; le worktree est propre.
- **GitHub Pages :** source réglée sur **GitHub Actions**. Le workflow manuel a été lancé sur `main` (run 1) et s'est terminé avec succès.
- **URL publique :** https://darktravus.github.io/hyrule-analytics-academy/ ; la page d'accueil et les modules M0 à M3 répondent en HTTP 200.
- **Recette de publication :** avis d'indépendance visible sur l'accueil et sur M0–M3 à l'URL directe. Les runners SQL/Python, la base SQLite, le classeur XLSX et le CSV `exp_boss.csv` sont servis en HTTP 200 sous le préfixe du dépôt. À 360 px, le document d'accueil ne déborde pas horizontalement.
- **Redéploiement :** le workflow reste manuel (`workflow_dispatch`); un push ultérieur seul ne déclenche pas de publication.
- **Prochaine étape :** poursuivre la recette pédagogique et enrichir les modules suivants; déclencher manuellement Pages après tout changement destiné aux élèves.
